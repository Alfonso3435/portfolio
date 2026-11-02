"""Tests for training data (contexts, synthetic data) and the LR schedule.

    python -m unittest discover -s ml/tests -t ml
"""

from __future__ import annotations

import argparse
import importlib.util
import random
import unittest

if importlib.util.find_spec("torch") is None:
    raise unittest.SkipTest("PyTorch is not installed")

from askalfonso.knowledge import Knowledge
from askalfonso.prompt import SPECIAL_TOKENS
from askalfonso.synthetic import TECH_POOL, synthetic_examples, synthetic_refusals
from askalfonso.tokenizer import BPETokenizer
from askalfonso.training_data import ContextPolicy, fit_example, sample_context

CHUNKS = {f"c{i}": f"chunk number {i} " * 5 for i in range(10)}


def tiny_knowledge() -> Knowledge:
    return Knowledge({
        "schemaVersion": 1,
        "profile": {"shortName": "Alfonso", "email": "a@b.c", "assistantName": "Ask Alfonso"},
        "experience": [], "projects": [], "awards": [], "skillGroups": [], "certifications": [],
    })


class ContextTests(unittest.TestCase):
    def test_fact_context_always_contains_gold(self):
        rng = random.Random(0)
        for _ in range(200):
            ids = sample_context(["c1", "c2"], CHUNKS, rng, ContextPolicy())
            self.assertTrue({"c1", "c2"} <= set(ids))
            self.assertLessEqual(len(ids), 3)

    def test_refusal_context_never_contains_a_gold_chunk(self):
        rng = random.Random(0)
        sizes = {len(sample_context([], CHUNKS, rng, ContextPolicy())) for _ in range(200)}
        self.assertEqual(sizes, {0, 1, 2})  # sometimes empty, sometimes 1–2 irrelevant chunks

    def test_fit_drops_distractors_before_gold(self):
        tok = BPETokenizer(special_tokens=SPECIAL_TOKENS)
        chunks = {"gold": "short gold fact.", "noise": "irrelevant text " * 40}
        fitted = fit_example(tok, ["noise", "gold"], ["gold"], chunks, "q?", "a.", max_len=120)
        self.assertIsNotNone(fitted)
        self.assertEqual(fitted[1], ["gold"])


class SyntheticTests(unittest.TestCase):
    def setUp(self):
        self.examples, self.chunks = synthetic_examples(tiny_knowledge(), 8, random.Random(3), banned_tech={"angular"})

    def test_only_train_templates_are_used(self):
        self.assertTrue(self.examples)
        self.assertTrue(all(ex.split == "train" for ex in self.examples))

    def test_banned_technologies_never_appear(self):
        self.assertTrue(all("Angular" not in text for text in self.chunks.values()))

    def test_answers_are_grounded_in_their_chunks(self):
        # Every technology named in a stack answer must appear in the gold chunk the model will read.
        for ex in self.examples:
            if ex.intent != "project.stack":
                continue
            context = " ".join(self.chunks[c] for c in ex.gold_chunks)
            for tech in TECH_POOL:
                if f" {tech}," in f" {ex.answer}" or f" {tech}." in ex.answer:
                    self.assertIn(tech, context)

    def test_names_change_every_call(self):
        _, other = synthetic_examples(tiny_knowledge(), 8, random.Random(4), banned_tech=set())
        self.assertNotEqual(set(self.chunks), set(other))


class SyntheticRefusalTests(unittest.TestCase):
    def test_refusals_name_the_unknown_thing_and_never_use_pool_tech(self):
        refusals = synthetic_refusals(tiny_knowledge(), random.Random(0), n_tech=20, n_projects=10, banned_tech=set())
        pool = {t.lower() for t in TECH_POOL}
        for ex in refusals:
            name = ex.id.split(":")[2]
            self.assertIn(name, ex.question)  # the model must copy it from the question…
            self.assertIn(name, ex.answer)  # …into the answer
            self.assertNotIn(name.lower(), pool)  # never contradicts a fake project in the context
            self.assertEqual(ex.gold_chunks, [])


class DedupeTests(unittest.TestCase):
    def test_same_question_keeps_first_answer(self):
        from askalfonso.qa import QA, dedupe

        a = QA("1", "x", "fact", "What is ZapTap?", "first", [], "train")
        b = QA("2", "y", "fact", "what is zaptap", "second", [], "train")
        self.assertEqual([e.answer for e in dedupe([a, b])], ["first"])


class ScheduleTests(unittest.TestCase):
    def test_warmup_then_cosine_decay(self):
        from train import lr_at

        args = argparse.Namespace(lr=1e-3, min_lr=1e-4, warmup_steps=10)
        lrs = [lr_at(s, 100, args) for s in range(100)]
        self.assertLess(lrs[0], lrs[9])  # warming up
        self.assertAlmostEqual(lrs[9], 1e-3)  # peak at the end of warmup
        self.assertTrue(all(a >= b for a, b in zip(lrs[10:], lrs[11:])))  # then only decreasing
        self.assertAlmostEqual(lr_at(100, 100, args), 1e-4)  # ends at min_lr


if __name__ == "__main__":
    unittest.main()
