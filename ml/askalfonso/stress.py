"""A paraphrase stress set: ~100 new ways to ask the same questions, used only to *compare models*.

Why it exists
    Dev and test each hold out 2 phrasings per question type: ~27 phrasings in all.
    The error analyses of v3–v5 showed that a model gets a phrasing right for every
    project or wrong for every project, so dev measures ~27 coin flips worth ~4 points
    each. Two models can swap places on dev by luck. More phrasings = a steadier number
    ("a dev set big enough to tell your options apart", Structuring ML Projects).

Rules
    • Never used for training, and never used to write training phrasings.
    • Every phrasing is checked against all train/dev/test phrasings of its question type
      with the same near-copy test as training (qa.near_duplicate); copies are dropped.
    • Same reference answers and gold chunks as the real dataset (built by QAGenerator).
    • Test stays untouched: it remains the final, reported number (Phase 6).
"""

from __future__ import annotations

from .knowledge import Knowledge
from .qa import EXTRA_TRAIN_TEMPLATES, QA, QAGenerator, near_duplicate, train_only

STRESS_TEMPLATES: dict[str, list[str]] = {
    "profile.about": ["Who exactly is Alfonso?", "Tell me something about Alfonso.", "I'd like to know who Alfonso is.",
                      "What's Alfonso's deal?"],
    "profile.looking_for": ["What kind of role is he after?", "What is he hoping to find?",
                            "Would he take an internship?", "Is he on the job market?"],
    "profile.contact": ["How can a recruiter get hold of him?", "I want to contact him. How?",
                        "Where do I send a message to Alfonso?", "What's the best email for Alfonso?"],
    "profile.location": ["Where does Alfonso live?", "Which area is he based in?", "Is he local to Seattle?",
                         "What part of the country is he in?"],
    "profile.languages": ["What languages can he speak?", "Is English his first language?",
                          "How many languages does Alfonso know?", "Does he know Spanish?"],
    "education.current": ["Which school does he attend now?", "What is he studying at the moment?",
                          "Is he still in college?", "What program is he enrolled in?"],
    "education.gpa": ["How high is his GPA?", "Did he get good grades?", "Is his GPA strong?",
                      "What were his marks like?"],
    "education.before": ["Where did he study first?", "Which university was he at before?",
                         "What did he do before transferring?", "Where did his degree begin?"],
    "education.bellevue": ["How did Bellevue College fit into his path?", "Why Bellevue College?",
                           "Did he take classes at Bellevue College?", "What was Bellevue College for him?"],
    "education.certifications": ["Has he earned any online certificates?", "Which specializations has he completed?",
                                 "Any Coursera certificates?", "What extra courses has he done?"],
    "experience.overview": ["What is the company {c}?", "Give me the gist of {c}.", "What's {c}'s business?",
                            "Explain what {c} is about."],
    "experience.role": ["What position did he have at {c}?", "What was his part at {c}?",
                        "In what capacity is he at {c}?", "What role does Alfonso play at {c}?"],
    "experience.dates": ["Since when is he part of {c}?", "When did his work at {c} begin?",
                         "For how long was he with {c}?", "What period was he at {c}?"],
    "experience.stack": ["What technologies power his work at {c}?", "Which stack does {c} use?",
                         "What does he use to build things at {c}?", "Tools used at {c}?"],
    "project.overview": ["What exactly is {t}?", "Give me the elevator pitch for {t}.",
                         "In one sentence, what is {t}?", "Explain {t} briefly."],
    "project.problem": ["What problem was {t} made for?", "What pain does {t} solve?", "Why was {t} needed?",
                        "What gap does {t} fill?"],
    "project.built": ["What features did Alfonso implement in {t}?", "What parts of {t} did he create?",
                      "What went into building {t}?", "What did he make for {t}?"],
    "project.stack": ["What tech is {t} built on?", "Which tools were used for {t}?", "What's under the hood of {t}?",
                      "Which frameworks power {t}?"],
    "project.role": ["What was Alfonso's part in {t}?", "Who was on the {t} team?", "Did he lead {t}?",
                     "How many people built {t}?"],
    "project.results": ["What were the outcomes of {t}?", "Did {t} work well?", "How successful was {t}?",
                        "What came of {t}?", "Any numbers on how {t} did?",
                        "Were there measurable results from {t}?", "Show me the impact of {t}."],
    "project.award": ["Did {t} earn any awards?", "Has {t} been honored anywhere?",
                      "Did {t} get any prizes or recognition?", "Was {t} recognized at a hackathon?"],
    "project.links": ["Where can I check out {t}?", "Is {t} available online?", "Any link or video for {t}?",
                      "How can I see {t} in action?"],
    "award.detail": ["What was his placement at {e}?", "Tell me what happened at {e}.", "Did he do well at {e2}?",
                     "What did his team get at {e}?", "How far did he get at {e}?",
                     "Was {e2} a win for him?"],
    "award.list": ["Which awards has Alfonso earned?", "Has he won any prizes?", "What has he been recognized for?",
                   "List the competitions he won."],
    "skill.group": ["What can he do in {g}?", "Which {g} skills does Alfonso have?"],
    "skill.programming_languages": ["Which coding languages does he use?", "What programming languages is he good at?"],
}


class _StressGenerator(QAGenerator):
    """Reuses every answer and gold-chunk rule of QAGenerator, with the stress phrasings."""

    def __init__(self, kb: Knowledge):
        super().__init__(kb)
        self.dataset_templates: dict[str, list[str]] = {}
        self.dropped: list[tuple[str, str]] = []

    def templated(self, intent, type_, templates, entities, answer, gold) -> None:
        held_out = templates[-2:] if len(templates) >= 4 else []
        all_phrasings = train_only(EXTRA_TRAIN_TEMPLATES.get(intent, []), held_out) + list(templates)
        self.dataset_templates[intent] = all_phrasings
        fresh = []
        for t in STRESS_TEMPLATES.get(intent, []):
            if any(near_duplicate(t, d) or t.lower() == d.lower() for d in all_phrasings):
                self.dropped.append((intent, t))
            else:
                fresh.append(t)
        for key, values in entities:
            for i, template in enumerate(fresh):
                self.examples.append(QA(id=f"stress:{intent}:{key}:{i}", intent=intent, type=type_,
                                        question=template.format(**values), answer=answer(values),
                                        gold_chunks=gold(values), split="stress"))


def stress_examples(kb: Knowledge) -> tuple[list[QA], list[tuple[str, str]]]:
    """(stress Q&A, phrasings dropped as near-copies of the dataset's)."""
    gen = _StressGenerator(kb)
    gen._profile()
    gen._education()
    gen._experience()
    gen._projects()
    gen._awards()
    gen._skills()  # also adds skill.has rows with normal splits: filtered out below
    rows = [ex for ex in gen.examples if ex.split == "stress"]
    return rows, gen.dropped
