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
| 3 | Decoder-only transformer from scratch | ✅ |
| 4 | Training: fine-tune on Q&A + synthetic reading practice | ✅ |
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

## Phase 3 — the transformer

```bash
python -m venv ml/.venv && ml/.venv/bin/pip install -r ml/requirements.txt   # Windows: ml\.venv\Scripts\pip
python ml/inspect_model.py                         # sanity checks, ~1 min on CPU
python -m unittest discover -s ml/tests -t ml      # 25 tests
```

`askalfonso/model.py` is a GPT-style decoder-only transformer (~3.9M parameters
with the default config: 4 layers, 4 heads, 256-dim embeddings, 768-token window):

- **Embeddings** — a learned vector per token (*what*) plus one per position (*where*).
- **Causal multi-head self-attention** — `softmax(QKᵀ/√d + mask)·V`, implemented
  by hand. The mask hides future tokens, so the model can't peek at what it must predict.
- **MLP** — a 2-layer network (4× expansion, GELU) applied to each token.
- **Pre-norm residual blocks** — `x + Attn(LN(x))`, `x + MLP(LN(x))`, for stable training.
- **Weight tying** — the input embedding and the output layer share one matrix.
- **Answer-only loss** (`askalfonso/data.py`) — the context and question are read
  but not graded; only the answer tokens count.

`inspect_model.py` verifies the model before any real training: initial loss ≈
ln(vocab), the causal mask leaks nothing, and it can overfit a tiny batch.

## Phase 4 — training

Recommended: open `ml/notebooks/train_colab.ipynb` in Google Colab with a T4 GPU
and run all cells. It clones this repo, rebuilds Phases 1–2 and trains.

Locally (any machine; a CUDA GPU makes it ~20× faster than CPU):

```bash
python ml/train.py                                  # → ml/checkpoints/<run>/best.pt
python ml/train.py --epochs 2 --eval-samples 20     # quick smoke test
```

What makes it work:

- **Synthetic reading practice** (`askalfonso/synthetic.py`). Every epoch adds Q&A
  about freshly invented projects (random names, stacks and roles). They can't be
  memorized, so the model must learn to *read* the context — which is what lets new
  projects work later without retraining. Only train-split templates are used, and
  dev/test "unknown" technologies are never placed in a fake stack (no leakage).
- **Realistic contexts** (`askalfonso/training_data.py`). Fact questions get their
  gold chunk(s) plus, half the time, an irrelevant distractor; refusals get only
  irrelevant chunks or none. Resampled every epoch.
- **Recipe.** AdamW (decay on weight matrices only), linear warmup + cosine decay,
  gradient clipping, dropout, answer-only loss, early stopping on dev exact match.
- **Optional stage A.** `--pretrain-text … --pretrain-steps …` runs plain
  next-token pretraining on general English first (the notebook can fetch WikiText-2).

The test split is never used during training; it's reserved for Phase 6.

