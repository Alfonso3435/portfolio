"""Tests for the BPE tokenizer. Run from the repo root:

    python -m unittest discover -s ml/tests -t ml
"""

from __future__ import annotations

import re
import tempfile
import unittest
from pathlib import Path

from askalfonso.prompt import ANSWER, CONTEXT, END, SPECIAL_TOKENS, build_example
from askalfonso.tokenizer import SPLIT_PATTERN, BPETokenizer, count_pairs, merge

TRICKY = [
    "Hello, world!",
    "Tecnológico de Monterrey · CO₂ · naïve café",
    "emoji 🚀🤖 and 中文",
    "snake_case_name and youtu.be/BZy_tlWKUmU",
    "tabs\tand\nnew\n\nlines   and  spaces ",
    "numbers 2025, 97.33% and 100+",
    "",
]


def tiny_tokenizer(vocab_size: int = 300) -> BPETokenizer:
    tok = BPETokenizer(special_tokens=SPECIAL_TOKENS)
    text = "the cat sat on the mat. the cat ate the rat. " * 20
    tok.train([text], vocab_size=vocab_size)
    return tok


class HelperTests(unittest.TestCase):
    def test_count_pairs(self):
        self.assertEqual(count_pairs([1, 2, 3, 1, 2]), {(1, 2): 2, (2, 3): 1, (3, 1): 1})

    def test_merge(self):
        self.assertEqual(merge([1, 2, 3, 1, 2], (1, 2), 9), [9, 3, 9])
        self.assertEqual(merge([1, 1, 1], (1, 1), 9), [9, 1])  # non-overlapping, left to right

    def test_pattern_never_drops_characters(self):
        # If the regex skipped a character, encoding would silently lose text.
        pattern = re.compile(SPLIT_PATTERN)
        for text in TRICKY:
            self.assertEqual("".join(pattern.findall(text)), text)


class BPETests(unittest.TestCase):
    def test_classic_example(self):
        # The textbook BPE example: the first merge must be the most frequent pair, "aa".
        tok = BPETokenizer()
        tok.train(["aaabdaaabac"], vocab_size=257, min_frequency=1)
        self.assertEqual(tok.vocab[256], b"aa")

    def test_round_trip_untrained(self):
        tok = BPETokenizer()
        for text in TRICKY:
            self.assertEqual(tok.decode(tok.encode(text)), text)

    def test_round_trip_trained(self):
        tok = tiny_tokenizer()
        for text in TRICKY:
            self.assertEqual(tok.decode(tok.encode(text)), text)

    def test_merges_compress(self):
        tok = tiny_tokenizer()
        text = "the cat sat on the mat"
        self.assertLess(len(tok.encode(text)), len(text.encode("utf-8")))

    def test_frequent_word_becomes_one_token(self):
        tok = tiny_tokenizer()
        self.assertEqual(tok.tokens(" cat"), [" cat"])

    def test_special_tokens_are_single_ids_after_vocab(self):
        tok = tiny_tokenizer()
        ids = tok.encode(build_example("ctx", "q?", "a."))
        self.assertEqual(ids[0], tok.token_id(CONTEXT))
        self.assertEqual(ids[-1], tok.token_id(END))
        self.assertIn(tok.token_id(ANSWER), ids)
        bpe_size = 256 + len(tok.merges)
        self.assertEqual(sorted(tok.special_tokens.values()), list(range(bpe_size, bpe_size + len(SPECIAL_TOKENS))))
        self.assertEqual(tok.vocab_size, bpe_size + len(SPECIAL_TOKENS))

    def test_special_token_text_is_not_split(self):
        tok = tiny_tokenizer()
        self.assertEqual(tok.encode(END), [tok.token_id(END)])

    def test_training_is_deterministic(self):
        self.assertEqual(tiny_tokenizer().merges, tiny_tokenizer().merges)

    def test_save_and_load(self):
        tok = tiny_tokenizer()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "tok.json"
            tok.save(path)
            loaded = BPETokenizer.load(path)
        self.assertEqual(loaded.merges, tok.merges)
        self.assertEqual(loaded.special_tokens, tok.special_tokens)
        for text in TRICKY:
            self.assertEqual(loaded.encode(text), tok.encode(text))

    def test_partial_utf8_decodes_safely(self):
        tok = BPETokenizer()
        first_byte_of_o_acute = "ó".encode("utf-8")[0]
        self.assertEqual(tok.decode([first_byte_of_o_acute]), "�")  # "�", not a crash


if __name__ == "__main__":
    unittest.main()
