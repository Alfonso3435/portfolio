"""Tests for the guardrails and the pipeline's decisions.

    python -m unittest discover -s ml/tests -t ml

The pipeline tests use a scripted fake model, so they check the *logic* (guard,
threshold, checks, fallback) without needing a trained checkpoint.
"""

from __future__ import annotations

import importlib.util
import unittest
from types import SimpleNamespace

from askalfonso.guardrails import (
    check_answer,
    is_private,
    is_repetitive,
    name_like_tokens,
    ungrounded_tokens,
)

ALLOW = "Ask Alfonso Alfonso a@b.co alfonsovegasol.com alfonsovegasol.com/projects HackMX"
CTX = "IdentifEye: visual product search. Stack: Vertex AI, OpenCV and Firebase. Results: 97.33% accuracy. Year: 2025."


class PrivateGuardTests(unittest.TestCase):
    def test_blocks_personal_questions(self):
        for q in ["What's his phone number?", "How old is he?", "Is he married?", "What's his salary?",
                  "How much does Answr make?", "What's his visa status?", "Where exactly does he live?"]:
            self.assertTrue(is_private(q), q)

    def test_lets_normal_questions_through(self):
        for q in ["What's his email address?", "What did he make at HackMX?", "Where is he based?",
                  "How much experience does he have with Python?", "Is there a single project with Rust?"]:
            self.assertFalse(is_private(q), q)


class TokenTests(unittest.TestCase):
    def test_name_like_tokens(self):
        tokens = name_like_tokens("Yes. Alfonso has used Next.js and React in ZapTap, in 2025.")
        self.assertEqual(tokens, ["Next.js", "React", "ZapTap", "2025"])  # "Alfonso" starts a sentence

    def test_sentence_start_words_are_not_names_unless_camel_case(self):
        self.assertEqual(name_like_tokens("The problem was hard. He fixed it."), [])
        self.assertEqual(name_like_tokens("IdentifEye won."), ["IdentifEye"])

    def test_grounding_uses_whole_tokens_and_months(self):
        self.assertEqual(ungrounded_tokens("It reached 97.33% in 2025.", CTX), [])
        self.assertEqual(ungrounded_tokens("It reached 99% in 2010.", CTX), ["99", "2010"])
        self.assertEqual(ungrounded_tokens("He graduates in June 2028.", "Expected graduation: Jun 2028."), [])

    def test_repetition(self):
        self.assertTrue(is_repetitive("and React and React and React and React and React"))
        self.assertFalse(is_repetitive("IdentifEye uses Vertex AI, OpenCV and Firebase."))


class CheckTests(unittest.TestCase):
    def test_grounded_fact_passes(self):
        self.assertTrue(check_answer("IdentifEye uses Vertex AI and OpenCV.", True, CTX, "q?", ALLOW).ok)

    def test_invented_name_fails(self):
        c = check_answer("IdentifEye uses PyTorch and Redis.", True, CTX, "What does IdentifEye use?", ALLOW)
        self.assertEqual((c.ok, c.reason, c.ungrounded), (False, "ungrounded", ("PyTorch", "Redis")))

    def test_facts_cannot_be_grounded_by_the_question(self):
        c = check_answer("Yes. Alfonso has used React Native in ZapTap.", True, "ZapTap: React.",
                         "Has he used React Native?", ALLOW)
        self.assertFalse(c.ok)

    def test_skill_claim_must_name_the_asked_skill(self):
        c = check_answer("Yes. Alfonso has used Firebase in IdentifEye.", True, CTX, "Has he used OpenCV?", ALLOW)
        self.assertEqual(c.reason, "off_question")
        self.assertTrue(check_answer("Yes. Alfonso has used OpenCV in IdentifEye.", True, CTX,
                                     "has he used opencv", ALLOW).ok)

    def test_refusal_must_name_what_was_asked(self):
        good = "I don't know of a project called QuantumChess in Alfonso's portfolio."
        bad = "I don't know of a project called Quirex in Alfonso's portfolio."
        self.assertTrue(check_answer(good, True, "", "Describe QuantumChess.", ALLOW).ok)
        self.assertEqual(check_answer(bad, True, "", "Describe QuantumChess.", ALLOW).reason, "ungrounded_refusal")

    def test_no_context_allows_only_refusals(self):
        self.assertEqual(check_answer("IdentifEye uses Vertex AI.", True, "", "q?", ALLOW).reason,
                         "fact_without_context")

    def test_unfinished_or_empty_answers_fail(self):
        self.assertEqual(check_answer("IdentifEye uses", False, CTX, "q?", ALLOW).reason, "no_end")
        self.assertEqual(check_answer("", True, CTX, "q?", ALLOW).reason, "empty")


@unittest.skipIf(importlib.util.find_spec("torch") is None, "PyTorch is not installed")
class PipelineTests(unittest.TestCase):
    """The pipeline with a fake model whose answers we script per question."""

    def make_bot(self, answers: dict[str, str]):
        from askalfonso.pipeline import AskAlfonso
        from askalfonso.prompt import SPECIAL_TOKENS
        from askalfonso.tokenizer import BPETokenizer

        chunks = [
            {"id": "project/identifeye", "title": "IdentifEye", "text": CTX, "entities": ["IdentifEye", "OpenCV"]},
            {"id": "project/zaptap", "title": "ZapTap", "text": "ZapTap: NFC review cards built with Next.js.",
             "entities": ["ZapTap", "Next.js"]},
        ]
        model = SimpleNamespace(cfg=SimpleNamespace(block_size=10_000))
        bot = AskAlfonso(model, BPETokenizer(special_tokens=SPECIAL_TOKENS), chunks, email="a@b.co",
                         facts={"project/identifeye": "alfonsovegasol.com/projects/identifeye"})
        bot.generate = lambda context, question: (answers[question], True)
        return bot

    def test_answer_with_sources(self):
        bot = self.make_bot({"What does IdentifEye use?": "IdentifEye uses Vertex AI and OpenCV."})
        reply = bot.ask("What does IdentifEye use?")
        self.assertEqual(reply.status, "answered")
        self.assertEqual(reply.sources[0].chunk_id, "project/identifeye")

    def test_private_question_never_reaches_the_model(self):
        bot = self.make_bot({})  # the fake model would KeyError if called
        self.assertEqual(bot.ask("What's his phone number?").status, "private")

    def test_low_confidence_means_empty_context(self):
        bot = self.make_bot({"Does he know Haskell?": "I don't have any information about Haskell in Alfonso's profile."})
        reply = bot.ask("Does he know Haskell?")
        self.assertEqual((reply.status, reply.debug["context_ids"]), ("refused", []))

    def test_hallucination_becomes_fallback(self):
        bot = self.make_bot({"What does IdentifEye use?": "IdentifEye uses PyTorch."})
        reply = bot.ask("What does IdentifEye use?")
        self.assertEqual(reply.status, "fallback")
        self.assertIn("a@b.co", reply.answer)

    def test_grounding_facts_count_as_grounded(self):
        bot = self.make_bot({"Is there a link to IdentifEye?":
                             "The full case study is at alfonsovegasol.com/projects/identifeye."})
        self.assertEqual(bot.ask("Is there a link to IdentifEye?").status, "answered")


if __name__ == "__main__":
    unittest.main()


@unittest.skipIf(importlib.util.find_spec("torch") is None, "PyTorch is not installed")
class MetricTests(unittest.TestCase):
    def test_scores(self):
        from askalfonso.metrics import key_facts, score, token_f1

        ref = "Yes. Alfonso has used ESP32 in Ambient-Detectors."
        self.assertEqual(score(ref, ref), {"em": 1.0, "f1": 1.0, "facts": 1.0})
        near = "Yes. Alfonso has used ESP32 / Arduino in Ambient-Detectors."
        self.assertEqual(score(near, ref)["em"], 0.0)
        self.assertTrue(key_facts(near, ref))  # every fact is there
        self.assertGreater(token_f1(near, ref), 0.8)
        self.assertFalse(key_facts("Yes. Alfonso has used ESP32 in SkySAR.", ref))
        self.assertEqual(token_f1("totally different", ref), 0.0)


class NameGroundingTests(unittest.TestCase):
    NAMES = ["Answr AI Agent", "Ask Alfonso", "PDF Chatbot (RAG)", "Answr", "ZapTap"]

    def test_names_must_appear_in_the_context(self):
        from askalfonso.guardrails import unsupported_names

        ctx = "OpenAI API (used in PDF Chatbot (RAG), IdentifEye)."
        answer = "Yes. Alfonso has used OpenAI API in PDF Chatbot (RAG) and Ask Alfonso."
        self.assertEqual(unsupported_names(answer, ctx, self.NAMES), ["Ask Alfonso"])

    def test_check_answer_rejects_the_v3_hallucination(self):
        ctx = "Alfonso's LLM Applications skills: OpenAI API (used in PDF Chatbot (RAG))."
        c = check_answer("Yes. Alfonso has used OpenAI API in PDF Chatbot (RAG) and Ask Alfonso.", True, ctx,
                         "Has he used the OpenAI API?", ALLOW, self.NAMES)
        self.assertEqual((c.ok, c.reason), (False, "unsupported_name"))

    def test_shorter_name_inside_a_longer_one_is_fine(self):
        from askalfonso.guardrails import unsupported_names

        self.assertEqual(unsupported_names("Answr cut response times.", "Answr AI Agent: texts back.", self.NAMES), [])
