"""Phase 2 — trains Ask Alfonso's BPE tokenizer.

Usage (from the repo root, after Phase 1):
    python ml/train_tokenizer.py
    python ml/train_tokenizer.py --vocab-size 4096 --extra-text path/to/more.txt

Trains only on the *train* split plus the knowledge corpus — never on dev/test —
so evaluation numbers later aren't inflated by a tokenizer that saw the test set.
Writes ml/artifacts/tokenizer.json and prints how well it compresses the dev set.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from askalfonso.prompt import SPECIAL_TOKENS, build_example
from askalfonso.tokenizer import BPETokenizer, CharTokenizer

ML_DIR = Path(__file__).resolve().parent
DATA_DIR = ML_DIR / "data"
OUT_FILE = ML_DIR / "artifacts" / "tokenizer.json"


def load_jsonl(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def examples_as_text(rows: list[dict], chunks: dict[str, str]) -> list[str]:
    """Render Q&A rows in the exact format the model will read (see prompt.py)."""
    texts = []
    for row in rows:
        context = "\n".join(chunks[c] for c in row["gold_chunks"])
        texts.append(build_example(context, row["question"], row["answer"]))
    return texts


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--vocab-size", type=int, default=2048, help="bytes (256) + merges; special tokens are extra")
    parser.add_argument("--min-frequency", type=int, default=2)
    parser.add_argument("--extra-text", type=Path, nargs="*", default=[], help="more .txt files to learn merges from")
    args = parser.parse_args()

    if not (DATA_DIR / "qa" / "train.jsonl").exists():
        print("Missing ml/data/qa. Run Phase 1 first: npm run export:knowledge && python ml/build_dataset.py",
              file=sys.stderr)
        return 1

    chunks = {c["id"]: c["text"] for c in load_jsonl(DATA_DIR / "chunks.jsonl")}
    train_texts = [(DATA_DIR / "corpus.txt").read_text(encoding="utf-8")]
    train_texts += examples_as_text(load_jsonl(DATA_DIR / "qa" / "train.jsonl"), chunks)
    for extra in args.extra_text:
        train_texts.append(extra.read_text(encoding="utf-8"))
    dev_texts = examples_as_text(load_jsonl(DATA_DIR / "qa" / "dev.jsonl"), chunks)

    print(f"Training BPE on {sum(len(t) for t in train_texts):,} characters (target vocab {args.vocab_size})…")
    start = time.perf_counter()
    tok = BPETokenizer(special_tokens=SPECIAL_TOKENS)
    tok.train(train_texts, vocab_size=args.vocab_size, min_frequency=args.min_frequency, verbose=True)
    elapsed = time.perf_counter() - start

    # Sanity check: decode(encode(x)) must give back x exactly, for every dev example.
    broken = [t for t in dev_texts if tok.decode(tok.encode(t)) != t]
    if broken:
        print(f"✗ Round-trip failed on {len(broken)} dev examples, e.g. {broken[0][:120]!r}", file=sys.stderr)
        return 1

    tok.save(OUT_FILE)

    # Compression on the dev set — text the tokenizer never trained on.
    dev_chars = sum(len(t) for t in dev_texts)
    bpe_tokens = sum(len(tok.encode(t)) for t in dev_texts)
    char_tok = CharTokenizer(train_texts)
    char_tokens = sum(len(char_tok.encode(t)) for t in dev_texts)
    longest = max(len(tok.encode(t)) for t in dev_texts)

    print(f"\n✓ Learned {len(tok.merges)} merges in {elapsed:.1f}s → vocab {tok.vocab_size} "
          f"(256 bytes + {len(tok.merges)} merges + {len(tok.special_tokens)} special) → ml/artifacts/tokenizer.json")
    print("\nOn the dev set (never seen in training):")
    print(f"  characters per token   char-level 1.00   BPE {dev_chars / bpe_tokens:.2f}")
    print(f"  tokens per example     char-level {char_tokens / len(dev_texts):.0f}   BPE {bpe_tokens / len(dev_texts):.0f}")
    print(f"  longest example        {longest} tokens  (the model's context window must fit this)")

    print("\nHow it splits text (each | is a token boundary):")
    for sample in ["Does he know PyTorch?", "What did Alfonso build at HackMX?",
                   "Tecnológico de Monterrey · CO₂ sensors", "Does he know Kubernetes?"]:
        print(f"  {'|'.join(tok.tokens(sample))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
