"""Builds each training epoch: real Q&A + fresh synthetic Q&A, each with a sampled context.

What the model sees at inference (Phase 5): the retriever returns the top few
chunks for the question — usually the right one, sometimes plus an unrelated
one, and for off-topic questions only unrelated ones. Training mimics that:

    fact / skill question  → its gold chunk(s), plus a random distractor 50% of the time
    refusal question       → 1–2 random (irrelevant) chunks, or no context at all

Shuffling the chunks and resampling distractors every epoch means the model can't
rely on *where* the answer is or on a fixed context: it has to read.
"""

from __future__ import annotations

import random
from dataclasses import dataclass

from .data import Encoded, encode_example
from .knowledge import Knowledge
from .synthetic import synthetic_examples
from .tokenizer import BPETokenizer

CONTEXT_SEPARATOR = "\n"


def build_context(chunk_ids: list[str], chunks: dict[str, str]) -> str:
    return CONTEXT_SEPARATOR.join(chunks[c] for c in chunk_ids)


@dataclass
class ContextPolicy:
    distractor_prob: float = 0.5  # chance a fact question also gets an irrelevant chunk
    refusal_empty_prob: float = 0.3  # chance a refusal question gets no context at all
    max_chunks: int = 3


def sample_context(
    gold: list[str], chunks: dict[str, str], rng: random.Random, policy: ContextPolicy
) -> list[str]:
    """Pick the chunk ids to show for one example (order is shuffled)."""
    others = [cid for cid in chunks if cid not in gold]
    if gold:
        picked = list(gold[: policy.max_chunks])
        if len(picked) < policy.max_chunks and rng.random() < policy.distractor_prob:
            picked.append(rng.choice(others))
    else:
        if rng.random() < policy.refusal_empty_prob:
            return []
        picked = rng.sample(others, rng.choice([1, 2]))
    rng.shuffle(picked)
    return picked


def fit_example(
    tok: BPETokenizer,
    chunk_ids: list[str],
    gold: list[str],
    chunks: dict[str, str],
    question: str,
    answer: str,
    max_len: int,
) -> tuple[Encoded, list[str]] | None:
    """Encode an example, dropping distractors (then extra gold chunks) until it fits the window.

    Returns the encoded example and the chunk ids that actually made it into the context.
    """
    ids = list(chunk_ids)
    while True:
        enc = encode_example(tok, build_context(ids, chunks), question, answer, max_len)
        if enc is not None:
            return enc, ids
        distractors = [c for c in ids if c not in gold]
        if distractors:
            ids.remove(distractors[-1])
        elif len(ids) > 1:
            ids.pop()  # keep the first gold chunk, which carries most of the answer
        else:
            return None


class EpochBuilder:
    """Produces a new, freshly sampled list of training examples every epoch."""

    def __init__(
        self,
        tok: BPETokenizer,
        kb: Knowledge,
        rows: list[dict],
        chunks: dict[str, str],
        max_len: int,
        synthetic_projects: int,
        banned_tech: set[str],
        policy: ContextPolicy | None = None,
        seed: int = 0,
    ):
        self.tok, self.kb, self.rows, self.chunks = tok, kb, rows, chunks
        self.max_len = max_len
        self.synthetic_projects = synthetic_projects
        self.banned_tech = banned_tech
        self.policy = policy or ContextPolicy()
        self.rng = random.Random(seed)
        self.skipped = 0

    def build(self) -> list[Encoded]:
        out: list[Encoded] = []
        for row in self.rows:
            ids = sample_context(row["gold_chunks"], self.chunks, self.rng, self.policy)
            self._add(out, ids, row["gold_chunks"], self.chunks, row["question"], row["answer"])

        if self.synthetic_projects:
            examples, fake_chunks = synthetic_examples(self.kb, self.synthetic_projects, self.rng, self.banned_tech)
            # Distractors for fake projects can be real chunks or other fake ones.
            pool = {**self.chunks, **fake_chunks}
            for ex in examples:
                ids = sample_context(ex.gold_chunks, pool, self.rng, self.policy)
                self._add(out, ids, ex.gold_chunks, pool, ex.question, ex.answer)

        self.rng.shuffle(out)
        return out

    def _add(self, out, ids, gold, chunks, question, answer) -> None:
        fitted = fit_example(self.tok, ids, gold, chunks, question, answer, self.max_len)
        if fitted is None:
            self.skipped += 1
        else:
            out.append(fitted[0])


def eval_examples(
    tok: BPETokenizer, rows: list[dict], chunks: dict[str, str], max_len: int, seed: int = 1234
) -> list[tuple[dict, list[str], Encoded]]:
    """Fixed contexts for dev/test (same seed every time), so scores are comparable across runs."""
    rng = random.Random(seed)
    policy = ContextPolicy()
    out = []
    for row in rows:
        ids = sample_context(row["gold_chunks"], chunks, rng, policy)
        fitted = fit_example(tok, ids, row["gold_chunks"], chunks, row["question"], row["answer"], max_len)
        if fitted is not None:
            enc, used = fitted
            out.append((row, used, enc))
    return out
