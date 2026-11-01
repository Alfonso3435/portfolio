"""Phase 3 — builds the transformer and runs the sanity checks every model should pass
before real training. Takes about a minute on a laptop CPU.

Usage (from the repo root, after Phases 1–2):
    python ml/inspect_model.py

Checks:
  1. Parameter count, layer by layer.
  2. Initial loss ≈ ln(vocab_size): an untrained model should be uniformly unsure.
  3. Causality: changing a *future* token must not change earlier predictions.
  4. Overfit a tiny batch: if the model can't memorize 4 examples, something is broken.
  5. Generation: gibberish before, the memorized answer after.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from pathlib import Path

import torch

from askalfonso.data import collate, encode_example, pad_id
from askalfonso.model import GPT, GPTConfig
from askalfonso.prompt import END, build_prompt
from askalfonso.tokenizer import BPETokenizer

ML_DIR = Path(__file__).resolve().parent
DATA_DIR = ML_DIR / "data"
TOKENIZER = ML_DIR / "artifacts" / "tokenizer.json"


def load_jsonl(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def pick_device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda")
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return torch.device("mps")  # Apple Silicon
    return torch.device("cpu")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--steps", type=int, default=150, help="optimizer steps for the overfit test")
    args = parser.parse_args()

    if not TOKENIZER.exists():
        print("Missing ml/artifacts/tokenizer.json. Run Phase 2 first: python ml/train_tokenizer.py", file=sys.stderr)
        return 1

    torch.manual_seed(1337)
    device = pick_device()
    tok = BPETokenizer.load(TOKENIZER)
    cfg = GPTConfig(vocab_size=tok.vocab_size)
    model = GPT(cfg).to(device)

    # ── 1. size ──────────────────────────────────────────────────────────────
    print(f"Device: {device}\nConfig: {cfg.to_dict()}\n")
    print("1) Parameters")
    groups = {
        "token embeddings (tied with output layer)": model.tok_emb,
        "position embeddings": model.pos_emb,
        f"{cfg.n_layer} transformer blocks": model.blocks,
        "final layer norm": model.ln_f,
    }
    for name, module in groups.items():
        print(f"   {name:<45} {sum(p.numel() for p in module.parameters()):>10,}")
    print(f"   {'total':<45} {model.num_params():>10,}   (GPT-2 small has 124,000,000)\n")

    # ── data: 4 real training examples ───────────────────────────────────────
    chunks = {c["id"]: c["text"] for c in load_jsonl(DATA_DIR / "chunks.jsonl")}
    rows = [r for r in load_jsonl(DATA_DIR / "qa" / "train.jsonl") if r["gold_chunks"]]
    encoded, used = [], []
    for row in rows:
        e = encode_example(tok, "\n".join(chunks[c] for c in row["gold_chunks"]), row["question"], row["answer"], cfg.block_size)
        if e:
            encoded.append(e)
            used.append(row)
        if len(encoded) == 4:
            break
    x, y = collate(encoded, pad_id(tok))
    x, y = x.to(device), y.to(device)
    graded = int((y != -100).sum())
    print(f"   Batch: {tuple(x.shape)} = 4 examples × {x.shape[1]} tokens, {graded} answer tokens graded\n")

    # ── 2. initial loss ──────────────────────────────────────────────────────
    model.eval()
    with torch.no_grad():
        _, loss = model(x, y)
    expected = math.log(cfg.vocab_size)
    print("2) Initial loss")
    print(f"   {loss.item():.3f}  vs  ln({cfg.vocab_size}) = {expected:.3f}  → "
          f"{'✓ uniformly unsure, as it should be' if abs(loss.item() - expected) < 0.5 else '✗ suspicious initialization'}\n")

    # ── 3. causality ─────────────────────────────────────────────────────────
    with torch.no_grad():
        a, _ = model(x[:1])
        changed = x[:1].clone()
        changed[0, -1] = (changed[0, -1] + 1) % cfg.vocab_size  # alter only the LAST token
        b, _ = model(changed)
    leak = (a[0, :-1] - b[0, :-1]).abs().max().item()
    print("3) Causality")
    print(f"   Changing the last token moved earlier predictions by {leak:.2e} → "
          f"{'✓ no peeking at the future' if leak < 1e-5 else '✗ the mask is broken'}\n")

    # ── 5a. generation before training ───────────────────────────────────────
    sample = used[0]
    prompt = build_prompt("\n".join(chunks[c] for c in sample["gold_chunks"]), sample["question"])
    prompt_ids = torch.tensor([tok.encode(prompt)], device=device)

    def answer_now() -> str:
        out = model.generate(prompt_ids, max_new_tokens=60, temperature=0, stop_token=tok.token_id(END))
        return tok.decode(out[0, prompt_ids.shape[1]:].tolist()).replace(END, "").strip()

    before = answer_now()

    # ── 4. overfit a tiny batch ──────────────────────────────────────────────
    print(f"4) Overfitting 4 examples for {args.steps} steps (AdamW, lr 1e-3)")
    model.train()
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3)
    start = time.perf_counter()
    for step in range(1, args.steps + 1):
        _, loss = model(x, y)
        optimizer.zero_grad(set_to_none=True)
        loss.backward()
        optimizer.step()
        if step == 1 or step % 25 == 0:
            print(f"   step {step:>4}  loss {loss.item():.4f}")
    final = loss.item()
    print(f"   {time.perf_counter() - start:.0f}s → "
          f"{'✓ it can learn (loss near 0)' if final < 0.1 else '✗ loss did not drop; check the model'}\n")

    # ── 5b. generation after ─────────────────────────────────────────────────
    print("5) Generation (greedy) for one of those examples")
    print(f"   Q:      {sample['question']}")
    print(f"   target: {sample['answer']}")
    print(f"   before: {before[:160]!r}")
    print(f"   after:  {answer_now()!r}")
    print("\n   Note: memorizing 4 examples only proves the plumbing works. Real learning —")
    print("   answering questions it has never seen — is Phase 4.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
