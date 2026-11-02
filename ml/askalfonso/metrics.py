"""Answer-quality metrics: exact match is strict, so we also report two softer ones.

    exact match   the whole answer equals the reference (case, spacing and a final
                  period ignored). "ESP32 / Arduino" for "ESP32" counts as wrong.
    token F1      word overlap between answer and reference, as in the SQuAD
                  benchmark: precision = shared words / answer words,
                  recall = shared words / reference words, F1 = their harmonic mean.
    key facts     every name and number of the reference (IdentifEye, 97.33, 2025…)
                  appears in the answer. Wording can differ; the facts can't.

None of them can tell a correct paraphrase from a wrong answer that reuses the right
words — that's what reading samples.txt (error analysis) is for.
"""

from __future__ import annotations

import re
from collections import Counter

from .guardrails import _canon, _strip, _token_set, name_like_tokens
from .inference import normalize


def exact_match(pred: str, ref: str) -> bool:
    return normalize(pred) == normalize(ref)


def _words(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def token_f1(pred: str, ref: str) -> float:
    p, r = _words(pred), _words(ref)
    if not p or not r:
        return float(p == r)
    shared = sum((Counter(p) & Counter(r)).values())
    if shared == 0:
        return 0.0
    precision, recall = shared / len(p), shared / len(r)
    return 2 * precision * recall / (precision + recall)


def key_facts(pred: str, ref: str) -> bool:
    """All names/numbers of the reference are in the answer (falls back to exact match
    when the reference has none, e.g. a plain problem statement)."""
    facts = name_like_tokens(ref)
    if not facts:
        return exact_match(pred, ref)
    have = _token_set(pred)
    return all(_canon(_strip(f)) in have for f in facts)


def score(pred: str, ref: str) -> dict[str, float]:
    return {"em": float(exact_match(pred, ref)), "f1": token_f1(pred, ref), "facts": float(key_facts(pred, ref))}
