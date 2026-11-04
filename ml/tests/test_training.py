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


class RetrievalContextTests(unittest.TestCase):
    RECORDS = [
        {"id": "project/zaptap", "title": "ZapTap", "text": "ZapTap sells NFC cards built with Next.js.",
         "entities": ["ZapTap", "Next.js"]},
        {"id": "experience/zaptap", "title": "Founder at ZapTap", "text": "ZapTap is a business. Founder.",
         "entities": ["ZapTap"]},
        {"id": "project/skysar", "title": "SkySAR", "text": "SkySAR finds people from drone footage.",
         "entities": ["SkySAR"]},
        {"id": "skills/web", "title": "Full-stack", "text": "Next.js (used in ZapTap).", "entities": ["Next.js"]},
    ]

    def setUp(self):
        from askalfonso.retrieval import TfidfRetriever

        self.r = TfidfRetriever(self.RECORDS)

    def test_uses_what_the_retriever_selects(self):
        from askalfonso.training_data import retrieved_context

        ids = retrieved_context(self.r, "What is ZapTap?", ["project/zaptap"])
        self.assertEqual(ids[0], "project/zaptap")
        self.assertIn("experience/zaptap", ids)  # a *related* distractor, as at inference
        self.assertNotIn("project/skysar", ids)

    def test_missing_gold_is_added(self):
        from askalfonso.training_data import retrieved_context

        self.assertEqual(retrieved_context(self.r, "What is ZapTap?", ["project/skysar"], max_chunks=2)[-1],
                         "project/skysar")

    def test_refusal_gets_empty_context(self):
        from askalfonso.training_data import retrieved_context

        self.assertEqual(retrieved_context(self.r, "Does he know Haskell?", []), [])


class SyntheticTests(unittest.TestCase):
    def setUp(self):
        self.examples, self.chunks = synthetic_examples(tiny_knowledge(), 8, random.Random(3), banned_tech={"angular"})

    def test_only_train_templates_are_used(self):
        self.assertTrue(self.examples)
        self.assertTrue(all(ex.split == "train" for ex in self.examples))

    def test_banned_technologies_never_appear(self):
        self.assertTrue(all("Angular" not in c.text for c in self.chunks.values()))

    def test_answers_are_grounded_in_their_chunks(self):
        # Every technology named in a stack answer must appear in the gold chunk the model will read.
        for ex in self.examples:
            if ex.intent != "project.stack":
                continue
            context = " ".join(self.chunks[c].text for c in ex.gold_chunks)
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

    def test_held_out_question_beats_train_duplicate(self):
        # A new training phrasing must never remove a dev/test question.
        from askalfonso.qa import QA, dedupe

        train = QA("1", "x", "fact", "How did ZapTap turn out?", "a", [], "train")
        dev = QA("2", "x", "fact", "how did zaptap turn out", "a", [], "dev")
        self.assertEqual([e.split for e in dedupe([train, dev])], ["dev"])

    def test_casual_variants_depend_only_on_the_question(self):
        from askalfonso.qa import QA, add_casual_variants

        def make(extra: int) -> list[QA]:
            return [QA(str(i), "x", "fact", f"Question number {i}?", "a", [], "train") for i in range(extra)] + [
                QA("d", "x", "fact", f"Dev question {i}?", "a", [], "dev") for i in range(40)]

        small, big = make(10), make(500)
        add_casual_variants(small)
        add_casual_variants(big)
        self.assertEqual([e.question for e in small[-40:]], [e.question for e in big[-40:]])


class ScheduleTests(unittest.TestCase):
    def test_warmup_then_cosine_decay(self):
        from train import lr_at

        args = argparse.Namespace(lr=1e-3, min_lr=1e-4, warmup_steps=10)
        lrs = [lr_at(s, 100, args) for s in range(100)]
        self.assertLess(lrs[0], lrs[9])  # warming up
        self.assertAlmostEqual(lrs[9], 1e-3)  # peak at the end of warmup
        self.assertTrue(all(a >= b for a, b in zip(lrs[10:], lrs[11:])))  # then only decreasing
        self.assertAlmostEqual(lr_at(100, 100, args), 1e-4)  # ends at min_lr



class TemplateLeakTests(unittest.TestCase):
    def test_near_duplicates_of_held_out_phrasings_are_dropped(self):
        from askalfonso.qa import near_duplicate, train_only

        self.assertTrue(near_duplicate("How big was the {t} team?", "How big was the team for {t}?"))
        self.assertFalse(near_duplicate("Can you tell me about {t}?", "Can you explain {t}?"))
        kept = train_only(["How big was the {t} team?", "Who did he build {t} with?"],
                          ["Did he work alone on {t}?", "How big was the team for {t}?"])
        self.assertEqual(kept, ["Who did he build {t} with?"])


class ReferenceAnswerTests(unittest.TestCase):
    """v4 fixes to the answers the model learns from."""

    def kb(self):
        return Knowledge({
            "schemaVersion": 1,
            "profile": {"shortName": "Alfonso", "email": "a@b.c", "assistantName": "Ask Alfonso"},
            "experience": [{"id": "zaptap", "company": "ZapTap", "role": "Founder", "summary": "shop.",
                            "dates": {"start": "2026-08"}, "highlights": [], "stack": ["React"]}],
            "projects": [
                {"slug": p, "title": t, "pitch": "x.", "problem": "y.", "built": ["z"], "role": "Dev",
                 "stack": ["React"], "status": "shipped", "categories": [], "featured": False, "links": {},
                 "results": [], "awardId": a}
                for p, t, a in [("zaptap", "ZapTap", None), ("one", "One", None), ("two", "Two", None),
                                ("three", "Three", "mlv"), ("four", "Four", "hack")]],
            "awards": [
                {"id": "mlv", "kind": "recognition", "placement": "Presenter", "title": "MLV",
                 "event": "Making Learning Visible (Dec 2025)", "year": 2025, "organizer": "BC",
                 "projectSlug": "three", "summary": "Presented it."},
                {"id": "hack", "kind": "win", "placement": "1st Place", "title": "H", "event": "HackMX",
                 "year": 2025, "organizer": "Tec", "projectSlug": "four", "summary": "Won it."}],
            "skillGroups": [{"name": "Web", "skills": [
                {"name": "React", "projectSlugs": ["zaptap", "one", "two", "three", "four"]}]}],
            "certifications": [],
        })

    def answers(self, intent: str) -> dict[str, str]:
        from askalfonso.qa import QAGenerator

        gen = QAGenerator(self.kb())
        gen._projects()
        gen._skills()
        return {ex.question: ex.answer for ex in gen.examples if ex.intent == intent}

    def test_skill_answer_lists_every_project_once(self):
        answer = next(iter(self.answers("skill.has").values()))
        self.assertEqual(answer, "Yes. Alfonso has used React in ZapTap, One, Two, Three and Four.")

    def test_award_answers(self):
        got = set(self.answers("project.award").values())
        self.assertIn("Yes. Four won 1st Place at HackMX (2025).", got)
        self.assertIn("Yes. Three was featured at Making Learning Visible (Dec 2025), where Alfonso was a presenter.",
                      got)



class StressSetTests(unittest.TestCase):
    def test_stress_phrasings_are_new(self):
        from askalfonso.qa import QAGenerator, near_duplicate
        from askalfonso.stress import STRESS_TEMPLATES, _StressGenerator

        kb = ReferenceAnswerTests().kb()
        gen = _StressGenerator(kb)
        gen._projects()
        stress = [ex for ex in gen.examples if ex.split == "stress"]
        self.assertTrue(stress)
        # Every stress phrasing that was kept is far from every train/dev/test phrasing…
        for intent, dataset_phrasings in gen.dataset_templates.items():
            kept = [t for t in STRESS_TEMPLATES.get(intent, []) if (intent, t) not in gen.dropped]
            for t in kept:
                self.assertFalse(any(near_duplicate(t, d) for d in dataset_phrasings), (intent, t))
        # …and no stress question is literally a dataset question.
        real = QAGenerator(kb)
        real._projects()
        self.assertFalse({ex.question.lower() for ex in stress} & {ex.question.lower() for ex in real.examples})


if __name__ == "__main__":
    unittest.main()
