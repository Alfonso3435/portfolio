"""Phase 1 — builds Ask Alfonso's dataset from the site's data.

Usage (from the repo root):
    npm run export:knowledge        # src/data/*.ts  -> ml/data/knowledge.json
    python ml/build_dataset.py      # knowledge.json -> chunks, corpus, Q&A splits

Outputs (in ml/data/):
    chunks.jsonl      one retrieval chunk per line: {id, title, text, source}
    corpus.txt        all chunk texts, for language-model training
    qa/train.jsonl    Q&A examples, ~70%
    qa/dev.jsonl      for tuning hyperparameters, ~15%
    qa/test.jsonl     touched only for final evaluation, ~15%
    stats.json        counts per split and per question type

Uses only the Python standard library, so it runs without installing anything.
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from collections import Counter
from pathlib import Path

from askalfonso.knowledge import Knowledge, chunk_to_dict
from askalfonso.qa import QAGenerator, add_casual_variants, to_record

ML_DIR = Path(__file__).resolve().parent
DATA_DIR = ML_DIR / "data"
SPLITS = ("train", "dev", "test")


def write_jsonl(path: Path, records: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as f:
        for record in records:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")


def validate(chunks: list[dict], examples: list[dict]) -> list[str]:
    """Checks that would silently ruin training if they failed."""
    problems = []
    chunk_ids = {c["id"] for c in chunks}
    if len(chunk_ids) != len(chunks):
        problems.append("Duplicate chunk ids.")
    for ex in examples:
        missing = [c for c in ex["gold_chunks"] if c not in chunk_ids]
        if missing:
            problems.append(f"{ex['id']}: gold chunk(s) {missing} don't exist.")
        for bad in ("{", "}", "TODO", "None", "  "):
            if bad in ex["answer"] or bad in ex["question"]:
                problems.append(f"{ex['id']}: suspicious text {bad!r} in {ex['question']!r} / {ex['answer']!r}")
    ids = Counter(ex["id"] for ex in examples)
    problems += [f"Duplicate example id: {i}" for i, n in ids.items() if n > 1]

    # Leakage: the exact same question string must not appear in two splits.
    seen: dict[str, str] = {}
    for ex in examples:
        q = ex["question"].lower().rstrip("?.!").strip()
        if q in seen and seen[q] != ex["split"]:
            problems.append(f"Leak: {ex['question']!r} is in both {seen[q]} and {ex['split']}.")
        seen.setdefault(q, ex["split"])
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--knowledge", type=Path, default=DATA_DIR / "knowledge.json")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--samples", type=int, default=8, help="random examples to print")
    args = parser.parse_args()

    if not args.knowledge.exists():
        print(f"Missing {args.knowledge}. Run `npm run export:knowledge` first.", file=sys.stderr)
        return 1

    kb = Knowledge.load(args.knowledge)
    chunks = [chunk_to_dict(c) for c in kb.chunks()]
    qa = QAGenerator(kb).generate()
    add_casual_variants(qa)
    examples = [to_record(ex) for ex in qa]

    problems = validate(chunks, examples)
    if problems:
        print(f"✗ {len(problems)} problem(s) found:", file=sys.stderr)
        for p in problems[:20]:
            print(f"  - {p}", file=sys.stderr)
        return 1

    write_jsonl(DATA_DIR / "chunks.jsonl", chunks)
    (DATA_DIR / "corpus.txt").write_text("\n\n".join(c["text"] for c in chunks) + "\n", encoding="utf-8")
    rng = random.Random(args.seed)
    for split in SPLITS:
        rows = [ex for ex in examples if ex["split"] == split]
        rng.shuffle(rows)  # mix intents so batches aren't all "project.stack"
        write_jsonl(DATA_DIR / "qa" / f"{split}.jsonl", rows)

    stats = {
        "chunks": len(chunks),
        "corpus_words": sum(len(c["text"].split()) for c in chunks),
        "examples": len(examples),
        "per_split": dict(Counter(ex["split"] for ex in examples)),
        "per_type": {
            split: dict(Counter(ex["type"] for ex in examples if ex["split"] == split)) for split in SPLITS
        },
        "intents": len({ex["intent"] for ex in examples}),
    }
    (DATA_DIR / "stats.json").write_text(json.dumps(stats, indent=2) + "\n", encoding="utf-8")

    print(f"✓ {stats['chunks']} chunks ({stats['corpus_words']:,} words) → ml/data/chunks.jsonl, corpus.txt")
    print(f"✓ {stats['examples']} Q&A examples across {stats['intents']} intents → ml/data/qa/")
    for split in SPLITS:
        types = ", ".join(f"{k} {v}" for k, v in sorted(stats["per_type"][split].items()))
        print(f"    {split:<5} {stats['per_split'].get(split, 0):>5}   ({types})")

    print("\nRandom samples:")
    for ex in random.Random(args.seed + 1).sample(examples, min(args.samples, len(examples))):
        print(f"  [{ex['split']}/{ex['intent']}] Q: {ex['question']}")
        print(f"      A: {ex['answer']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
