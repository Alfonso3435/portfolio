"""The full Ask Alfonso pipeline: question → guard → retrieve → read → check → reply.

    1. Private-topic guard   personal questions never reach the model.
    2. Retrieve              TF-IDF finds the best chunks. Chunks below the confidence
                             threshold τ are dropped; if none survive, the model gets
                             an empty context and should refuse.
    3. Read                  the transformer answers from the retrieved chunks.
    4. Check                 guardrails.check_answer() rejects rambling, repetition,
                             facts with no context, and names not found in the context.
    5. Reply                 the model's answer, or a safe fallback, plus its sources.

Every step's decision is kept in `Reply.debug`, so `ask.py` can show *why* an answer
was given — the same information Phase 6 uses for error analysis.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from .guardrails import check_answer, is_greeting, is_private, is_refusal
from .inference import generate_answer, load_checkpoint
from .knowledge import SITE, Knowledge
from .prompt import build_prompt
from .retrieval import Hit, TfidfRetriever
from .training_data import CONTEXT_SEPARATOR


@dataclass
class PipelineConfig:
    threshold: float = 0.10  # τ: minimum retrieval score for a chunk to be shown to the model
    relative: float = 0.5  # a 2nd chunk must also score ≥ relative × the top score
    max_chunks: int = 3  # training contexts held up to 3 chunks (e.g. all awards for "What has he won?")
    max_new_tokens: int = 120
    guards: bool = True  # False = retrieval + model only (for measuring what the guardrails add)


@dataclass
class Reply:
    answer: str
    status: str  # answered | refused | private | fallback
    sources: list[Hit] = field(default_factory=list)
    debug: dict = field(default_factory=dict)


class AskAlfonso:
    def __init__(self, model, tok, chunks: list[dict], email: str, name: str = "Alfonso",
                 assistant: str = "Ask Alfonso", config: PipelineConfig | None = None,
                 facts: dict[str, str] | None = None):
        self.model, self.tok = model, tok
        self.cfg = config or PipelineConfig()
        self.retriever = TfidfRetriever(chunks)
        self.texts = {c["id"]: c["text"] for c in chunks}
        # Extra facts per chunk for the grounding check only (Knowledge.grounding_facts).
        self.facts = facts or {}
        self.email = email
        self.private_answer = (f"That's personal information I don't share. If it's relevant to a role, "
                               f"you can ask {name} directly at {email}.")
        self.fallback = (f"I'm not sure about that — I can only answer questions about {name}'s projects, "
                         f"skills and experience. You can reach him at {email}.")
        # Names the fixed refusal/greeting messages use, which never come from a chunk.
        self.allowlist = " ".join([assistant, name, email, SITE, f"{SITE}/projects", "HackMX"])
        self._cache: dict[tuple[str, str], tuple[str, bool]] = {}

    @classmethod
    def from_files(cls, checkpoint: Path, data_dir: Path, device: str = "cpu",
                   config: PipelineConfig | None = None) -> "AskAlfonso":
        model, tok, _ = load_checkpoint(checkpoint, device)
        chunks = [json.loads(line) for line in (data_dir / "chunks.jsonl").open(encoding="utf-8")]
        kb = Knowledge.load(data_dir / "knowledge.json")
        return cls(model, tok, chunks, email=kb.email, name=kb.name,
                   assistant=kb.profile.get("assistantName", "Ask Alfonso"), config=config,
                   facts=kb.grounding_facts())

    # ── steps ──────────────────────────────────────────────────────────────────────
    def retrieve(self, question: str) -> tuple[list[Hit], list[Hit]]:
        """(all top hits for debugging, the hits that pass the confidence threshold)."""
        hits = self.retriever.search(question, k=max(3, self.cfg.max_chunks))
        if not hits or hits[0].score < self.cfg.threshold:
            return hits, []
        floor = max(self.cfg.threshold, self.cfg.relative * hits[0].score)
        return hits, [h for h in hits if h.score >= floor][: self.cfg.max_chunks]

    def fit_context(self, kept: list[Hit], question: str) -> list[Hit]:
        """Drop the weakest chunk until the prompt leaves room for the answer."""
        budget = self.model.cfg.block_size - self.cfg.max_new_tokens
        while kept and len(self.tok.encode(build_prompt(self._context(kept), question))) > budget:
            kept = kept[:-1]
        return kept

    def _context(self, hits: list[Hit]) -> str:
        return CONTEXT_SEPARATOR.join(self.texts[h.chunk_id] for h in hits)

    def generate(self, context: str, question: str) -> tuple[str, bool]:
        key = (context, question)  # greedy decoding is deterministic, so caching is safe
        if key not in self._cache:
            self._cache[key] = generate_answer(self.model, self.tok, context, question, self.cfg.max_new_tokens)
        return self._cache[key]

    # ── the whole thing ────────────────────────────────────────────────────────────
    def ask(self, question: str) -> Reply:
        question = question.strip()
        if self.cfg.guards and is_private(question):
            return Reply(self.private_answer, "private", debug={"reason": "private_guard"})

        hits, kept = self.retrieve(question)
        kept = self.fit_context(kept, question)
        context = self._context(kept)
        raw, finished = self.generate(context, question)
        grounding = " ".join([context, *(self.facts.get(h.chunk_id, "") for h in kept)])
        check = check_answer(raw, finished, grounding, question, self.allowlist)
        debug = {
            "hits": [(h.chunk_id, round(h.score, 3)) for h in hits],
            "context_ids": [h.chunk_id for h in kept],
            "raw": raw,
            "finished": finished,
            "reason": check.reason,
            "ungrounded": list(check.ungrounded),
        }
        if self.cfg.guards and not check.ok:
            return Reply(self.fallback, "fallback", debug=debug)
        if is_refusal(raw):
            return Reply(raw, "refused", debug=debug)
        # A greeting or a fact: show the chunks it came from (none for a greeting).
        return Reply(raw, "answered", sources=[] if is_greeting(raw) else kept, debug=debug)
