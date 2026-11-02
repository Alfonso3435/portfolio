"""Tests for the TF-IDF retriever (no PyTorch needed).

    python -m unittest discover -s ml/tests -t ml
"""

from __future__ import annotations

import math
import unittest

from askalfonso.knowledge import tech_aliases
from askalfonso.retrieval import TfidfRetriever, terms, words

CHUNKS = [
    {"id": "project/zaptap", "title": "ZapTap", "text": "ZapTap sells NFC review cards. Stack: Next.js and Tailwind CSS.",
     "entities": ["ZapTap", "Next.js", "Tailwind CSS"]},
    {"id": "project/identifeye", "title": "IdentifEye",
     "text": "IdentifEye matches product photos to a catalog with Vertex AI and OpenCV.",
     "entities": ["IdentifEye", "Vertex AI", "OpenCV"]},
    {"id": "skills/ml", "title": "Machine Learning", "text": "Machine learning skills: PyTorch, NumPy, OpenCV (IdentifEye).",
     "entities": ["PyTorch", "NumPy", "OpenCV"]},
    {"id": "education/uw", "title": "University of Washington",
     "text": "Alfonso studies Computer Science at the University of Washington. Expected graduation: Jun 2028.",
     "entities": ["University of Washington", "UW"]},
]


class TokenizationTests(unittest.TestCase):
    def test_keeps_symbols_that_names_use(self):
        self.assertEqual(words("Does he know C++, C# and Next.js?"), ["c++", "c#", "next.js"])

    def test_folds_accents_and_case(self):
        self.assertEqual(words("Tecnológico de MONTERREY"), ["tecnologico", "de", "monterrey"])

    def test_bigrams_and_synonyms(self):
        self.assertIn("machine learning", terms("machine learning projects"))
        self.assertIn("washington", terms("Does he go to UW?", expand=True))


class RetrieverTests(unittest.TestCase):
    def setUp(self):
        self.r = TfidfRetriever(CHUNKS)

    def test_vectors_are_unit_length(self):
        for vec in self.r.vectors:
            self.assertAlmostEqual(math.sqrt(sum(v * v for v in vec.values())), 1.0)

    def test_rare_terms_weigh_more(self):
        # "opencv" is in 2 chunks, "vertex" in 1: the rarer one has the higher idf.
        self.assertGreater(self.r.idf["vertex"], self.r.idf["opencv"])

    def test_finds_the_right_chunk(self):
        self.assertEqual(self.r.search("What is ZapTap?", k=1)[0].chunk_id, "project/zaptap")
        self.assertEqual(self.r.search("When does he graduate from UW?", k=1)[0].chunk_id, "education/uw")

    def test_entity_bonus_beats_mentions_elsewhere(self):
        # IdentifEye is also mentioned by skills/ml; the project's own chunk must win.
        hits = self.r.search("What need does IdentifEye address?", k=2)
        self.assertEqual(hits[0].chunk_id, "project/identifeye")
        self.assertGreater(hits[0].score - hits[1].score, 0.3)

    def test_entity_needs_all_its_words(self):
        # "Vertex" alone doesn't trigger the "Vertex AI" entity bonus.
        self.assertLess(self.r.search("vertex", k=1)[0].score, 0.5)

    def test_unrelated_question_scores_zero(self):
        self.assertEqual(self.r.search("What's the capital of France?", k=1)[0].score, 0.0)

    def test_export_has_what_the_browser_needs(self):
        data = self.r.to_dict()
        self.assertEqual(len(data["chunks"]), len(CHUNKS))
        self.assertIn("vector", data["chunks"][0])
        self.assertIn("idf", data)


class AliasTests(unittest.TestCase):
    def test_tech_aliases(self):
        self.assertEqual(tech_aliases("TensorFlow / Keras"), ["TensorFlow / Keras", "TensorFlow", "Keras"])
        self.assertEqual(tech_aliases("Google Cloud (Vertex AI, Cloud Run)"),
                         ["Google Cloud (Vertex AI, Cloud Run)", "Google Cloud", "Vertex AI", "Cloud Run"])
        self.assertEqual(tech_aliases("n8n & webhooks"), ["n8n & webhooks", "n8n", "webhooks"])
        self.assertEqual(tech_aliases("Python"), ["Python"])


if __name__ == "__main__":
    unittest.main()
