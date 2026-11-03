"""Guardrails: cheap, rule-based checks around the model that keep Ask Alfonso honest.

A 4M-parameter model will sometimes say something confident and wrong. Rather than
hope it doesn't, we wrap it in checks that are easy to reason about:

    question ─▶ [1] private-topic guard ──(blocked)──▶ polite private refusal
                       │
                       ▼
               retrieval + model
                       │
                       ▼
               [2] output checks ──(failed)──▶ safe fallback
                  • finished?   the model wrote <|end|> instead of rambling on
                  • repetition? no phrase repeated over and over
                  • no context? then only a refusal or a greeting is acceptable
                  • grounded?   every name and number in a fact appears in the
                                context (in a refusal: in the question)
                  • on topic?   "Yes, he has used X" names the X that was asked
                  • names?      every project/company/school named in a fact is in
                                the context, as a whole phrase

The grounding check is the important one. "Describe QuantumChess." → "…a project
called Quirex…" names something that exists nowhere in what the model read, so it
gets replaced by the fallback. It can't catch every error — a real name from the
context used in the wrong place passes — but it turns the scariest failure, an
invented fact, into an honest "I'm not sure".

Pure Python with no PyTorch, so the same rules can be ported to TypeScript (Phase 7).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable

# ── [1] Private topics: refused before the model runs ─────────────────────────────
# The model was trained to refuse these, but a refusal it *usually* gets right isn't
# good enough for personal information. Patterns are narrow on purpose: "email
# address" or "what did he make at HackMX" must still reach the model.
PRIVATE_PATTERNS = [
    r"\bphone\b", r"\bcell ?phone\b", r"\bwhatsapp\b",
    r"\b(home|street|mailing|physical) address\b", r"\bwhere exactly\b", r"\bwhat street\b",
    r"\bhow old\b", r"\bhis age\b", r"\bdate of birth\b", r"\bbirthday\b", r"\bwhen was he born\b",
    r"\bmarried\b", r"\b(girl|boy)friend\b", r"\bwife\b", r"\bhusband\b", r"\bdating\b", r"\bis he single\b",
    r"\bparents\b", r"\b(mother|father|mom|dad|siblings?|brother|sister)\b",
    r"\breligio(n|us)\b", r"\bpolitic(s|al)\b",
    r"\bvisa\b", r"\bimmigration\b", r"\bcitizenship\b", r"\bgreen card\b",
    r"\bsocial security\b", r"\bssn\b", r"\bpassport\b",
    r"\bsalary\b", r"\bwages?\b", r"\bincome\b", r"\brevenue\b", r"\bnet worth\b", r"\bcredit score\b",
    r"\bhow much (money )?(does|do|did|is|will)\b.*\b(make|makes|earn|earns|paid|worth|charge)\b",
    r"\bget paid\b", r"\bhow much money\b",
]
_PRIVATE_RE = re.compile("|".join(PRIVATE_PATTERNS), re.IGNORECASE)


def is_private(question: str) -> bool:
    return bool(_PRIVATE_RE.search(question))


# ── [2] Output checks ─────────────────────────────────────────────────────────────
# Openings of the answers the model was trained to give when it shouldn't state a fact
# (see qa.py). With no retrieved context, only these are acceptable.
REFUSAL_PREFIXES = (
    "I don't have any information",
    "I don't know of a project",
    "I don't know that",
    "That's personal information",
    "I'm Ask Alfonso, and I only answer",
)
GREETING_PREFIX = "Hi! I'm Ask Alfonso"

# Words a capitalized token can be without being a "name" that needs grounding.
COMMON_CAPITALIZED = {"i", "i'm", "i've", "i'd", "yes", "no", "he", "his", "him", "it", "its", "the", "a", "an",
                      "this", "that", "you", "ask", "try", "hi", "for", "in", "on", "at", "and", "or", "of"}

# Generic acronyms that aren't names of anything.
GENERIC_ACRONYMS = {"ai", "ml", "llm", "llms", "api", "apis", "ui", "ux", "ceo", "cto", "it", "b.s", "m.s"}

# "June 2028" in an answer is grounded by "Jun 2028" in a chunk, and vice versa.
_MONTHS = {m: m[:3] for m in ["january", "february", "march", "april", "may", "june", "july", "august",
                                "september", "october", "november", "december"]}

# A token: letters/digits plus the symbols names use (Next.js, C++, C#, ESP32, alfonsovegasol.com/projects).
_TOKEN_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_+#./@'’-]*")


# "Yes. Alfonso has used X in …" / "Yes. X comes from his coursework…": a skill claim.
_SKILL_CLAIM_RE = re.compile(r"^Yes\. (?:Alfonso has used (?P<a>.+?) in |(?P<b>.+?) comes from his coursework)")


@dataclass
class Check:
    ok: bool
    reason: str = ""
    ungrounded: tuple[str, ...] = ()


def is_refusal(answer: str) -> bool:
    return answer.startswith(REFUSAL_PREFIXES)


def is_greeting(answer: str) -> bool:
    return answer.startswith(GREETING_PREFIX)


def _strip(token: str) -> str:
    token = token.rstrip(".,;:!?'’-").lstrip("'’")
    return re.sub(r"['’]s$", "", token)  # Alfonso's -> Alfonso


def _canon(token: str) -> str:
    """Comparison form: lowercase, months abbreviated ("June" == "Jun")."""
    low = token.lower()
    return _MONTHS.get(low, low)


def _token_set(text: str) -> set[str]:
    return {_canon(_strip(m.group(0))) for m in _TOKEN_RE.finditer(text)} | GENERIC_ACRONYMS


def name_like_tokens(answer: str) -> list[str]:
    """Tokens that look like names or facts: anything with a digit or a symbol, any
    capitalized word that doesn't start a sentence, and any word with inner capitals
    (IdentifEye, PyTorch) even at the start of a sentence."""
    out = []
    sentence_start = True
    for match in _TOKEN_RE.finditer(answer):
        raw = match.group(0)
        token = _strip(raw)
        if not token:
            continue
        has_digit = any(ch.isdigit() for ch in token)
        has_symbol = any(ch in "+#@/" for ch in token) or ("." in token and not token.endswith("."))
        inner_caps = any(ch.isupper() for ch in token[1:])
        capitalized = token[0].isupper() and token.lower() not in COMMON_CAPITALIZED
        if has_digit or has_symbol or inner_caps or (capitalized and not sentence_start):
            out.append(token)
        sentence_start = raw.endswith((".", "!", "?", ":")) or answer[match.end():match.end() + 1] in ".!?:"
    return out


def ungrounded_tokens(answer: str, sources: str) -> list[str]:
    """Name-like tokens of the answer that appear nowhere in `sources` (case-insensitive)."""
    # Whole tokens, not substrings: "10" must appear as a number, not inside "2010".
    known = _token_set(sources)
    return [t for t in name_like_tokens(answer) if _canon(t) not in known]


def is_repetitive(answer: str, n: int = 4, max_repeats: int = 2) -> bool:
    """True if any n-word phrase appears more than max_repeats times — a classic
    failure of small greedy decoders ("and React and React and React…")."""
    ws = answer.lower().split()
    counts: dict[tuple[str, ...], int] = {}
    for i in range(len(ws) - n + 1):
        gram = tuple(ws[i:i + n])
        counts[gram] = counts.get(gram, 0) + 1
        if counts[gram] > max_repeats:
            return True
    return False


def unsupported_names(answer: str, sources: str, known_names: Iterable[str]) -> list[str]:
    """Known names (projects, companies, schools, events) that a fact mentions but its
    sources don't. Checked as whole phrases: the word-level check lets "Ask Alfonso"
    through because "Ask" is a common word and "Alfonso" is always allowed — v3 said
    "Yes. Alfonso has used OpenAI API in … Ask Alfonso" with no Ask Alfonso chunk in sight."""
    low_answer, low_sources = answer.lower(), sources.lower()
    out = []
    for name in known_names:
        pattern = r"(?<![\w])" + re.escape(name.lower()) + r"(?![\w])"
        if re.search(pattern, low_answer) and not re.search(pattern, low_sources):
            out.append(name)
    return out


def check_answer(answer: str, finished: bool, context: str, question: str, allowlist: str,
                 known_names: Iterable[str] = ()) -> Check:
    if not answer:
        return Check(False, "empty")
    if not finished:
        return Check(False, "no_end")
    if is_repetitive(answer):
        return Check(False, "repetitive")
    if is_refusal(answer) or is_greeting(answer):
        # A refusal may name the thing it can't find ("…about Ruby…"): it must come from the question.
        missing = ungrounded_tokens(answer, " ".join([question, allowlist]))
        return Check(not missing, "ungrounded_refusal" if missing else "", tuple(missing))
    if not context:
        return Check(False, "fact_without_context")
    # A skill claim must be about the skill that was asked: "Has he used React Native?"
    # → "Yes. Alfonso has used Vercel in Answr" is grounded (Vercel is in the context)
    # but answers a different question.
    claim = _SKILL_CLAIM_RE.match(answer)
    if claim:
        skill = claim.group("a") or claim.group("b")
        asked = _token_set(question)
        if not any(_canon(_strip(m.group(0))) in asked for m in _TOKEN_RE.finditer(skill)):
            return Check(False, "off_question", (skill,))
    # Facts must come from the context, not the question: otherwise "Has he used React
    # Native?" → "Yes. Alfonso has used React Native…" would pass just by echoing it.
    missing = ungrounded_tokens(answer, " ".join([context, allowlist]))
    if missing:
        return Check(False, "ungrounded", tuple(missing))
    names = unsupported_names(answer, context, known_names)
    return Check(not names, "unsupported_name" if names else "", tuple(names))
