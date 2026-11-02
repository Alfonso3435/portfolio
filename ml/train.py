"""Phase 4 — trains Ask Alfonso.

Usage (from the repo root, after Phases 1–2):
    python ml/train.py                                   # full run (GPU recommended)
    python ml/train.py --epochs 2 --eval-samples 20      # quick smoke test on CPU
    python ml/train.py --pretrain-text wiki.txt --pretrain-steps 2000   # optional stage A

Two stages:
  A) Pretraining (optional): plain next-token prediction on general English text,
     so the model learns grammar before it learns the task.
  B) Fine-tuning: real Q&A + fresh synthetic Q&A every epoch, answer-only loss.

Training recipe (Improving Deep Neural Networks, applied):
  • AdamW with weight decay on the weight matrices only (not on norms/embeddings)
  • learning-rate warmup, then cosine decay
  • gradient clipping, dropout
  • early stopping on dev exact-match accuracy; the best checkpoint is kept

Since v3, training and dev contexts come from the TF-IDF retriever, as in the pipeline
(see askalfonso/training_data.py), and dev also reports token F1 and key-facts accuracy.

The test split is never touched here. It's reserved for the final evaluation (Phase 6).

Outputs (ml/checkpoints/<run>/):
    best.pt        model + config + tokenizer + metadata, at the best dev score
    metrics.jsonl  one line per log/eval step, for the loss curves on the Lab page
    samples.txt    dev questions with the model's answers, for error analysis
"""

from __future__ import annotations

import argparse
import json
import math
import random
import sys
import time
from contextlib import nullcontext
from datetime import datetime
from pathlib import Path

import torch

from askalfonso.data import collate, pad_id
from askalfonso.inference import answer, normalize, pick_device, save_checkpoint, set_seed
from askalfonso.metrics import score
from askalfonso.knowledge import Knowledge
from askalfonso.model import GPT, GPTConfig
from askalfonso.tokenizer import BPETokenizer
from askalfonso.training_data import EpochBuilder, build_context, eval_examples

ML_DIR = Path(__file__).resolve().parent
DATA_DIR = ML_DIR / "data"


def load_jsonl(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    # model
    p.add_argument("--n-layer", type=int, default=4)
    p.add_argument("--n-head", type=int, default=4)
    p.add_argument("--n-embd", type=int, default=256)
    p.add_argument("--block-size", type=int, default=768)
    p.add_argument("--dropout", type=float, default=0.1)
    # optimization
    p.add_argument("--epochs", type=int, default=80)
    p.add_argument("--batch-size", type=int, default=16)
    p.add_argument("--lr", type=float, default=1e-3)
    p.add_argument("--min-lr", type=float, default=1e-4)
    p.add_argument("--warmup-steps", type=int, default=200)
    p.add_argument("--weight-decay", type=float, default=0.1)
    p.add_argument("--grad-clip", type=float, default=1.0)
    # data
    p.add_argument("--synthetic-projects", type=int, default=16, help="fake projects per epoch (0 = off)")
    # stage A
    p.add_argument("--pretrain-text", type=Path, nargs="*", default=[])
    p.add_argument("--pretrain-steps", type=int, default=0)
    # evaluation / early stopping
    p.add_argument("--eval-samples", type=int, default=150, help="dev examples scored by exact match")
    p.add_argument("--eval-every", type=int, default=4, help="score dev exact match every N epochs (it's slow)")
    p.add_argument("--patience", type=int, default=6, help="exact-match evaluations without improvement before stopping")
    # misc
    p.add_argument("--run", default=datetime.now().strftime("%Y%m%d-%H%M"))
    p.add_argument("--device", default="auto")
    p.add_argument("--seed", type=int, default=1337)
    return p.parse_args()


def lr_at(step: int, total: int, args: argparse.Namespace) -> float:
    """Linear warmup to args.lr, then cosine decay down to args.min_lr."""
    if step < args.warmup_steps:
        return args.lr * (step + 1) / args.warmup_steps
    progress = min(1.0, (step - args.warmup_steps) / max(1, total - args.warmup_steps))
    return args.min_lr + 0.5 * (args.lr - args.min_lr) * (1 + math.cos(math.pi * progress))


def make_optimizer(model: GPT, args: argparse.Namespace, device: torch.device) -> torch.optim.AdamW:
    """Weight decay only on 2-D weight matrices; biases, LayerNorm and positions are left alone."""
    decay, no_decay = [], []
    for name, param in model.named_parameters():
        (decay if param.dim() >= 2 and "pos_emb" not in name else no_decay).append(param)
    groups = [{"params": decay, "weight_decay": args.weight_decay}, {"params": no_decay, "weight_decay": 0.0}]
    return torch.optim.AdamW(groups, lr=args.lr, betas=(0.9, 0.95), fused=device.type == "cuda")


def autocast(device: torch.device):
    """bfloat16 on GPUs that support it (A100, L4…): faster, same quality. Otherwise full precision."""
    if device.type == "cuda" and torch.cuda.is_bf16_supported():
        return torch.autocast("cuda", dtype=torch.bfloat16)
    return nullcontext()


@torch.no_grad()
def dev_loss(model: GPT, batches: list[tuple[torch.Tensor, torch.Tensor]], device: torch.device) -> float:
    model.eval()
    total, count = 0.0, 0
    for x, y in batches:
        with autocast(device):
            _, loss = model(x.to(device), y.to(device))
        n = int((y != -100).sum())
        total += loss.item() * n
        count += n
    model.train()
    return total / max(count, 1)


@torch.no_grad()
def dev_exact_match(model, tok, items, chunks) -> tuple[dict[str, float], dict[str, float], list[tuple[dict, str]]]:
    """Generates an answer for each dev item. Returns ({em, f1, facts}, EM by question type, answers)."""
    model.eval()
    results, by_type, totals = [], {}, {"em": 0.0, "f1": 0.0, "facts": 0.0}
    for row, ids, _ in items:
        pred = answer(model, tok, build_context(ids, chunks), row["question"])
        s = score(pred, row["answer"])
        for k in totals:
            totals[k] += s[k]
        results.append((row, pred))
        by_type.setdefault(row["type"], []).append(s["em"])
    model.train()
    n = max(len(results), 1)
    return {k: v / n for k, v in totals.items()}, {t: sum(v) / len(v) for t, v in sorted(by_type.items())}, results


def pretrain(model, tok, args, device, optimizer, log) -> None:
    """Stage A: next-token prediction on random windows of general text (every token is graded)."""
    text = "\n\n".join(p.read_text(encoding="utf-8") for p in args.pretrain_text)
    stream = torch.tensor(tok.encode(text), dtype=torch.long)
    window = args.block_size
    print(f"Stage A: pretraining on {len(stream):,} tokens for {args.pretrain_steps} steps")
    if len(stream) <= window + 1:
        raise ValueError("Pretraining text is shorter than one context window.")
    model.train()
    for step in range(args.pretrain_steps):
        for group in optimizer.param_groups:
            group["lr"] = lr_at(step, args.pretrain_steps, args)
        starts = torch.randint(0, len(stream) - window - 1, (args.batch_size,))
        x = torch.stack([stream[s : s + window] for s in starts]).to(device)
        y = torch.stack([stream[s + 1 : s + window + 1] for s in starts]).to(device)
        with autocast(device):
            _, loss = model(x, y)
        optimizer.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), args.grad_clip)
        optimizer.step()
        if step % 100 == 0 or step == args.pretrain_steps - 1:
            print(f"  A step {step:>5}  loss {loss.item():.3f}")
            log({"stage": "pretrain", "step": step, "train_loss": loss.item()})


def main() -> int:
    args = parse_args()
    tok_path = ML_DIR / "artifacts" / "tokenizer.json"
    if not tok_path.exists() or not (DATA_DIR / "qa" / "train.jsonl").exists():
        print("Run Phases 1–2 first (build_dataset.py, train_tokenizer.py).", file=sys.stderr)
        return 1

    set_seed(args.seed)
    device = pick_device(args.device)
    out_dir = ML_DIR / "checkpoints" / args.run
    out_dir.mkdir(parents=True, exist_ok=True)
    metrics_file = (out_dir / "metrics.jsonl").open("w", encoding="utf-8")

    def log(record: dict) -> None:
        metrics_file.write(json.dumps(record) + "\n")
        metrics_file.flush()

    tok = BPETokenizer.load(tok_path)
    kb = Knowledge.load(DATA_DIR / "knowledge.json")
    records = load_jsonl(DATA_DIR / "chunks.jsonl")  # {id, title, text, entities}, for the retriever
    chunks = {c["id"]: c["text"] for c in records}
    train_rows = load_jsonl(DATA_DIR / "qa" / "train.jsonl")
    dev_rows = load_jsonl(DATA_DIR / "qa" / "dev.jsonl")
    test_rows = load_jsonl(DATA_DIR / "qa" / "test.jsonl")

    # Leakage guard: technologies used as dev/test "unknown skill" refusals never appear in fake stacks.
    held_out_tech = {r["id"].split(":")[1].lower() for r in dev_rows + test_rows if r["intent"] == "skill.unknown"}

    cfg = GPTConfig(vocab_size=tok.vocab_size, block_size=args.block_size, n_layer=args.n_layer,
                    n_head=args.n_head, n_embd=args.n_embd, dropout=args.dropout)
    model = GPT(cfg).to(device)
    optimizer = make_optimizer(model, args, device)
    print(f"Device {device} · {model.num_params():,} parameters · run '{args.run}'")

    if args.pretrain_text and args.pretrain_steps:
        pretrain(model, tok, args, device, optimizer, log)
        optimizer = make_optimizer(model, args, device)  # fresh optimizer state for stage B

    builder = EpochBuilder(tok, kb, train_rows, chunks, cfg.block_size, args.synthetic_projects,
                           held_out_tech, seed=args.seed, records=records)
    dev_items = eval_examples(tok, dev_rows, chunks, cfg.block_size, records=records)
    dev_batches = [collate([e for _, _, e in dev_items[i : i + args.batch_size]], pad_id(tok))
                   for i in range(0, len(dev_items), args.batch_size)]
    # A fixed random subset for exact match (generating answers is slower than a loss pass).
    em_items = random.Random(args.seed).sample(dev_items, min(args.eval_samples, len(dev_items)))

    first_epoch = builder.build()
    steps_per_epoch = math.ceil(len(first_epoch) / args.batch_size)
    total_steps = steps_per_epoch * args.epochs
    print(f"Stage B: ~{len(first_epoch)} examples/epoch "
          f"({len(train_rows)} real + synthetic), {steps_per_epoch} steps/epoch, up to {args.epochs} epochs\n")

    best = {"dev_em": -1.0, "dev_loss": float("inf"), "epoch": 0}
    stale, step, start = 0, 0, time.perf_counter()
    model.train()
    for epoch in range(1, args.epochs + 1):
        examples = first_epoch if epoch == 1 else builder.build()
        running = []
        for i in range(0, len(examples), args.batch_size):
            x, y = collate(examples[i : i + args.batch_size], pad_id(tok))
            x, y = x.to(device), y.to(device)
            lr = lr_at(step, total_steps, args)
            for group in optimizer.param_groups:
                group["lr"] = lr
            with autocast(device):
                _, loss = model(x, y)
            optimizer.zero_grad(set_to_none=True)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), args.grad_clip)
            optimizer.step()
            running.append(loss.item())
            step += 1

        train_loss = sum(running) / len(running)
        d_loss = dev_loss(model, dev_batches, device)
        elapsed = time.perf_counter() - start
        record = {"stage": "finetune", "epoch": epoch, "step": step, "lr": lr, "train_loss": train_loss,
                  "dev_loss": d_loss}
        line = f"epoch {epoch:>3} · step {step:>5} · lr {lr:.1e} · train {train_loss:.3f} · dev {d_loss:.3f}"

        # Exact match needs real generation (slow), so it runs every few epochs and on the last one.
        if epoch % args.eval_every == 0 or epoch == args.epochs:
            scores, em_by_type, _ = dev_exact_match(model, tok, em_items, chunks)
            em = scores["em"]
            record |= {"dev_em": em, "dev_f1": scores["f1"], "dev_facts": scores["facts"], "dev_em_by_type": em_by_type}
            types = " ".join(f"{t}={v:.0%}" for t, v in em_by_type.items())
            print(f"{line} · dev EM {em:.1%} · F1 {scores['f1']:.1%} · facts {scores['facts']:.1%} · "
                  f"{elapsed / 60:.1f} min\n          {types}")
            improved = em > best["dev_em"] or (em == best["dev_em"] and d_loss < best["dev_loss"])
            if improved:
                best = {"dev_em": em, "dev_loss": d_loss, "epoch": epoch, "step": step}
                save_checkpoint(out_dir / "best.pt", model, tok, {"best": best, "args": vars(args) | {
                    "pretrain_text": [str(p) for p in args.pretrain_text]}, "trained_at": datetime.now().isoformat()})
                stale = 0
            else:
                stale += 1
                if stale >= args.patience:
                    print(f"\nEarly stopping: dev exact match hasn't improved in {args.patience} evaluations.")
                    log(record)
                    break
        else:
            print(f"{line} · {elapsed / 60:.1f} min")
        log(record)

    metrics_file.close()
    print(f"\n✓ Best dev EM {best['dev_em']:.1%} (dev loss {best['dev_loss']:.3f}) at epoch {best['epoch']} "
          f"→ {out_dir.relative_to(ML_DIR.parent)}/best.pt")

    # Qualitative check with the best weights, for error analysis.
    from askalfonso.inference import load_checkpoint
    best_model, _, _ = load_checkpoint(out_dir / "best.pt", args.device)
    _, _, results = dev_exact_match(best_model, tok, em_items, chunks)
    lines = []
    for row, pred in results:
        mark = "✓" if normalize(pred) == normalize(row["answer"]) else "✗"
        lines.append(f"{mark} [{row['type']}/{row['intent']}] {row['question']}\n   model:  {pred}\n   target: {row['answer']}\n")
    (out_dir / "samples.txt").write_text("\n".join(lines), encoding="utf-8")
    wrong = [ln for ln in lines if ln.startswith("✗")]
    print(f"  {len(wrong)} of {len(lines)} dev answers differ from the target → samples.txt")
    for ln in wrong[:4]:
        print("  " + ln.replace("\n", "\n  "))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
