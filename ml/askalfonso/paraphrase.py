"""v6: a paraphrase grammar — hundreds of ways to ask each question, fresh every epoch.

The problem it solves
    v1–v5 learned from ~15 hand-written phrasings per question type. The stress set showed
    the model gets a *new* phrasing right for every project or wrong for every project:
    it memorized wordings instead of learning that "need … address", "problem … solve"
    and "pain point … fix" mean the same thing. A bigger model (v5) memorized faster and
    generalized worse. The fix is data: many more ways to say the same thing.

How it works
    Each question type has a few sentence patterns; each slot lists alternatives:

        ["What", ["problem", "issue", "pain point"], "does {t}", ["solve", "fix"], "?"]
        → "What problem does {t} solve?", "What issue does {t} fix?", …  (3 × 2 = 6 phrasings)

    The combinations give ~100–300 phrasings per type. Every epoch, each (question type,
    project) pair gets a few phrasings drawn at random — the same trick as the invented
    projects: there are too many to memorize, so the model has to learn the meaning.
    Answers and gold chunks come from QAGenerator, so they're the same as the dataset's.

Keeping evaluation honest (strict filter)
    A generated phrasing is dropped if it's close to any dev, test or stress phrasing of
    the same question type, by either test:
      • word overlap (qa.near_duplicate, Jaccard ≥ 0.6), or
      • content words: after removing function words and comparing word stems, all the
        content of one phrasing is contained in the other ("Summarize {t}." vs the test's
        "Give me a summary of {t}." share "summar…" → dropped).
    So "motivation" never appears in training for project.problem, because test asks
    "What was the motivation behind {t}?". The model has to get there from other words.
"""

from __future__ import annotations

import itertools
import random
import re

from .knowledge import Knowledge
from .qa import QA, QAGenerator, near_duplicate
from .stress import STRESS_TEMPLATES

Pattern = list  # of str | list[str]

# Function words only; content words (verbs, nouns, adjectives) are what the filter compares.
FUNCTION_WORDS = set("""
a an the and or but of to in on at for with by from about as is are was were be been being am do does did
have has had he his him it its they them their what which who whom when where why how this that these those
there here i me my you your we our can could would should will may might must any some all just so than then
too very not no if into out up over again more most such only own same other please let tell give show know
quick quickly briefly short exactly really actually one sentence few words simple terms nutshell
behind beyond within without across after before during through around among between toward towards via per
""".split())

G: dict[str, list[Pattern]] = {
    # ── projects ({t} = project title) ──────────────────────────────────────────
    "project.overview": [
        [["What is", "What's"], " {t}", ["", " about", ", in a nutshell", ", in short", ", in a few words"], "?"],
        [["Describe", "Introduce", "Outline", "Present", "Characterize"], " {t}", ["", " for me", " in one sentence",
                                                                                  " in simple terms"], "."],
        [["Can you", "Could you", "Would you"], " ", ["describe", "introduce", "outline", "characterize"], " {t}",
         ["", " for me", " in one sentence"], "?"],
        [["Tell me", "I'd like to know", "I want to know", "Let me know"], " ",
         ["about {t}", "what {t} is", "what {t} does", "more about {t}"], "."],
        [["What does {t} do", "What kind of project is {t}", "What is the idea behind {t}", "What is the gist of {t}",
          "What's the one-line pitch of {t}", "What is {t}, basically", "How would you describe {t}",
          "What was {t} meant to be", "So what is {t}"], "?"],
    ],
    "project.problem": [
        ["What ", ["problem", "issue", "pain point", "challenge", "need", "gap"], " ", ["does", "did"], " {t} ",
         ["solve", "fix", "tackle", "address", "target", "go after"], "?"],
        ["Why ", ["did he build", "did Alfonso build", "was he building", "would anyone need",
                  "does anyone need", "did he make", "does the world need"], " {t}?"],
        [["Which", "What"], " ", ["problem", "issue", "pain point"], " ", ["is {t} for", "was {t} built for",
                                                                         "led to {t}", "is behind {t}"], "?"],
        [["Who has the problem that {t} solves", "What was wrong before {t}", "What hurts without {t}",
          "What's broken that {t} fixes", "What situation is {t} built for", "What does {t} make easier",
          "What frustration does {t} remove"], "?"],
        [["Can you", "Could you"], " ", ["say", "tell me", "explain"], " ",
         ["why he built {t}", "what problem {t} solves", "what {t} is trying to fix", "what issue {t} tackles"], "?"],
    ],
    "project.built": [
        ["What ", ["did he", "did Alfonso"], " ", ["build", "create", "develop", "implement", "code", "ship",
                                                    "put together", "engineer"], " ", ["for", "in", "on", "as part of"],
         " {t}?"],
        ["What ", ["are the main features of", "are the components of", "pieces make up", "is inside",
                   "parts did he own in", "work went into"], " {t}?"],
        ["What ", ["features", "functionality", "parts"], " does {t} have?"],
        [["List", "Show me", "Describe", "Break down"], " ", ["what he built for {t}", "the features of {t}",
                                                               "the parts of {t}", "how {t} works",
                                                               "what's in {t}"], "."],
        [["How does {t} work", "How did he build {t}", "What does {t} include", "What did his work on {t} include",
          "Which features did he ship in {t}", "What can {t} do"], "?"],
        [["Can you", "Could you"], " ", ["list", "describe", "break down"], " ",
         ["what he built for {t}", "the features of {t}", "how {t} works"], "?"],
    ],
    "project.stack": [
        ["What ", ["tech stack", "stack", "technologies", "tools", "frameworks", "libraries", "tech",
                   "languages and tools", "software"], " ", ["does {t} use", "did he use for {t}", "power {t}",
                                                             "is {t} built with", "went into {t}", "runs {t}"], "?"],
        ["Which ", ["technologies", "tools", "frameworks", "libraries"], " ", ["does {t} use", "did he use in {t}",
                                                                              "are in {t}", "power {t}"], "?"],
        [["What is {t} built with", "What was {t} made with", "What is {t} written in", "What runs {t}",
          "How was {t} built, technically", "What's {t}'s stack", "{t} stack",
          "What does {t} run on"], "?"],
        [["Was {t} built with", "Did {t} use", "Does {t} rely on"], " ",
         ["Python", "React", "AI", "a database", "the cloud", "machine learning"], "?"],
        [["List", "Name", "Give me"], " ", ["the stack of {t}", "the tools behind {t}", "the technologies in {t}",
                                            "{t}'s tech stack"], "."],
    ],
    "project.role": [
        ["What ", ["was his role", "was Alfonso's role", "part did he play", "did he do", "was he responsible for",
                   "was his job", "was his contribution", "position did he have"], " ", ["in", "on"], " {t}?"],
        [["Was {t} a solo project", "Did he build {t} alone", "Did he build {t} by himself",
          "Was {t} a team effort", "Who did he build {t} with", "How many people were on {t}",
          "How large was the {t} team", "Did he lead {t}", "Who led {t}", "Was he alone on {t}",
          "What was his title on {t}"], "?"],
        [["Tell me", "Explain"], " ", ["his role in {t}", "what he did on {t}", "who built {t}"], "."],
        [["Can you", "Could you"], " ", ["tell me", "explain"], " ", ["his role in {t}", "what he did on {t}",
                                                                     "who worked on {t}"], "?"],
    ],
    "project.results": [
        ["What ", ["results", "outcomes", "numbers", "metrics", "impact"], " ", ["did {t} get", "did {t} have",
                                                                               "came out of {t}",
                                                                               "does {t} have to show"], "?"],
        [["How did {t} do", "How well does {t} work", "How well did {t} perform", "Did {t} work",
          "Was {t} a success", "How accurate is {t}", "What did {t} achieve", "Did {t} pay off",
          "What happened with {t} in the end", "Any results from {t}", "Does {t} have any results"], "?"],
        [["Tell me", "Share"], " ", ["the results of {t}", "how {t} performed", "what {t} achieved"], "."],
        [["Can you", "Could you"], " ", ["share", "tell me"], " ", ["the results of {t}", "how {t} performed",
                                                                   "what {t} achieved"], "?"],
    ],
    "project.award": [
        ["Did {t} ", ["win", "get", "earn", "take home", "receive"], " ",
         ["an award", "any awards", "a prize", "any prizes", "anything", "first place", "a trophy"], "?"],
        ["Has {t} ", ["won", "gotten", "earned", "received"], " ",
         ["an award", "any awards", "a prize", "any prizes", "anything", "first place"], "?"],
        [["Was {t} a winner", "Was {t} an award winner", "Was {t} awarded", "Was {t} a hackathon winner",
          "Did {t} place anywhere", "Did {t} win a competition", "Was {t} honored", "Did {t} get any honors",
          "Is {t} award-winning", "What did {t} win", "What awards did {t} get", "Which award did {t} win",
          "Any awards for {t}", "Any prizes for {t}", "Was {t} presented anywhere", "Was {t} showcased anywhere"],
         "?"],
        [["Can you", "Could you"], " ", ["tell me", "check"], " ", ["if {t} won anything", "whether {t} won an award",
                                                                   "what {t} won"], "?"],
    ],
    "project.links": [
        [["Where can I", "How can I", "Can I"], " ", ["see", "find", "try", "watch", "visit", "open", "check out"],
         " {t}", ["", " online", " live"], "?"],
        ["Is there ", ["a link", "a demo", "a video", "a live version", "a website", "a repo", "source code",
                       "a case study"], " ", ["for", "of"], " {t}?"],
        [["Is {t} live", "Is {t} online", "Is {t} public", "Is {t} open source", "Where is {t} hosted",
          "Where's the code for {t}", "Where's the demo of {t}", "What's the URL for {t}", "Link to {t}",
          "Got a link for {t}"], "?"],
        [["Share", "Send me", "Give me"], " ", ["a link to {t}", "the {t} demo", "the {t} video", "the {t} repo"], "."],
    ],
    # ── experience ({c} = company) ──────────────────────────────────────────────
    "experience.overview": [
        [["What is", "What's"], " {c}", ["", " exactly", ", in short"], "?"],
        ["What ", ["does {c} do", "does {c} sell", "does {c} offer", "kind of company is {c}",
                   "kind of organization is {c}", "is {c}'s business", "is {c}'s mission", "is {c} known for"], "?"],
        [["Describe", "Introduce", "Summarize"], " {c}", ["", " for me"], "."],
        [["Who are {c}'s customers", "What market is {c} in"], "?"],
        [["Tell me what {c} is", "Tell me about the company {c}"], "."],
    ],
    "experience.role": [
        ["What ", ["is", "was"], " his ", ["role", "job", "position", "title"], " ", ["at", "with"], " {c}?"],
        ["What ", ["does", "did"], " he ", ["do", "handle", "own", "work on", "build"], " ", ["at", "for"], " {c}?"],
        [["What has he built at {c}", "What is he responsible for at {c}", "How is he involved with {c}",
          "Is he a founder of {c}", "What's his part in {c}", "What does his job at {c} involve",
          "What are his responsibilities at {c}"], "?"],
        [["Tell me", "Describe"], " ", ["his role at {c}", "his work at {c}", "what he does at {c}"], "."],
    ],
    "experience.dates": [
        [["When did he", "When did Alfonso"], " ", ["start at", "join", "begin at", "start working at",
                                                    "get involved with", "found"], " {c}?"],
        [["How long", "For how long"], " ", ["has he been at", "has he worked at", "did he work at",
                                             "was he at", "has he been with"], " {c}?"],
        [["Since when has he been at {c}", "What dates was he at {c}", "Is he still at {c}",
          "What's his start date at {c}", "Was he at {c} recently", "What years was he at {c}",
          "When was he at {c}"], "?"],
    ],
    "experience.stack": [
        ["What ", ["stack", "tech", "technologies", "tools", "frameworks", "languages"], " ",
         ["does he use at", "did he use at", "does he work with at", "power his work at", "does he build with at"],
         " {c}?"],
        [["Which technologies does he use at {c}", "What is {c} built with", "What does he code in at {c}",
          "What's the tech behind {c}", "What does {c} run on", "{c} tech stack"], "?"],
    ],
    # ── awards ({e}, {e2} = event names) ────────────────────────────────────────
    "award.detail": [
        ["What ", ["did he win", "did he get", "place did he get", "was his result", "did his team win"], " at {e}?"],
        [["How did he place at", "How did his team do at", "Did he win at", "What happened at", "Tell me about"],
         " ", ["{e}", "{e2}"], "?"],
        [["What was {e2}", "What did he build for {e}", "Did he compete at {e}"], "?"],
    ],
    "award.list": [
        [["What awards", "Which awards", "What prizes", "Which hackathons", "What competitions",
          "What honors"], " ", ["has he won", "has Alfonso won", "did he win", "has he received"], "?"],
        [["Has he won", "Did he win", "Has Alfonso won"], " ", ["any awards", "any hackathons", "anything",
                                                                "any prizes", "first place anywhere"], "?"],
        [["What are his biggest achievements", "What has he won", "Is he an award winner",
          "Is he a hackathon winner"], "?"],
        [["List his awards", "Tell me about his wins"], "."],
    ],
    # ── profile and education (no entity) ───────────────────────────────────────
    "profile.about": [
        [["Who is", "Who's"], " ", ["Alfonso", "he", "the person behind this site"], "?"],
        [["Tell me about", "Introduce", "Describe"], " ", ["Alfonso", "him", "the person behind this site"], "."],
        [["What does Alfonso do", "What's Alfonso's background", "Give me an overview of Alfonso",
          "Summarize Alfonso", "What should a recruiter know about Alfonso", "Who built this site"], "?"],
    ],
    "profile.looking_for": [
        [["Is he", "Is Alfonso"], " ", ["looking for", "open to", "available for", "interested in"], " ",
         ["an internship", "a job", "work", "new roles", "opportunities", "ML roles", "AI roles"], "?"],
        [["What kind of", "What type of", "Which"], " ", ["role", "job", "internship", "position"], " ",
         ["does he want", "is he looking for", "is he seeking", "would he take"], "?"],
        [["Can I hire him", "Is he hiring-ready", "Is he job hunting", "What is he looking for",
          "Is he available"], "?"],
    ],
    "profile.contact": [
        [["How do I", "How can I", "Where can I", "How should I"], " ", ["contact", "reach", "email", "get in touch with",
                                                                         "message", "talk to"], " ",
         ["him", "Alfonso"], "?"],
        [["What's his email", "What is Alfonso's email", "Contact info", "Is he on LinkedIn", "Email address",
          "Who do I talk to about hiring him"], "?"],
    ],
    "profile.location": [
        [["Where is he", "Where is Alfonso", "Where's he"], " ", ["based", "located", "living", "from now", "now"],
         "?"],
        [["What city is Alfonso in", "Which city does he live in", "What area is he in", "Is he in Washington",
          "Is he near Seattle", "Where does he work from", "What's his location"], "?"],
    ],
    "profile.languages": [
        [["What languages does he speak", "Which languages does Alfonso speak", "Does he speak English",
          "Does he speak German", "Is he fluent in English", "How good is his English", "Can he speak Spanish",
          "What's his native language", "How many languages can he speak"], "?"],
    ],
    "education.current": [
        [["Where does he study", "What does he study", "What is he majoring in", "What's his major",
          "Which university is he at", "What school does he go to", "Is he at UW", "Is he at the Allen School",
          "When will he graduate", "What year does he graduate", "What degree is he working on",
          "Is he a UW student"], "?"],
    ],
    "education.gpa": [
        [["What's his GPA", "What GPA does he have", "How were his grades", "How good are his grades",
          "Grades", "What's his grade point average", "Is he a strong student"], "?"],
    ],
    "education.before": [
        [["Where did he study before UW", "Where was he before UW", "Did he study in Mexico",
          "Where did he start college", "What was his path to UW", "Did he transfer", "Where did he transfer from",
          "What did he study at Tec de Monterrey", "Which schools came before UW"], "?"],
    ],
    "education.bellevue": [
        [["Did he go to Bellevue College", "What did he take at Bellevue College", "When was he at Bellevue College",
          "Why did he go to Bellevue College", "Which classes did he take at Bellevue College"], "?"],
    ],
    "education.certifications": [
        [["What certifications does he have", "Does he have any certificates", "What online courses has he done",
          "Has he done the Machine Learning Specialization", "What did he learn on Coursera",
          "Which specializations does he have", "Any certifications"], "?"],
    ],
}

_STEM_LEN = 5


def _content(template: str) -> set[str]:
    """Content-word stems: 'What was the motivation behind {t}?' → {'motiv', 'behin'}."""
    words = re.sub(r"\{\w+\}", " ", template.lower())
    words = re.sub(r"['’](s|re|d|ll|ve|m)\b|n['’]t\b", " ", words)  # what's → what, didn't → did
    return {w[:_STEM_LEN] for w in re.findall(r"[a-z]+", words) if w not in FUNCTION_WORDS}


def too_close(candidate: str, held_out: str) -> bool:
    if near_duplicate(candidate, held_out) or candidate.lower() == held_out.lower():
        return True
    a, b = _content(candidate), _content(held_out)
    return bool(a and b) and (a <= b or b <= a)


def _clean(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\s+([?.!,])", r"\1", text)
    return text[0].upper() + text[1:]


def expand(pattern: Pattern) -> list[str]:
    slots = [p if isinstance(p, list) else [p] for p in pattern]
    return [_clean("".join(parts)) for parts in itertools.product(*slots)]


def phrasings(intent: str, protected: list[str], cap: int = 300, seed: int = 0) -> list[str]:
    """The grammar's phrasings for an intent, minus anything too close to a protected one."""
    out = list(dict.fromkeys(p for pattern in G.get(intent, []) for p in expand(pattern)))
    out = [p for p in out if not any(too_close(p, h) for h in protected)]
    if len(out) > cap:
        out = random.Random(f"{seed}:{intent}").sample(out, cap)
    return out


class _ParaphraseGenerator(QAGenerator):
    """Every (intent, entity, phrasing) with QAGenerator's own answers and gold chunks."""

    def __init__(self, kb: Knowledge, protected: dict[str, list[str]] | None):
        super().__init__(kb)
        self.protected = protected  # None = collect them from this knowledge base

    def templated(self, intent, type_, templates, entities, answer, gold) -> None:
        held_out = list(templates[-2:]) if len(templates) >= 4 else []
        protect = (self.protected or {}).get(intent, held_out) + STRESS_TEMPLATES.get(intent, [])
        for key, values in entities:
            for i, template in enumerate(phrasings(intent, protect)):
                self.examples.append(QA(id=f"para:{intent}:{key}:{i}", intent=intent, type=type_,
                                        question=template.format(**values), answer=answer(values),
                                        gold_chunks=gold(values), split="train"))


def paraphrase_examples(kb: Knowledge, held_out: dict[str, list[str]] | None = None,
                        projects_only: bool = False) -> list[QA]:
    """All grammar Q&A for a knowledge base (real or invented).

    held_out: dev/test phrasings per intent to protect. Default: taken from this knowledge
    base's own templates (the last two of each list, as split_by_template does).
    """
    gen = _ParaphraseGenerator(kb, held_out)
    if not projects_only:  # invented knowledge bases (synthetic.py) only have projects
        gen._profile()
        gen._education()
        gen._experience()
        gen._awards()
    gen._projects()
    return [ex for ex in gen.examples if ex.id.startswith("para:")]


def held_out_templates(kb: Knowledge) -> dict[str, list[str]]:
    """The dev/test phrasings of every intent (for reporting and for invented knowledge bases)."""
    seen: dict[str, list[str]] = {}

    class _Spy(QAGenerator):
        def templated(self, intent, type_, templates, entities, answer, gold) -> None:
            seen[intent] = list(templates[-2:]) if len(templates) >= 4 else []

    spy = _Spy(kb)
    spy._profile()
    spy._education()
    spy._experience()
    spy._projects()
    spy._awards()
    return seen
