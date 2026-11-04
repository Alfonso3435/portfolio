"""Phase 5 — measure retrieval and the full pipeline, and choose the threshold τ.

    python ml/eval_pipeline.py --retrieval-only                       # no model needed, instant
    python ml/eval_pipeline.py --checkpoint ml/checkpoints/colab-v2/best.pt
    python ml/eval_pipeline.py --checkpoint … --thresholds 0.06 0.08 0.10 0.12 0.15

Tuning happens on **dev**. The test split stays untouched until Phase 6, so the final
numbers aren't inflated by choices we made while looking at them.

Every question ends in one of these outcomes:
    answerable questions (they have a gold chunk)
        correct     exact match with the reference answer (F1 and key facts: see metrics.py)
        safe miss   refused or fell back: unhelpful, but honest
        wrong       stated something that isn't the reference answer  ← what we minimize
    questions it should refuse (unknown, private, off-topic)
        correct     refused, fell back, or redirected with the greeting (states nothing)
        wrong       stated a "fact"                                     ← a hallucination
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

ML = Path(__file__).resolve().parent
sys.path.insert(0, str(ML))

from askalfonso.retrieval import TfidfRetriever  # noqa: E402

REFUSE_TYPES = {"unknown_skill", "unknown_entity", "unknown", "private", "offtopic"}


def load_rows(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.open(encoding="utf-8")]


def retrieval_report(chunks: list[dict], rows: list[dict]) -> None:
    retriever = TfidfRetriever(chunks)
    answerable = [r for r in rows if r["gold_chunks"]]
    ranks = []
    for row in answerable:
        hits = retriever.search(row["question"], k=len(chunks))
        ids = [h.chunk_id for h in hits]
        ranks.append(min(ids.index(g) for g in row["gold_chunks"]) + 1)
    n = len(ranks)
    print(f"Retrieval on {n} answerable questions")
    for k in (1, 2, 3, 5):
        print(f"  recall@{k}: {sum(r <= k for r in ranks) / n:6.1%}")
    print(f"  MRR:       {sum(1 / r for r in ranks) / n:.3f}")

    # Where do the scores of each kind of question fall? This is what τ has to separate.
    print("\nTop retrieval score by question type (min / median / max):")
    by_type = defaultdict(list)
    for row in rows:
        by_type[row["type"]].append(retriever.search(row["question"], k=1)[0].score)
    for typ, scores in sorted(by_type.items()):
        s = sorted(scores)
        print(f"  {typ:15s} n={len(s):3d}  {s[0]:.3f} / {s[len(s) // 2]:.3f} / {s[-1]:.3f}")


def outcome(row: dict, reply, normalize) -> str:
    if row["type"] == "greeting":
        return "correct" if reply.answer.startswith("Hi!") else "wrong"
    if row["type"] in REFUSE_TYPES:
        if reply.status in {"refused", "private", "fallback"}:
            return "correct"
        # "Tell me a joke." → "Hi! I'm Ask Alfonso… ask me about his projects": not the
        # reference refusal, but it states nothing and steers back on topic. Counted as safe,
        # not as a hallucination (v1–v5 tables counted it as wrong).
        return "correct" if reply.answer.startswith("Hi! I'm") else "wrong"
    if normalize(reply.answer) == normalize(row["answer"]):
        return "correct"
    return "safe_miss" if reply.status in {"refused", "private", "fallback"} else "wrong"


def run_pipeline(args, rows: list[dict]) -> None:
    from askalfonso.inference import normalize
    from askalfonso.pipeline import AskAlfonso, PipelineConfig

    from askalfonso.metrics import score

    bot = AskAlfonso.from_files(args.checkpoint, args.data, device=args.device, chunks_file=args.chunks)
    answerable = [r for r in rows if r["gold_chunks"]]
    refuse = [r for r in rows if not r["gold_chunks"]]
    print(f"\nPipeline on {len(rows)} {args.split} questions "
          f"({len(answerable)} answerable, {len(refuse)} to refuse or greet)\n")
    header = (f"{'setting':22s} {'correct':>8s} {'safe miss':>10s} {'wrong':>7s} {'F1':>6s} {'facts':>6s} │ "
              f"{'refused ok':>10s} {'halluc.':>8s} │ {'overall':>8s} {'s/q':>6s}")
    print(header)
    print("─" * len(header))

    settings = [(f"τ={t:.2f}", PipelineConfig(threshold=t)) for t in args.thresholds]
    settings.append((f"τ={args.thresholds[0]:.2f}, no guards", PipelineConfig(threshold=args.thresholds[0], guards=False)))
    details = {}
    for name, cfg in settings:
        bot.cfg = cfg
        start = time.perf_counter()
        results = [(row, bot.ask(row["question"])) for row in rows]
        per_q = (time.perf_counter() - start) / len(rows)
        out = [(row, reply, outcome(row, reply, normalize)) for row, reply in results]
        a = Counter(o for row, _, o in out if row["gold_chunks"])
        r = Counter(o for row, _, o in out if not row["gold_chunks"])
        total = sum(o == "correct" for _, _, o in out)
        na, nr = max(len(answerable), 1), max(len(refuse), 1)  # the stress set has no refusals
        soft = [score(reply.answer, row["answer"]) for row, reply, _ in out if row["gold_chunks"]]
        f1 = sum(x["f1"] for x in soft) / na
        facts = sum(x["facts"] for x in soft) / na
        print(f"{name:22s} {a['correct'] / na:8.1%} {a['safe_miss'] / na:10.1%} {a['wrong'] / na:7.1%} "
              f"{f1:6.1%} {facts:6.1%} │ "
              f"{r['correct'] / nr:10.1%} {r['wrong'] / nr:8.1%} │ {total / len(rows):8.1%} {per_q:6.2f}")
        details[name] = out

    # Error analysis for the first setting: everything that isn't correct, grouped.
    chosen = settings[0][0]
    path = args.out or (ML / "artifacts" / f"pipeline_{args.split}.jsonl")
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for row, reply, o in details[chosen]:
            f.write(json.dumps({"outcome": o, "type": row["type"], "question": row["question"],
                                "expected": row["answer"], "answer": reply.answer, "status": reply.status,
                                **reply.debug}, ensure_ascii=False) + "\n")
    guard_reasons = Counter(reply.debug.get("reason") for _, reply, _ in details[chosen] if reply.status != "answered"
                            and reply.debug.get("reason"))
    print(f"\nWhy the guardrails stepped in ({chosen}): {dict(guard_reasons)}")
    print(f"Per-question details: {path}")
    if args.show_errors:
        print(f"\nErrors ({chosen}):")
        for row, reply, o in details[chosen]:
            if o != "correct":
                print(f"\n[{o}] ({row['type']}) {row['question']}\n  expected: {row['answer']}\n  got:      "
                      f"{reply.answer}\n  raw:      {reply.debug.get('raw')}\n  context:  {reply.debug.get('context_ids')}"
                      f"  reason: {reply.debug.get('reason')} {reply.debug.get('ungrounded') or ''}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", type=Path, default=ML / "data")
    parser.add_argument("--split", choices=["dev", "test", "stress"], default="dev")
    parser.add_argument("--checkpoint", type=Path)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--thresholds", type=float, nargs="+", default=[0.10, 0.08, 0.12, 0.15])
    parser.add_argument("--retrieval-only", action="store_true")
    parser.add_argument("--show-errors", action="store_true")
    parser.add_argument("--out", type=Path)
    parser.add_argument("--chunks", type=Path, help="chunks file to use instead of data/chunks.jsonl "
                        "(e.g. the v2 format, to evaluate the v2 model fairly)")
    args = parser.parse_args()

    chunks = load_rows(args.chunks or args.data / "chunks.jsonl")
    rows = load_rows(args.data / "qa" / f"{args.split}.jsonl")
    if args.split == "test":
        print("Note: the test split is for the final evaluation (Phase 6). Don't tune on it.\n")
    retrieval_report(chunks, rows)
    if args.retrieval_only:
        return
    if not args.checkpoint:
        parser.error("--checkpoint is required unless --retrieval-only")
    run_pipeline(args, rows)


if __name__ == "__main__":
    main()
