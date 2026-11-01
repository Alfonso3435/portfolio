"""Small text helpers that turn the site's data fields into natural sentences.

The site's copy is written in Alfonso's own voice ("I'm looking for…") or as
sentence fragments ("Built an AI voice agent…"). The assistant always talks
*about* him, so these helpers rewrite that text in the third person.
"""

from __future__ import annotations

import re
import unicodedata

_FIRST_TO_THIRD = [
    (r"\bI'm\b", "he's"),
    (r"\bI am\b", "he is"),
    (r"\bI've\b", "he has"),
    (r"\bmyself\b", "himself"),
    (r"\bmy\b", "his"),
    (r"\bMy\b", "His"),
    (r"\bme\b", "him"),
    (r"\bI\b", "he"),
]


def capitalize_first(text: str) -> str:
    return text[:1].upper() + text[1:] if text else text


def lower_first(text: str) -> str:
    """'Built a site' -> 'built a site', but leaves acronyms alone ('AI agent', 'ESP32')."""
    if len(text) > 1 and text[1].isupper():
        return text
    return text[:1].lower() + text[1:]


def to_third_person(text: str) -> str:
    """'I'm looking for an internship in my field.' -> "He's looking for an internship in his field." """
    for pattern, repl in _FIRST_TO_THIRD:
        text = re.sub(pattern, repl, text)
    # Re-capitalize the start of every sentence after the swaps.
    return re.sub(r"(^|[.!?]\s+)([a-z])", lambda m: m.group(1) + m.group(2).upper(), text)


def as_he_sentence(fragment: str) -> str:
    """'Built an agent.' -> 'He built an agent.'; 'Working on X.' -> 'He is working on X.'"""
    first_word = fragment.split(" ", 1)[0]
    subject = "He is" if first_word.endswith("ing") else "He"
    return f"{subject} {lower_first(fragment)}"


def with_article(noun_phrase: str) -> str:
    """'AI automation agency…' -> 'an AI automation agency…'."""
    article = "an" if noun_phrase[:1].lower() in "aeiou" else "a"
    return f"{article} {lower_first(noun_phrase)}"


def ensure_period(text: str) -> str:
    text = text.strip()
    return text if text.endswith((".", "!", "?")) else f"{text}."


def join_list(items: list[str]) -> str:
    """['a', 'b', 'c'] -> 'a, b and c'."""
    items = [i for i in items if i]
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    return f"{', '.join(items[:-1])} and {items[-1]}"


MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def format_year_month(value: str) -> str:
    """'2025-10' -> 'Oct 2025'; '2025' -> '2025'. Mirrors src/lib/format.ts."""
    year, _, month = value.partition("-")
    return f"{MONTHS[int(month) - 1]} {year}" if month else year


def format_date_range(dates: dict) -> str:
    if dates.get("display"):
        return dates["display"]
    end = format_year_month(dates["end"]) if dates.get("end") else "Present"
    return f"{format_year_month(dates['start'])} — {end}"


def slugify(text: str) -> str:
    """'Tecnológico de Monterrey' -> 'tecnologico-de-monterrey'."""
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")


def format_long_year_month(value: str) -> str:
    """'2028-06' -> 'June 2028'."""
    long_months = ["January", "February", "March", "April", "May", "June", "July", "August",
                   "September", "October", "November", "December"]
    year, _, month = value.partition("-")
    return f"{long_months[int(month) - 1]} {year}" if month else year


def since_phrase(dates: dict) -> str:
    """{'start': '2026-10'} -> 'since Oct 2026'; with an end -> 'from Aug 2023 to Jan 2024'.

    Honors a custom label like 'Late 2025 — Present' -> 'since late 2025'.
    """
    if dates.get("end"):
        return f"from {format_year_month(dates['start'])} to {format_year_month(dates['end'])}"
    if dates.get("display"):
        # Custom labels are words ("Late 2025"), so lowercase them mid-sentence.
        return f"since {lower_first(dates['display'].split(' — ')[0])}"
    return f"since {format_year_month(dates['start'])}"


def degree_phrase(degree: str) -> str:
    """'B.S. Computer Science' -> 'a B.S. in Computer Science'."""
    for prefix in ("B.S. ", "B.A. ", "M.S. "):
        if degree.startswith(prefix):
            return f"a {prefix.strip()} in {degree[len(prefix):]}"
    return degree


def school_phrase(school: str) -> str:
    """'University of Washington — Paul G. Allen School…' -> "the University of Washington's Paul G. Allen School…"."""
    name, _, sub = school.partition(" — ")
    name = f"the {name}" if name.startswith("University") else name
    return f"{name}'s {sub}" if sub else name
