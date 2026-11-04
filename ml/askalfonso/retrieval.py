"""TF-IDF retriever, written from scratch: finds the chunks most relevant to a question.

The same idea you used with scikit-learn in "Can AI Spot a Lie?", now by hand —
and small enough to port to TypeScript so it can run in the browser (Phase 7).

    tf(t, d)   = 1 + log(count of term t in chunk d)        (sublinear: the 10th
                                                             "python" adds less than the 1st)
    idf(t)     = log((1 + N) / (1 + df(t))) + 1             (rare terms weigh more;
                                                             N chunks, df = chunks containing t)
    vector(d)  = tf · idf for every term, then L2-normalized
    score(q,d) = cosine similarity = vector(q) · vector(d)  (0 = nothing in common, 1 = identical)

Terms are words and word pairs (bigrams), like your fake-news classifier, so
"machine learning" counts as a phrase and not just two common words.
"""

from __future__ import annotations

import math
import re
import unicodedata
from collections import Counter
from dataclasses import dataclass

# Words that appear in almost every question and say nothing about *which* chunk is relevant.
STOPWORDS = set("""
a an the and or but of to in on at for with by from about as is are was were be been being am do does did
doing have has had having he his him himself she her it its they them their what which who whom whose when
where why how this that these those there here i me my you your we our can could would should will shall
may might must any some all also just so than then too very not no yes if into out up down over under
again more most such only own same other tell know let give show please much many anything something
alfonso alfonsos poncho juan vega sol
use used uses using familiar ever good work worked working experience
""".split())

# Small query expansion: how visitors say it → how the data says it.
SYNONYMS = {
    "uw": "university washington",
    "tec": "tecnologico monterrey",
    "itesm": "tecnologico monterrey",
    "gpa": "gpa grades",
    "ml": "machine learning",
    "ai": "ai artificial intelligence",
    "llm": "llm language model",
    "llms": "llm language model",
    "school": "university college",
    "college": "university college",
    "job": "role looking internship",
    "internship": "internship looking role",
    "hire": "looking internship role",
    "email": "email contact reach",
    "contact": "email contact reach",
    "award": "award place won",
    "awards": "award place won",
    "won": "award place won",
    "hackathon": "hackathon award",
    "recognition": "award recognition",
    "achievements": "award achievements",
    "city": "location based area",
    "located": "location based area",
    "based": "location based area",
    "live": "location based area",
    "graduate": "graduation expected",
    "graduation": "graduation expected",
    "bilingual": "speaks languages spanish english",
    "speak": "speaks languages",
    "coursera": "certifications courses",
    "certificates": "certifications courses",
    "certificate": "certifications courses",
    "courses": "certifications courses",
    "touch": "contact reach email",
    "reach": "contact reach email",
}

TOKEN_RE = re.compile(r"[a-z0-9]+(?:[+#]+|(?:\.[a-z0-9]+)+)?")


def fold(text: str) -> str:
    """Lowercase and strip accents: 'Tecnológico' -> 'tecnologico'."""
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return text.lower()


def words(text: str) -> list[str]:
    """'Does he know C++ and Next.js?' -> ['c++', 'next.js'] (stopwords removed)."""
    return [w for w in TOKEN_RE.findall(fold(text)) if w not in STOPWORDS]


def terms(text: str, expand: bool = False) -> list[str]:
    """Words plus adjacent word pairs: ['machine', 'learning', 'machine learning']."""
    ws = words(text)
    if expand:
        ws = [x for w in ws for x in ([w] + words(SYNONYMS[w]) if w in SYNONYMS else [w])]
    return ws + [f"{a} {b}" for a, b in zip(ws, ws[1:])]


# His own name is a stopword (it's in nearly every chunk), so "Who is Juan Alfonso Vega Sol?"
# had no content words left and retrieved nothing (found in Phase 6). A question that names
# him and asks nothing else is about him in general: answer from the profile.
NAME_WORDS = {"alfonso", "alfonsos", "poncho", "juan", "vega", "sol"}
PROFILE_CHUNK = "profile/about"
# …and asked the way the model knows best: it read "Who is Juan Alfonso Vega Sol?" as a
# question about an unknown project called "Vega". Rewriting the query (not the answer)
# is ordinary search engineering; the answer still comes from the model reading the profile.
ABOUT_QUESTION = "Tell me about Alfonso."


def about_him(question: str) -> bool:
    content = [w for w in words(question) if len(w) > 1]  # "who's" leaves a stray "s"
    return any(w in NAME_WORDS for w in TOKEN_RE.findall(fold(question))) and not content


@dataclass
class Hit:
    chunk_id: str
    title: str
    score: float


# How retrieved chunks become the model's context. Shared by training (v3) and the
# pipeline, so the model trains on exactly the kind of context it will see.
THRESHOLD = 0.10  # τ: below this score a chunk isn't shown (tuned on dev in Phase 5)
RELATIVE = 0.5  # extra chunks must also score ≥ RELATIVE × the top score
MAX_CHUNKS = 3


def select_hits(hits: list[Hit], threshold: float = THRESHOLD, relative: float = RELATIVE,
                max_chunks: int = MAX_CHUNKS) -> list[Hit]:
    """The hits (sorted best first) that are confident enough to show the model."""
    if not hits or hits[0].score < threshold:
        return []
    floor = max(threshold, relative * hits[0].score)
    return [h for h in hits if h.score >= floor][:max_chunks]


class TfidfRetriever:
    def __init__(self, chunks: list[dict], title_weight: int = 2, entity_bonus: float = 0.6,
                 skill_tech_bonus: float = 0.4, tech_bonus: float = 0.25):
        """chunks: [{"id", "title", "text", "entities", "techs"}]. Titles are repeated to count more.

        Entity bonus: TF-IDF alone ranked IdentifEye's own chunk 6th for "What need does
        IdentifEye address?", because the skill chunks mention "IdentifEye" many times.
        If a chunk's own name (all of its words) appears in the question, it gets
        +entity_bonus — the question is clearly *about* that thing.

        Tech bonus (v5): a technology named in the question boosts the chunks that use it,
        more for a skill chunk (which lists every project using it) than for a single
        project or role. Before, "Does he know Streamlit?" boosted six project chunks as
        much as the skill chunk, which then ranked 6th. Bonuses were tuned on *train*
        questions; dev only reports the result.
        """
        self.chunks = chunks
        self.entity_bonus = entity_bonus
        self.entity_words = [[set(words(e)) for e in c.get("entities", []) if words(e)] for c in chunks]
        self.tech_words = [[set(words(t)) for t in c.get("techs", []) if words(t)] for c in chunks]
        self.tech_bonuses = [skill_tech_bonus if c["id"].startswith("skills/") else tech_bonus for c in chunks]
        docs = [terms(" ".join([c["title"]] * title_weight + [c["text"]])) for c in chunks]
        n = len(docs)
        df = Counter(t for doc in docs for t in set(doc))
        self.idf = {t: math.log((1 + n) / (1 + d)) + 1 for t, d in df.items()}
        self.vectors = [self._vectorize(Counter(doc)) for doc in docs]

    def _vectorize(self, counts: Counter) -> dict[str, float]:
        vec = {t: (1 + math.log(c)) * self.idf[t] for t, c in counts.items() if t in self.idf}
        norm = math.sqrt(sum(v * v for v in vec.values())) or 1.0
        return {t: v / norm for t, v in vec.items()}

    def search(self, question: str, k: int = 3) -> list[Hit]:
        q = self._vectorize(Counter(terms(question, expand=True)))
        q_words = set(words(question))
        scored = []
        for chunk, vec, entities, techs, tech_bonus in zip(self.chunks, self.vectors, self.entity_words,
                                                            self.tech_words, self.tech_bonuses):
            # Iterate over the (short) query, not the (long) chunk.
            score = sum(w * vec.get(t, 0.0) for t, w in q.items())
            if any(e <= q_words for e in entities):
                score += self.entity_bonus
            elif any(t <= q_words for t in techs):
                score += tech_bonus
            scored.append(Hit(chunk["id"], chunk["title"], score))
        scored.sort(key=lambda h: h.score, reverse=True)
        return scored[:k]

    def to_dict(self) -> dict:
        """Everything the browser needs to run search without Python (Phase 7)."""
        return {
            "entity_bonus": self.entity_bonus,
            "tech_bonuses": self.tech_bonuses,
            "idf": self.idf,
            "chunks": [
                {"id": c["id"], "title": c["title"], "text": c["text"], "vector": v,
                 "entities": [sorted(e) for e in ents], "techs": [sorted(t) for t in techs]}
                for c, v, ents, techs in zip(self.chunks, self.vectors, self.entity_words, self.tech_words)
            ],
        }
