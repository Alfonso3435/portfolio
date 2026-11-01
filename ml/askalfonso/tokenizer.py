"""Byte-level BPE tokenizer, written from scratch (the same algorithm family as GPT-2/GPT-4).

Why a tokenizer at all?
    A neural network works with integers, not text. A tokenizer maps text to a
    list of ids and back. The choice matters: shorter sequences mean the model
    sees more text per context window and trains faster.

Why bytes?
    Starting from the 256 possible byte values means *any* text can be encoded —
    accents ("Tecnológico"), subscripts ("CO₂"), emoji — with no "unknown" token.

Why BPE (Byte Pair Encoding)?
    Start with single bytes, then repeatedly find the most frequent adjacent pair
    of tokens in the training text and merge it into a new token. Frequent words
    ("Alfonso", " project") end up as one token; rare words still work as several.

    Example on "aaabdaaabac":
        most frequent pair "aa" → Z:   ZabdZabac
        most frequent pair "Za" → Y:   YbdYbac
        most frequent pair "Yb" → X:   XdXac
"""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path
from typing import Iterable

# Pre-tokenization (same idea as GPT-2): split text into word-like pieces *before*
# BPE, so merges never cross word boundaries ("on." and "on," share the token "on").
#   's 't 're…      English contractions
#   ' ?[^\W\d_]+'   a word made of letters (any language), with its leading space
#   ' ?\d{1,3}'     numbers in groups of up to 3 digits (2025 -> "202", "5")
#   ' ?(?:[^\s\w]|_)+'  punctuation and symbols (incl. "_"), with its leading space
#   '\s+(?!\S)|\s+' runs of whitespace (newlines, indentation)
SPLIT_PATTERN = r"""'(?:s|t|re|ve|m|ll|d)| ?[^\W\d_]+| ?\d{1,3}| ?(?:[^\s\w]|_)+|\s+(?!\S)|\s+"""

Pair = tuple[int, int]


def count_pairs(ids: list[int], counts: Counter | None = None, weight: int = 1) -> Counter:
    """How often each adjacent pair appears: [1, 2, 3, 1, 2] -> {(1,2): 2, (2,3): 1, (3,1): 1}."""
    counts = Counter() if counts is None else counts
    for pair in zip(ids, ids[1:]):
        counts[pair] += weight
    return counts


def merge(ids: list[int], pair: Pair, new_id: int) -> list[int]:
    """Replace every occurrence of `pair` with `new_id`: merge([1,2,3,1,2], (1,2), 9) -> [9,3,9]."""
    out, i = [], 0
    while i < len(ids):
        if i < len(ids) - 1 and ids[i] == pair[0] and ids[i + 1] == pair[1]:
            out.append(new_id)
            i += 2
        else:
            out.append(ids[i])
            i += 1
    return out


class BPETokenizer:
    def __init__(self, merges: list[Pair] | None = None, special_tokens: list[str] | None = None):
        self.pattern = re.compile(SPLIT_PATTERN)
        self.merges: dict[Pair, int] = {}  # (a, b) -> new id, in the order they were learned
        self.vocab: dict[int, bytes] = {i: bytes([i]) for i in range(256)}
        for pair in merges or []:
            self._add_merge(pair)
        self.special_tokens: dict[str, int] = {}
        for token in special_tokens or []:
            self.add_special_token(token)
        self._cache: dict[str, list[int]] = {}

    # ── vocabulary ───────────────────────────────────────────────────────────

    @property
    def vocab_size(self) -> int:
        return len(self.vocab) + len(self.special_tokens)

    def _add_merge(self, pair: Pair) -> int:
        new_id = 256 + len(self.merges)
        self.merges[pair] = new_id
        self.vocab[new_id] = self.vocab[pair[0]] + self.vocab[pair[1]]
        return new_id

    def add_special_token(self, token: str) -> int:
        """Special tokens get their own ids after the BPE vocabulary and are never split."""
        if token not in self.special_tokens:
            self.special_tokens[token] = len(self.vocab) + len(self.special_tokens)
            self._special_re = re.compile("(" + "|".join(re.escape(t) for t in self.special_tokens) + ")")
        return self.special_tokens[token]

    def token_id(self, token: str) -> int:
        return self.special_tokens[token]

    # ── training ─────────────────────────────────────────────────────────────

    def train(self, texts: Iterable[str], vocab_size: int, min_frequency: int = 2, verbose: bool = False) -> None:
        """Learn merges until the BPE vocabulary (bytes + merges) reaches `vocab_size`.

        Efficiency trick: instead of scanning the whole text on every merge, count
        each distinct pre-token once ("the" appears 900 times → one entry, weight
        900). Pair counts are weighted by those frequencies.
        """
        if self.merges:
            raise ValueError("This tokenizer is already trained.")
        if vocab_size <= 256:
            raise ValueError("vocab_size must be > 256 (the byte alphabet).")

        word_freq: Counter = Counter()
        for text in texts:
            for piece in self._split_specials(text):
                if piece not in self.special_tokens:
                    word_freq.update(self.pattern.findall(piece))
        words = [(list(w.encode("utf-8")), freq) for w, freq in word_freq.items()]

        for step in range(vocab_size - 256):
            counts: Counter = Counter()
            for ids, freq in words:
                count_pairs(ids, counts, freq)
            if not counts:
                break
            pair, freq = max(counts.items(), key=lambda kv: (kv[1], -kv[0][0], -kv[0][1]))  # ties: deterministic
            if freq < min_frequency:
                break  # remaining pairs are one-offs; merging them would just memorize
            new_id = self._add_merge(pair)
            words = [(merge(ids, pair, new_id), f) for ids, f in words]
            if verbose and (step < 10 or (step + 1) % 250 == 0):
                print(f"  merge {step + 1:>5}: {self.vocab[pair[0]]!r} + {self.vocab[pair[1]]!r} -> {self.vocab[new_id]!r} ({freq}×)")

        # Special ids sit right after the BPE vocabulary, so renumber them now that it's final.
        names = list(self.special_tokens)
        self.special_tokens = {}
        for name in names:
            self.add_special_token(name)
        self._cache.clear()

    # ── encoding / decoding ──────────────────────────────────────────────────

    def _split_specials(self, text: str) -> list[str]:
        if not self.special_tokens:
            return [text]
        return [p for p in self._special_re.split(text) if p]

    def _encode_piece(self, piece: str) -> list[int]:
        """Apply learned merges to one pre-token, earliest-learned merge first (like training did)."""
        if piece in self._cache:
            return self._cache[piece]
        ids = list(piece.encode("utf-8"))
        while len(ids) >= 2:
            pair = min(zip(ids, ids[1:]), key=lambda p: self.merges.get(p, float("inf")))
            if pair not in self.merges:
                break
            ids = merge(ids, pair, self.merges[pair])
        if len(self._cache) < 50_000:
            self._cache[piece] = ids
        return ids

    def encode(self, text: str) -> list[int]:
        ids: list[int] = []
        for part in self._split_specials(text):
            if part in self.special_tokens:
                ids.append(self.special_tokens[part])
            else:
                for piece in self.pattern.findall(part):
                    ids.extend(self._encode_piece(piece))
        return ids

    def decode(self, ids: Iterable[int]) -> str:
        by_id = {i: t.encode("utf-8") for t, i in self.special_tokens.items()}
        data = b"".join(by_id[i] if i in by_id else self.vocab[i] for i in ids)
        # A model can emit half of a multi-byte character; show "�" instead of crashing.
        return data.decode("utf-8", errors="replace")

    def tokens(self, text: str) -> list[str]:
        """Human-readable pieces, for debugging and the Lab page: ['Does', ' he', ' know', …].

        A token can be *part* of a character: "ó" is 2 bytes in UTF-8, and if the
        tokenizer never merged them, each byte is its own token. Those show as <C3>.
        """
        pieces = []
        for i in self.encode(text):
            if i in self.vocab:
                try:
                    pieces.append(self.vocab[i].decode("utf-8"))
                except UnicodeDecodeError:
                    pieces.append("".join(f"<{b:02X}>" for b in self.vocab[i]))
            else:
                pieces.append(self.decode([i]))
        return pieces

    # ── persistence ──────────────────────────────────────────────────────────

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "type": "byte-level-bpe",
            "version": 1,
            "pattern": SPLIT_PATTERN,
            "merges": [list(p) for p in self.merges],
            "special_tokens": list(self.special_tokens),
        }
        path.write_text(json.dumps(data) + "\n", encoding="utf-8")

    @classmethod
    def load(cls, path: Path) -> "BPETokenizer":
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("type") != "byte-level-bpe" or data.get("pattern") != SPLIT_PATTERN:
            raise ValueError(f"{path} was saved by an incompatible tokenizer version.")
        return cls([tuple(p) for p in data["merges"]], data["special_tokens"])


class CharTokenizer:
    """The simplest possible tokenizer: one id per character. Used only as a baseline."""

    def __init__(self, texts: Iterable[str]):
        chars = sorted({c for t in texts for c in t})
        self.stoi = {c: i for i, c in enumerate(chars)}

    @property
    def vocab_size(self) -> int:
        return len(self.stoi)

    def encode(self, text: str) -> list[int]:
        return [self.stoi[c] for c in text if c in self.stoi]
