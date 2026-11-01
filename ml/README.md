# Ask Alfonso

A small language model built from scratch that answers questions about Alfonso's
projects, skills and experience — grounded only in the same data that builds
[alfonsovegasol.com](https://alfonsovegasol.com).

## How it works

```
src/data/*.ts ──export──▶ knowledge.json ──▶ chunks + Q&A dataset
                                                   │
question ──▶ TF-IDF retriever ──▶ best chunk ──▶ transformer ──▶ answer
                    │ (low confidence)
                    └──────────────▶ "I'm not sure — here's how to contact Alfonso"
```

The model doesn't memorize facts: a retriever finds the relevant paragraph and the
transformer answers by reading it. That keeps a tiny model honest, and new facts
only need a data edit, not retraining.

## Roadmap

| Phase | What | Status |
|---|---|---|
| 1 | Dataset: chunks, corpus, Q&A with train/dev/test splits | ✅ |
| 2 | BPE tokenizer from scratch | ✅ |
| 3 | Decoder-only transformer from scratch | |
| 4 | Training: pretrain for fluency, fine-tune on Q&A | |
| 5 | Retrieval (TF-IDF) + confidence fallback | |
| 6 | Evaluation: accuracy, hallucination rate, refusals | |
| 7 | Deployment on the site | |

## Phase 1 — build the dataset

Requires Node.js (for the export) and Python 3.10+ (standard library only).

```bash
npm run export:knowledge      # src/data/*.ts  -> ml/data/knowledge.json
python ml/build_dataset.py    # -> ml/data/chunks.jsonl, corpus.txt, qa/{train,dev,test}.jsonl
```

Re-run both commands whenever `src/data` changes. Generated files live in
`ml/data/` and are not committed: they are always rebuilt from the source data.

### Dataset design (Phase 1)

- **Grounded by construction.** Every answer is assembled from data fields, so
  the dataset can't contain a fact the site doesn't.
- **Honest refusals.** Unknown technologies, unknown projects, personal questions
  and off-topic questions each have their own refusal answer.
- **Splits that measure generalization.** Fact questions are split by paraphrase
  template (the test set uses phrasings never seen in training); refusal
  questions are split by item (the test set uses topics never seen in training).
- **Validated.** The build fails if a gold chunk is missing, a template leaks a
  placeholder, or the same question appears in two splits.

## Phase 2 — train the tokenizer

```bash
python ml/train_tokenizer.py                       # -> ml/artifacts/tokenizer.json
python -m unittest discover -s ml/tests -t ml      # tokenizer tests
```

A byte-level BPE tokenizer (the GPT-2 family of algorithms), written from scratch
in `askalfonso/tokenizer.py`:

- **Bytes first.** The base vocabulary is the 256 byte values, so any text —
  accents, "CO₂", emoji — can be encoded with no unknown token.
- **Pre-tokenization.** A regex splits text into word-like pieces before BPE, so
  merges never cross word boundaries.
- **Merges.** Repeatedly merge the most frequent adjacent pair into a new token,
  until the vocabulary reaches the target size or pairs become one-offs.
- **Special tokens.** `<|context|>`, `<|question|>`, `<|answer|>`, `<|end|>` and
  `<|pad|>` are single, unsplittable ids that structure every example
  (see `askalfonso/prompt.py`).
- **No leakage.** Merges are learned from the train split and the knowledge
  corpus only; compression is reported on the dev split.

On the dev set, BPE averages ~4.5 characters per token: sequences are ~4.5×
shorter than character-level, and since attention cost grows with the square of
the sequence length, that's ~20× less attention compute per example.

