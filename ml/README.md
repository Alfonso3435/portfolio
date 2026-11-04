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
| 5 | Retrieval (TF-IDF) + confidence fallback + guardrails | ✅ |
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
python -m unittest discover -s ml/tests -t ml      # all tests
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
python ml/train.py --run my-run --resume            # continue an interrupted run from its last.pt
```

`last.pt` is saved after every epoch (weights, optimizer state, epoch, best score, RNG
states), so an interrupted run continues where it stopped. The Colab notebook saves runs
to Google Drive (`--checkpoints`), so a disconnected runtime loses at most one epoch:
reconnect and `Run all`.

What makes it work:

- **Synthetic reading practice** (`askalfonso/synthetic.py`). Every epoch adds Q&A
  about freshly invented projects (random names, stacks and roles). They can't be
  memorized, so the model must learn to *read* the context — which is what lets new
  projects work later without retraining. Only train-split templates are used, and
  dev/test "unknown" technologies are never placed in a fake stack (no leakage).
- **Realistic contexts** (`askalfonso/training_data.py`). Since v3, 70% of contexts are
  exactly what the retriever would show for that question (related chunks, best first;
  empty for most refusals), so training matches what the model reads on the site. The other
  30% use v2's random policy (gold + a random distractor; refusals get 0–2 random chunks)
  for robustness. Resampled every epoch.
- **Recipe.** AdamW (decay on weight matrices only), linear warmup + cosine decay,
  gradient clipping, dropout, answer-only loss, early stopping on dev exact match.
- **Optional stage A.** `--pretrain-text … --pretrain-steps …` runs plain
  next-token pretraining on general English first (the notebook can fetch WikiText-2).

The test split is never used during training; it's reserved for Phase 6.

### Results log

| Run | Change | Train-phrasing EM | Dev EM (new phrasings) |
|---|---|---|---|
| v1 | Baseline: 2–3 phrasings per question type | 99% | 34% |
| v2 | 3× more training phrasings; endless invented unknowns; dedupe | 100% | 63% |
| v3 | Retrieval-style contexts; award + links in project chunks; ~1.7× more training questions; WikiText-2 pretraining | 100% | 68.7% (retrieved contexts) |
| v4 | Fixed reference answers; question openers spread across intents; near-copies of dev/test phrasings removed | 100% | 72.7% (retrieved contexts) |
| v5a | 3× bigger model; ~25× more pretraining (WikiText-103); fine-tune LR 5e-4 | 100% | 72.7% (retrieved contexts) |
| v5b | Same, fine-tune LR 1e-3 | 100% | 70.0% (retrieved contexts) |

Dev EM from v3 on is measured on **retrieved** contexts (as in the pipeline), so it isn't
directly comparable with v1/v2's random contexts. The fair comparison is the Phase 5
pipeline table below, where every model is run end to end on the same dev questions.

**v1 error analysis.** Near-perfect on phrasings seen in training, 34% on new ones:
high *variance* — the model memorized wording instead of meaning (e.g. "Which tools
did he use to build X?" was answered with X's problem statement). It also hallucinated
on unseen technologies ("Does he know Redis?" → "Yes… Rust in BlockCity") because the
~22 unknown technologies in training could be memorized. A subtle leak also inflated
v1's skill score: refusal questions reused the phrasings `skill.has` holds out for
dev/test. v2 fixes all three; dev/test questions are unchanged so the runs compare.

**v2 error analysis.** Fact questions went from 13% to 69% and skill questions from
77% to 88% on dev (the latter despite removing the leak). The gap that remains:

- **Refusals are right, but the name is wrong.** "Has he used Ruby on Rails?" → "I don't
  have any information about *Ruby*…"; "Describe QuantumChess." → "…a project called
  *Quirex*…". The model knows to refuse but copies long or rare names imperfectly.
- **A few unseen phrasings still map to the wrong question type**, consistently: "Can you
  explain X?" → X's problem; "Was X recognized anywhere?" → X's links.
- **Occasional confident nonsense** on off-topic or private questions ("How much does
  Answr make?" → a description of Answr).

These are exactly what Phase 5's guardrails target: retrieval confidence, and a
grounding check that rejects answers naming things absent from the context and question.


## Phase 5 — retrieval + guardrails

```bash
python ml/eval_pipeline.py --retrieval-only                          # retrieval metrics, no model needed
python ml/eval_pipeline.py --checkpoint ml/checkpoints/<run>/best.pt # full pipeline on dev + τ sweep
python ml/ask.py --checkpoint ml/checkpoints/<run>/best.pt --debug   # chat, and see every decision
```

`askalfonso/pipeline.py` wires everything together:

```
question ─▶ private guard ─▶ TF-IDF top-3 ─▶ keep chunks ≥ τ ─▶ transformer ─▶ output checks ─▶ reply
               │ (personal)                      │ (none ≥ τ: empty context)      │ (failed)
               ▼                                 ▼                                ▼
         private refusal                 model must refuse              "I'm not sure — reach him at …"
```

- **Retriever** (`askalfonso/retrieval.py`) — TF-IDF from scratch: sublinear tf, smoothed idf,
  L2-normalized vectors, cosine similarity, unigrams + bigrams, a small synonym table
  ("UW" → University of Washington). An **entity bonus** (+0.5) goes to every chunk whose
  name — a project, company, school, award *or technology* — appears in the question.
- **Confidence threshold τ = 0.10.** Below it the model gets no context and should refuse.
- **Guardrails** (`askalfonso/guardrails.py`, pure Python so they can be ported to TypeScript):
  personal questions are refused before the model runs; answers must finish (`<|end|>`),
  not repeat themselves, and without context only a refusal is accepted. The key check is
  **grounding**: every name and number in a factual answer must appear in the retrieved
  chunks; in a refusal, the name it refuses must come from the question. A "Yes, he has used
  X" answer must name the X that was asked.

### Results (dev, colab-v2 model)

Retrieval on 211 answerable questions: **recall@1 89.1%, recall@2 100%, MRR 0.945**.
The entity bonus did most of the work (recall@1 54% → 89%): plain TF-IDF ranked IdentifEye's
own chunk 6th for "What need does IdentifEye address?", because skill chunks mention it more.

| Setting | Answerable: correct | safe miss | wrong | Should refuse: refused | stated a "fact" |
|---|---|---|---|---|---|
| τ = 0.05 | 73.9% | 3.8% | 22.3% | 93.2% | 6.8% |
| **τ = 0.10 (chosen)** | **73.9%** | 3.8% | 22.3% | **95.5%** | **4.5%** |
| τ = 0.20 | 72.5% | 4.7% | 22.7% | 95.5% | 4.5% |
| τ = 0.10, no guardrails | 74.4% | 1.9% | 23.7% | 75.0% | 25.0% |

The guardrails cost 0.5 points of correct answers and cut wrong answers to "should refuse"
questions from 25% to 4.5%. The remaining two are greetings ("What video games does he
play?" → "Hi! I'm Ask Alfonso…"): off target, but harmless. Every factual answer that gets
through is grounded in what the model read — no invented names or numbers.

### Error analysis

- **The 22% "wrong" are grounded answers to the wrong question type** — the v2 weakness from
  Phase 4, not hallucinations: "Was ZapTap recognized anywhere?" → ZapTap's links; "Can you
  explain SAMLA?" → its problem statement. The guardrails can't catch these (every word is in
  the context). Fixing them is a model job: more varied training phrasings (v3).
- **19 refusals named the wrong thing** ("Describe QuantumChess." → "…a project called
  *Quirex*…"; "Does he know Redis?" → "…about *Riso.js*…"). The grounding check turns all of
  them into the fallback: still an honest "I'm not sure".
- **Lesson: the reader is brittle to the chunk format.** Adding two sentences (award and links)
  to every project chunk dropped answerable accuracy from 74% to 44% with the same model —
  a train/test distribution mismatch. So the chunk text stays exactly as trained, and the
  award/link/case-study facts the model learned from answers are passed to the grounding check
  only (`Knowledge.grounding_facts()`). Moving them into the chunks needs a retrain.
- **Two data bugs found by the grounding check:** link answers and "did X win anything?"
  answers had no gold chunk containing the URL or the award, so the model could only memorize
  them. Grounding facts cover them for now; v3 should put them in the chunks.

Latency on CPU is ~0.3–2.5 s per question (no KV cache yet) — a Phase 7 concern.

### v3: what changed and why

Phase 5's error analysis showed that every wrong answer had the right chunk in its context:
retrieval was fine, the *reader* wasn't. v3 targets the reader:

1. **Award and links inside each project chunk** (`knowledge.py`). Fixes the data bug where
   "Did X win anything?" and "Is there a demo of X?" could only be memorized.
2. **Train on the contexts it will see** (`training_data.py`, `retrieval.select_hits`, shared
   with the pipeline). v2 trained with random distractors; on the site it reads *related*
   chunks (other chunks about the same project or technology), which are harder to tell apart.
3. **~1,700 more training questions** (new phrasings in `qa.py`, `MORE_TRAIN_TEMPLATES`, for every intent; 2,293 → 3,998 real training examples):
   the remaining errors are still high variance on unseen wording.
4. **Softer metrics** (`metrics.py`): token F1 and key facts next to exact match, so
   "ESP32 / Arduino" for "ESP32" isn't scored like a wrong answer.
5. **Pretraining on WikiText-2** (stage A) turned on in the notebook.

Two safeguards added while doing this: a dev/test question now always wins over a duplicate
train phrasing (39 new phrasings matched held-out questions and would have silently removed
them), and which questions get lowercased is decided by a hash of the question, so adding
training data never changes the dev or test sets. Dev and test are identical with and without
the new phrasings (verified).

Because Phase 5's error analysis looked at dev, dev is now slightly optimistic. The untouched
test set (Phase 6) gives the honest number.

**Baseline to beat** (v2, current dev, its own chunk format, τ = 0.10): answerable 73.9%
exact / 81.7% F1 / 81.5% key facts; 95.5% of should-refuse questions refused.

### v3 results and error analysis

Full pipeline on dev (τ = 0.10), same questions as the v2 baseline:

| | v2 | v3 |
|---|---|---|
| Answerable: exact match | 73.9% | **80.6%** |
| Answerable: wrong | 22.3% | **14.7%** |
| Token F1 / key facts | 81.7% / 81.5% | **86.2% / 82.9%** |
| Skill questions right | 56/76 | **68/76** |
| Should-refuse questions refused | 95.5% | 95.5% |

Train loss reached ~0.02 while dev loss flattened at ~0.2 from epoch 30: still a variance gap,
and more epochs wouldn't close it. What was left:

- **Shortcut learning.** Nearly every training question starting with "Can…" asked for links
  ("Can I try X?"), so "Can you explain X?" got X's links (13 projects); "Was X recognized
  anywhere?" got links too (9). "What did he do at…" meant role, so "What does Answr do?" got
  a role. The model keyed on the opener, not the meaning — a dataset bias.
- **Bugs in the reference answers**, taught in training too: skill answers named only the first
  3 projects, in an order the model couldn't see; "ZapTap and ZapTap" (project and company);
  "won Presenter at Making Learning Visible (Dec 2025) (2025)".
- **A hole in the grounding check:** "Yes. Alfonso has used OpenAI API in PDF Chatbot (RAG) and
  Ask Alfonso" passed, because "Ask" is a common word and "Alfonso" is always allowed.
- **Site data:** `skills.ts` didn't link several projects whose stack uses the skill (e.g.
  PyTorch → Ask Alfonso), so the site and the chatbot under-reported them.

### v4: what changed

1. **Reference answers** (`qa.py`): a skill answer names every project, once, in the order the
   skill chunk lists them; award wording fixed. Dev/test *questions* are unchanged; their
   reference answers got the same fixes.
2. **Openers spread across intents** (`OPENER_TEMPLATES`): "Can you…", "Could you…", "Was…" and
   "What does…" now appear in most question types, so they no longer predict the answer type.
3. **Near-copy filter** (`train_only`): a training phrasing whose words overlap a dev/test
   phrasing of the same intent by Jaccard ≥ 0.6 is dropped ("How big was the {t} team?" vs the
   test's "How big was the team for {t}?"). It flagged 33 phrasings; the exact copies were
   already excluded by `dedupe()`, but the near ones (some from v2) had been in training, so
   v1–v3 dev numbers were a little optimistic. A few semantic near-copies were removed by hand.
4. **Whole-name grounding** (`guardrails.unsupported_names`): any project, company, school or
   event named in a factual answer must appear in the context as a whole phrase.
5. **`skills.ts` synced** with project stacks, and `build_dataset.py` now warns when they drift.

v4 is the last training round before the final evaluation. Because the openers and fixes came
from reading dev errors, dev is now optimistic; the untouched test set decides (Phase 6).

### v4 results and error analysis

Full pipeline on dev, τ = 0.10 (all on v4's corrected reference answers):

| | v3 | v4 | v4 + v5 retrieval |
|---|---|---|---|
| Answerable: exact match | ~72% | 83.4% | **84.4%** |
| Answerable: wrong | ~20% | 13.7% | 13.7% |
| Token F1 / key facts | 83.8% / 81.0% | 87.5% / 85.3% | **88.4% / 86.3%** |
| Should-refuse questions refused | 95.5% | **100%** | **100%** |
| Answered with something not in the context | 4.5% | **0%** | **0%** |

The fixes worked: the openers that v3 mapped to links ("Can you explain X?", "Was X recognized
anywhere?") mostly don't anymore, and no answer to a should-refuse question got through.

**What's left is one kind of error.** Every remaining mistake had the right chunk in its context,
and they come in blocks: each *unseen phrasing* is either right for every project or wrong for
every project. "What need does X address?" → overview (7 projects); "Can you explain X?" →
problem or role (7); "What did Alfonso build in X?" → role (4); "What has he accomplished at
C?" → dates (4). With 27 held-out phrasings, dev is really measuring ~27 coin flips, each worth
about 4 points — a noisy number, and the reason test (27 *other* phrasings) is the one to trust.

These aren't fixable with more templates without tuning on dev. They're about word meaning
("need … address" ≈ "problem … solve"), which comes from reading a lot of language.

**Retrieval regression, fixed without retraining.** Syncing `skills.ts` gave many more project
chunks technology entities, and "Does he know Streamlit?" boosted six projects as much as the
skill chunk (ranked 6th). v5 retrieval splits entities into names (+0.6) and technologies (+0.4 on
skill chunks, +0.25 elsewhere), tuned on *train* questions: dev recall@1 78% → 91%, recall@3 100%.

### v5: what changed

1. **A model 3× bigger** (6 layers, 6 heads, 384-dim, ~12M parameters).
2. **Much more pretraining:** ~120 MB of WikiText-103 (~50M tokens), 20,000 steps, peak LR 6e-4,
   resumable every 500 steps, tokens cached. Saved once as `pretrained.pt` and shared.
3. **Two fine-tuning runs** from the same pretrained weights: LR 5e-4 (gentler, keeps more of the
   pretraining) and 1e-3 (v1–v4's). The pipeline picks between them, and v4, on dev.
4. **Mixed precision on the T4** (float16 with loss scaling): tensor cores make it 2–3× faster.

### v5 results: bigger isn't better here — and dev was flattering us

Full pipeline, τ = 0.10, same code for every model:

| | Dev: exact | Dev: refusals | **Stress set: exact** | Size |
|---|---|---|---|---|
| **v4** (4 layers, 256-dim, WikiText-2) | **84.4%** | **100%** | **62.7%** | 3.9M params |
| v5a (6 layers, 384-dim, WikiText-103, LR 5e-4) | 81.0% | 95.5% | 51.7% | 11.7M params |
| v5b (same, LR 1e-3) | 79.1% | 93.2% | 54.1% | 11.7M params |

Pretraining worked as language modeling (Wikipedia loss 7.7 → 2.1; fine-tuning dev loss 0.10 vs
v4's 0.18), but the bigger model memorized the training phrasings faster (best epoch 16 vs 60)
and generalized *worse* to new wording. v4 stays the best model.

**The stress set** (`askalfonso/stress.py`, `ml/data/qa/stress.jsonl`): 453 questions, ~85 new
phrasings that no model trained on and that are checked to be far from every train/dev/test
phrasing. It exists because dev has only ~27 held-out phrasings and every model either gets a
phrasing right for all projects or wrong for all of them — so dev moves in ~4-point jumps. On
the stress set v4 handles 47 of 83 phrasings; v5a handles 38 (34 overlap).

**The honest number is lower than dev said.** v4 scores 84% on dev but 63% on phrasings nobody
tuned for. Five rounds of error analysis on dev made dev optimistic — exactly the risk *Structuring
ML Projects* warns about when a dev set is reused to make many decisions. That's why test was
never touched: it gives the unbiased number in Phase 6.
