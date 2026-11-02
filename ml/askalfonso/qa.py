"""Generates the Q&A dataset for Ask Alfonso from the knowledge base.

Every answer is *built from the data fields*, never written by hand, so it is
grounded by construction: if a fact isn't in src/data, no answer can state it.

Each example has:
  question     what a visitor might type
  answer       the target response, in the third person and in English
  gold_chunks  the chunk ids that contain the answer (used to evaluate retrieval)
  intent       e.g. "project.stack" — one kind of question
  type         fact | skill | unknown_skill | unknown_entity | unknown | private | offtopic | greeting
  split        train | dev | test

How the split works (and why):
  • Fact questions are split by *paraphrase template*. Every project appears in
    every split, but the test set asks about it with wording the model never
    saw in training. That measures what matters: understanding new phrasings.
  • Refusal questions are split by *item*. The test set contains off-topic
    questions, private questions and unknown technologies the model never saw,
    so it can only pass by learning the general rule ("not in my data → say so"),
    not by memorizing specific questions.
"""

from __future__ import annotations

import hashlib
import random
from dataclasses import asdict, dataclass
from typing import Callable, Iterable

from .knowledge import Knowledge, education_chunk_id, skill_chunk_id
from .text import (
    as_he_sentence,
    degree_phrase,
    format_long_year_month,
    school_phrase,
    since_phrase,
    ensure_period,
    format_date_range,
    join_list,
    lower_first,
    to_third_person,
    with_article,
)

SITE = "alfonsovegasol.com"


@dataclass
class QA:
    id: str
    intent: str
    type: str
    question: str
    answer: str
    gold_chunks: list[str]
    split: str = ""


# ── splitting helpers ────────────────────────────────────────────────────────


def split_by_template(index: int, n_templates: int) -> str:
    """Last template → test, second-to-last → dev, the rest → train."""
    if n_templates < 4:
        return "train"
    if index == n_templates - 1:
        return "test"
    if index == n_templates - 2:
        return "dev"
    return "train"


def _stable_hash(text: str) -> int:
    return int(hashlib.sha1(text.encode("utf-8")).hexdigest(), 16)


def split_items(items: list[str]) -> dict[str, str]:
    """Stratified ~70/15/15 split of a list of items, with at least one item in dev and test.

    Items are ordered by a hash of their text, so the split never changes between
    runs and doesn't depend on the order of the list.
    """
    ordered = sorted(items, key=_stable_hash)
    n = len(ordered)
    n_test = max(1, round(n * 0.15))
    n_dev = max(1, round(n * 0.15))
    splits = {}
    for i, item in enumerate(ordered):
        splits[item] = "test" if i < n_test else "dev" if i < n_test + n_dev else "train"
    return splits


# ── generator ────────────────────────────────────────────────────────────────


class QAGenerator:
    def __init__(self, kb: Knowledge):
        self.kb = kb
        self.examples: list[QA] = []
        self.assistant = kb.profile["assistantName"]

    # Templated questions: same intent, several phrasings, one grounded answer per entity.
    def templated(
        self,
        intent: str,
        type_: str,
        templates: list[str],
        entities: Iterable[tuple[str, dict]],
        answer: Callable[[dict], str],
        gold: Callable[[dict], list[str]],
    ) -> None:
        # Extra phrasings go in front, so the last two templates (dev, test) stay fixed.
        templates = EXTRA_TRAIN_TEMPLATES.get(intent, []) + templates
        for key, values in entities:
            for i, template in enumerate(templates):
                question = template.format(**values)
                self.examples.append(
                    QA(
                        id=f"{intent}:{key}:{i}",
                        intent=intent,
                        type=type_,
                        question=question,
                        answer=answer(values),
                        gold_chunks=gold(values),
                        split=split_by_template(i, len(templates)),
                    )
                )

    # Refusal-style questions: one answer, many different items.
    def items(self, intent: str, type_: str, questions: list[str], answer: str | Callable[[str], str]) -> None:
        splits = split_items(questions)
        for q in questions:
            self.examples.append(
                QA(
                    id=f"{intent}:{q}",
                    intent=intent,
                    type=type_,
                    question=q,
                    answer=answer(q) if callable(answer) else answer,
                    gold_chunks=[],
                    split=splits[q],
                )
            )

    def generate(self) -> list[QA]:
        self._profile()
        self._education()
        self._experience()
        self._projects()
        self._awards()
        self._skills()
        self._refusals()
        return dedupe(self.examples)

    # ── profile ──────────────────────────────────────────────────────────────

    def _profile(self) -> None:
        kb, p = self.kb, self.kb.profile
        uw = p["education"][0]
        me = [("me", {})]
        about = (
            f"{p['name']} is a Computer Science student at {school_phrase(uw['school'])}, "
            f"focused on AI and machine learning. He won 1st place at "
            f"{join_list([a['event'] for a in kb.first_place_wins()])}, and he founded "
            f"{join_list([v['company'] for v in kb.ventures()])}."
        )
        self.templated(
            "profile.about", "fact",
            ["Who is Alfonso?", "Tell me about Alfonso.", "Can you introduce Alfonso?",
             "Give me a quick summary of his background.", "Who is Juan Alfonso Vega Sol?"],
            me, lambda _: about, lambda _: ["profile/about"],
        )
        looking = f"{to_third_person(p['lookingFor']['long'])} {kb.contact_sentence()}"
        self.templated(
            "profile.looking_for", "fact",
            ["What is he looking for?", "Is he looking for an internship?", "What kind of role does he want?",
             "Is he open to software engineering roles?", "Is Alfonso available for a summer internship?"],
            me, lambda _: looking, lambda _: ["profile/looking-for"],
        )
        contact = f"The best way to reach Alfonso is by email at {p['email']}. You can also find him on LinkedIn."
        self.templated(
            "profile.contact", "fact",
            ["How can I contact him?", "What's his email?", "How do I reach Alfonso?",
             "Can I get in touch with him?", "What's the best way to contact Alfonso?"],
            me, lambda _: contact, lambda _: ["profile/looking-for"],
        )
        self.templated(
            "profile.location", "fact",
            ["Where is he based?", "Where is Alfonso located?", "What city is he in?", "Is he in the Seattle area?"],
            me, lambda _: f"He is based in the {p['location']}.", lambda _: ["profile/about"],
        )
        langs = "Alfonso speaks " + join_list([f"{l['language']} ({l['level'].lower()})" for l in p["spokenLanguages"]]) + "."
        self.templated(
            "profile.languages", "fact",
            ["What languages does he speak?", "Does he speak Spanish?", "Is he bilingual?",
             "What spoken languages does Alfonso know?"],
            me, lambda _: langs, lambda _: ["profile/languages"],
        )
        self.templated(
            "greeting", "greeting",
            ["Hi", "Who are you?", "What can you do?", "Hello!", "Hey there"],
            me,
            lambda _: (
                f"Hi! I'm {self.assistant}, a small language model Alfonso built from scratch. Ask me about his "
                "projects, skills or experience — for example, what he built at HackMX."
            ),
            lambda _: [],
        )

    # ── education ────────────────────────────────────────────────────────────

    def _education(self) -> None:
        edu = self.kb.profile["education"]
        uw = edu[0]
        tec = next(e for e in edu if e["school"].startswith("Tecnológico"))
        bc = next(e for e in edu if e["school"].startswith("Bellevue"))
        me = [("me", {})]

        uw_answer = (
            f"Alfonso is studying for {degree_phrase(uw['degree'])} at {school_phrase(uw['school'])}. "
            f"He expects to graduate in {format_long_year_month(uw['expectedGraduation'])}."
        )
        self.templated(
            "education.current", "fact",
            ["Where does he study?", "What is he studying?", "What university does Alfonso attend?",
             "When does he graduate?", "Is he a student?"],
            me, lambda _: uw_answer, lambda _: [education_chunk_id(uw)],
        )
        self.templated(
            "education.gpa", "fact",
            ["What was his GPA?", "What's his GPA?", "Does he have a good GPA?", "What GPA did he have at Tec de Monterrey?"],
            me, lambda _: f"His GPA at {tec['school']} was {tec['gpa']}.", lambda _: [education_chunk_id(tec)],
        )
        before = (
            f"Before UW, Alfonso studied for {degree_phrase(tec['degree'].split(' (')[0])} at {tec['school']} "
            f"({format_date_range(tec['dates'])}), with a {tec['gpa']} GPA. He then took AI/ML coursework at "
            f"{bc['school']} ({format_date_range(bc['dates'])}) before transferring to UW."
        )
        self.templated(
            "education.before", "fact",
            ["Where did he study before UW?", "Did he study in Mexico?", "Tell me about his academic background.",
             "What schools has he attended?"],
            me, lambda _: before, lambda _: [education_chunk_id(tec), education_chunk_id(bc)],
        )
        bc_answer = (
            f"Yes. At {bc['school']} ({format_date_range(bc['dates'])}) he took AI/ML coursework: "
            f"{join_list(bc['coursework'])}. "
            + (f"Highlights: {'; '.join(bc['notes'])}." if bc.get("notes") else "")
        ).strip()
        self.templated(
            "education.bellevue", "fact",
            ["Did he study at Bellevue College?", "What did he take at Bellevue College?",
             "What did he do at Bellevue College?", "Tell me about his time at Bellevue College."],
            me, lambda _: bc_answer, lambda _: [education_chunk_id(bc)],
        )

        certs = self.kb.certifications
        programs = []
        for c in certs:
            name = c.get("program") or c["title"]
            if name not in programs:
                programs.append(name)
        self.templated(
            "education.certifications", "fact",
            ["What certifications does he have?", "What online courses has he completed?",
             "Does he have any certificates?", "What has he studied on Coursera?",
             "Has he taken the Deep Learning Specialization?"],
            me,
            lambda _: f"Alfonso's certifications include {join_list(programs)}.",
            lambda _: ["certifications"],
        )

    # ── experience ───────────────────────────────────────────────────────────

    def _experience(self) -> None:
        jobs = [(j["id"], {"c": j["company"], "job": j}) for j in self.kb.experience]

        def tense(job: dict) -> str:
            return "was" if job["dates"].get("end") else "is"

        self.templated(
            "experience.overview", "fact",
            ["What is {c}?", "Tell me about {c}.", "What does {c} do?", "Can you describe {c}?"],
            jobs,
            lambda v: (
                f"{v['c']} is {with_article(ensure_period(v['job']['summary']))} "
                f"Alfonso's role there: {v['job']['role']}, {since_phrase(v['job']['dates'])}."
            ),
            lambda v: [f"experience/{v['job']['id']}"],
        )
        self.templated(
            "experience.role", "fact",
            ["What does he do at {c}?", "What was his role at {c}?", "What did Alfonso work on at {c}?",
             "What has he accomplished at {c}?", "What's his job at {c}?"],
            jobs,
            lambda v: (
                f"His role at {v['c']} {tense(v['job'])} {v['job']['role']}, {since_phrase(v['job']['dates'])}. "
                + ensure_period(as_he_sentence(v["job"]["highlights"][0]))
            ),
            lambda v: [f"experience/{v['job']['id']}"],
        )
        self.templated(
            "experience.dates", "fact",
            ["When did he work at {c}?", "When did he join {c}?", "How long has he been involved with {c}?",
             "When did he start at {c}?"],
            jobs,
            lambda v: (
                f"Alfonso was {v['job']['role']} at {v['c']} {since_phrase(v['job']['dates'])}."
                if v["job"]["dates"].get("end")
                else f"Alfonso has been {v['job']['role']} at {v['c']} {since_phrase(v['job']['dates'])}."
            ),
            lambda v: [f"experience/{v['job']['id']}"],
        )
        self.templated(
            "experience.stack", "fact",
            ["What technologies does he use at {c}?", "What's the tech stack at {c}?",
             "What tools did he use at {c}?", "What does he build with at {c}?"],
            jobs,
            lambda v: f"At {v['c']}, his stack {'was' if v['job']['dates'].get('end') else 'is'} {join_list(v['job']['stack'])}.",
            lambda v: [f"experience/{v['job']['id']}"],
        )

    # ── projects ─────────────────────────────────────────────────────────────

    def _projects(self) -> None:
        kb = self.kb
        projs = [(p["slug"], {"t": p["title"], "p": p}) for p in kb.projects]
        gold = lambda v: [f"project/{v['p']['slug']}"]  # noqa: E731

        def overview(v: dict) -> str:
            p = v["p"]
            text = f"{p['title']}: {to_third_person(ensure_period(p['pitch']))}"
            award = kb.award_for(p)
            if award:
                text += f" It won {award['placement']} at {award['event']}."
            if p["status"] == "in-progress":
                text += " It's still in progress."
            return text

        self.templated(
            "project.overview", "fact",
            ["What is {t}?", "Tell me about {t}.", "What's {t} about?", "Can you explain {t}?",
             "Give me a summary of {t}."],
            projs, overview, gold,
        )
        self.templated(
            "project.built", "fact",
            ["What did he build for {t}?", "How does {t} work?", "What are the main features of {t}?",
             "What did Alfonso build in {t}?", "Walk me through what he built for {t}."],
            projs,
            # A short bullet list reads well in a chat bubble and keeps proper nouns intact.
            lambda v: f"For {v['t']}, he built:\n" + "\n".join(f"- {ensure_period(b)}" for b in v["p"]["built"][:3]),
            gold,
        )
        self.templated(
            "project.stack", "fact",
            ["What tech stack did he use for {t}?", "What technologies does {t} use?", "What is {t} built with?",
             "Which tools did he use to build {t}?", "What languages and frameworks are in {t}?"],
            projs, lambda v: f"{v['t']} uses {join_list(v['p']['stack'])}.", gold,
        )

        def role(v: dict) -> str:
            p = v["p"]
            if p.get("teamSize") == 1 or p["role"] == "Solo project":
                verb = "is" if p["status"] == "in-progress" else "was"
                return f"{p['title']} {verb} a solo project: Alfonso built it on his own."
            text = f"In {p['title']}, Alfonso's role was {lower_first(p['role'])}"
            return text + (f", on a team of {p['teamSize']}." if p.get("teamSize") else ".")

        self.templated(
            "project.role", "fact",
            ["What was his role in {t}?", "What did Alfonso do on {t}?", "Was {t} a team project?",
             "Did he work alone on {t}?", "How big was the team for {t}?"],
            projs, role, gold,
        )
        self.templated(
            "project.problem", "fact",
            ["What problem does {t} solve?", "Why did he build {t}?", "What need does {t} address?",
             "What was the motivation behind {t}?"],
            projs, lambda v: v["p"]["problem"], gold,
        )

        def results(v: dict) -> str:
            p = v["p"]
            if p.get("results"):
                return " ".join(ensure_period(r) for r in p["results"])
            if p["status"] == "in-progress":
                return f"{p['title']} is still in progress, so there are no results yet."
            return f"I don't have specific results listed for {p['title']}. The case study is at {SITE}/projects/{p['slug']}."

        self.templated(
            "project.results", "fact",
            ["What were the results of {t}?", "What did {t} achieve?", "How did {t} turn out?",
             "What impact did {t} have?"],
            projs, results, gold,
        )

        def award(v: dict) -> str:
            a = kb.award_for(v["p"])
            if a:
                return f"Yes. {v['t']} won {a['placement']} at {a['event']} ({a['year']})."
            return f"I don't have any award listed for {v['t']}."

        self.templated(
            "project.award", "fact",
            ["Did {t} win any awards?", "Did {t} win anything?", "Was {t} recognized anywhere?",
             "Has {t} received any awards?"],
            projs, award,
            lambda v: gold(v) + ([f"award/{v['p']['awardId']}"] if v["p"].get("awardId") else []),
        )

        labels = {"site": "Live site", "demo": "Live demo", "repo": "Source code", "video": "Demo video"}

        def links(v: dict) -> str:
            p = v["p"]
            parts = [f"{labels[k]}: {url}" for k, url in p["links"].items() if url]
            case = f"The full case study is at {SITE}/projects/{p['slug']}."
            return (". ".join(parts) + ". " + case) if parts else f"There's no public link for {p['title']} yet. {case}"

        self.templated(
            "project.links", "fact",
            ["Where can I see {t}?", "Is there a demo of {t}?", "Is there a link to {t}?", "Can I try {t}?"],
            projs, links, gold,
        )

    # ── awards ───────────────────────────────────────────────────────────────

    def _awards(self) -> None:
        kb = self.kb

        def aliases(a: dict) -> list[str]:
            short = a["event"].split(",")[0].split(" (")[0]
            first = short.split(" ")[0]
            return [short, first] if first != short else [short]

        entities = []
        for a in kb.awards:
            names = aliases(a)
            entities.append((a["id"], {"e": names[0], "e2": names[-1], "a": a}))

        self.templated(
            "award.detail", "fact",
            ["What did he win at {e}?", "What happened at {e2}?", "How did he do at {e}?", "Tell me about {e2}."],
            entities,
            lambda v: (
                f"{ensure_period(as_he_sentence(to_third_person(v['a']['summary'])))} "
                f"That was at {v['a']['event']} ({v['a']['year']}), organized by {v['a']['organizer']}."
            ),
            lambda v: [f"award/{v['a']['id']}"] + ([f"project/{v['a']['projectSlug']}"] if v["a"].get("projectSlug") else []),
        )
        wins = [a for a in kb.awards if a["kind"] == "win"]
        others = [a for a in kb.awards if a["kind"] != "win"]
        def placed(a: dict) -> str:
            article = "" if a["placement"][:1].isdigit() else "the "
            year = "" if str(a["year"]) in a["event"] else f" ({a['year']})"
            return f"{article}{a['placement']} at {a['event']}{year}"

        summary = "Alfonso won " + join_list([placed(a) for a in wins]) + "."
        if others:
            summary += " He was also a " + join_list([f"{a['placement'].lower()} at {a['event']}" for a in others]) + "."
        self.templated(
            "award.list", "fact",
            ["What awards has he won?", "Has he won any hackathons?", "What are his achievements?",
             "What recognition has he received?", "Has Alfonso won any competitions?"],
            [("all", {})], lambda _: summary, lambda _: [f"award/{a['id']}" for a in kb.awards],
        )

    # ── skills ───────────────────────────────────────────────────────────────

    def _skills(self) -> None:
        kb = self.kb
        templates = EXTRA_TRAIN_TEMPLATES["skill.has"] + SKILL_TEMPLATES

        def tech_aliases(name: str) -> list[str]:
            base = name.split(" (")[0]
            parts = [p.strip() for p in base.split(" / ")]
            return parts if len(parts) > 1 else [base]

        entities = []
        for tech in kb.tech_sources:
            names = tech_aliases(tech)
            entities.append((tech, {"name": tech, "alias": names}))

        # Cycle aliases across templates: "Does he know TensorFlow?" / "Has he used Keras?"
        for key, v in entities:
            for i, template in enumerate(templates):
                alias = v["alias"][i % len(v["alias"])]
                sources = kb.tech_sources[v["name"]]
                if sources:
                    answer = f"Yes. Alfonso has used {v['name']} in {join_list([t for t, _ in sources[:3]])}."
                else:
                    answer = f"Yes. {v['name']} comes from his coursework; it isn't featured in a project on this site yet."
                gold = [c for _, c in sources[:3]]
                group = kb.skill_group_chunk(v["name"])
                if group:
                    gold = [group, *gold]
                self.examples.append(
                    QA(
                        id=f"skill.has:{key}:{i}", intent="skill.has", type="skill",
                        question=template.format(s=alias), answer=answer, gold_chunks=gold,
                        split=split_by_template(i, len(templates)),
                    )
                )

        group_entities = [(skill_chunk_id(g), {"g": g["name"].lower(), "group": g}) for g in kb.skill_groups]
        self.templated(
            "skill.group", "skill",
            ["What are his {g} skills?", "What does he know about {g}?", "Tell me about his {g} experience.",
             "What {g} tools does he use?"],
            group_entities,
            lambda v: f"His {v['group']['name']} skills include {join_list([s['name'] for s in v['group']['skills'][:8]])}.",
            lambda v: [skill_chunk_id(v["group"])],
        )
        langs = next((g for g in kb.skill_groups if g["name"] == "Languages"), None)
        if langs is None:  # e.g. synthetic knowledge bases, which only have projects
            return
        self.templated(
            "skill.programming_languages", "skill",
            ["What programming languages does he know?", "What languages does he code in?",
             "Which programming languages does Alfonso use?", "What languages is he proficient in for coding?"],
            [("all", {})],
            lambda _: f"Alfonso codes in {join_list([s['name'] for s in langs['skills']])}.",
            lambda _: [skill_chunk_id(langs)],
        )

    # ── refusals ─────────────────────────────────────────────────────────────

    def _refusals(self) -> None:
        kb, email = self.kb, self.kb.email

        known = {a.lower() for tech in kb.tech_sources for a in [tech, tech.split(" (")[0], *tech.split(" / ")]}
        unknown_tech = [t for t in UNKNOWN_TECH if t.lower() not in known]
        tech_splits = split_items(unknown_tech)
        for tech in unknown_tech:
            split = tech_splits[tech]  # every phrasing of an unseen tech stays in the same split
            # Train items only use train phrasings: otherwise "Can he work with Rust?" would teach
            # the phrasing that skill.has holds out for its test set (a subtle leak found in v1).
            templates = skill_unknown_templates(split)
            for i, template in enumerate(templates):
                self.examples.append(
                    QA(
                        id=f"skill.unknown:{tech}:{i}", intent="skill.unknown", type="unknown_skill",
                        question=template.format(s=tech), answer=unknown_skill_answer(tech, email),
                        gold_chunks=[], split=split,
                    )
                )

        titles = {p["title"].lower() for p in kb.projects}
        unknown_projects = [n for n in UNKNOWN_PROJECTS if n.lower() not in titles]
        project_splits = split_items(unknown_projects)
        for name in unknown_projects:
            split = project_splits[name]
            for i, template in enumerate(PROJECT_UNKNOWN_TEMPLATES):
                self.examples.append(
                    QA(
                        id=f"project.unknown:{name}:{i}", intent="project.unknown", type="unknown_entity",
                        question=template.format(n=name), answer=unknown_project_answer(name),
                        gold_chunks=[], split=split,
                    )
                )

        self.items(
            "unknown", "unknown", UNKNOWN_ABOUT_HIM,
            f"I don't know that — it isn't in the information I have about Alfonso. You can ask him directly at {email}.",
        )
        self.items(
            "private", "private", PRIVATE,
            f"That's personal information I don't share. If it's relevant to a role, you can ask Alfonso directly at {email}.",
        )
        self.items(
            "offtopic", "offtopic", OFF_TOPIC,
            f"I'm {self.assistant}, and I only answer questions about Alfonso's projects, skills and experience. "
            "Try asking what he built at HackMX.",
        )


# ── refusal lists ────────────────────────────────────────────────────────────
# Technologies NOT in the site data. Anything that is in the data is filtered out
# automatically, so adding a skill to skills.ts never produces a wrong "I don't know".
UNKNOWN_TECH = [
    "Rust", "Go", "Kubernetes", "Docker", "Terraform", "Scala", "Haskell", "Ruby on Rails", "Swift", "Kotlin",
    "Apache Spark", "Hadoop", "Tableau", "Power BI", "Solidity", "Elixir", "MATLAB", "R", "Snowflake", "Kafka",
    "GraphQL", "Redis", "MongoDB", "Svelte", "Angular", "Vue", "Django", "Spring Boot", "JAX", "Ansible",
]

UNKNOWN_PROJECTS = [
    "PayFlow", "TravelMate", "QuantumChess", "SmartFridge", "CryptoTrader", "MediBot", "StudyBuddy", "EcoRoute",
    "Project Atlas", "VoiceNotes AI",
]

UNKNOWN_ABOUT_HIM = [
    "What's his favorite movie?", "What's his favorite food?", "What does he do on weekends?",
    "What music does he like?", "What's his favorite programming book?", "Does he play any instruments?",
    "What's his favorite sports team?", "What was his first computer?", "Does he like coffee or tea?",
    "What's his MBTI personality type?", "What video games does he play?", "What's his favorite city?",
    "Has he ever been to Japan?", "What's his favorite color?", "What did he want to be as a kid?",
    "Does he prefer cats or dogs?", "What's his SAT score?", "What's his LeetCode rating?",
]

PRIVATE = [
    "What's his phone number?", "What's his home address?", "Where exactly does he live?", "How old is he?",
    "Is he married?", "Does he have a girlfriend?", "What's his salary?", "How much money does he make?",
    "What's his visa status?", "What's his date of birth?", "What's his social security number?",
    "Who are his parents?", "What's his religion?", "What's his net worth?", "How much does Answr make?",
    "What's his credit score?",
]

OFF_TOPIC = [
    "What's the capital of France?", "Write me a poem.", "What's 2 + 2?", "Who won the World Cup?",
    "Can you help me with my homework?", "Tell me a joke.", "What's the weather today?",
    "Explain quantum computing.", "Who is the president of the United States?", "Translate hello to French.",
    "What's the best programming language?", "Recommend a good movie.", "How do I cook pasta?",
    "What's the meaning of life?", "Write a Python function to sort a list.", "What's the stock price of Apple?",
    "Who invented the telephone?", "How far is the moon?", "Can you write my cover letter?",
    "What is machine learning?", "Summarize the news today.", "Who are you voting for?",
    "Give me a recipe for tacos.", "What time is it?",
]


# ── shared answers and phrasings (also used by synthetic.py) ────────────────

SKILL_TEMPLATES = ["Does he know {s}?", "Has he used {s}?", "Is he familiar with {s}?",
                   "What experience does he have with {s}?", "Can he work with {s}?"]

PROJECT_UNKNOWN_TEMPLATES = ["What is {n}?", "Tell me about {n}.", "What did he build for {n}?", "Describe {n}.",
                             "What tech stack did he use for {n}?", "What was his role in {n}?",
                             "Did {n} win any awards?"]


def skill_train_templates() -> list[str]:
    """Every skill phrasing except the two that skill.has holds out for dev and test."""
    return EXTRA_TRAIN_TEMPLATES["skill.has"] + SKILL_TEMPLATES[:-2]


def skill_unknown_templates(split: str) -> list[str]:
    return skill_train_templates() if split == "train" else SKILL_TEMPLATES


def unknown_skill_answer(tech: str, email: str) -> str:
    return (f"I don't have any information about {tech} in Alfonso's profile, so I can't say. "
            f"You can ask him directly at {email}.")


def unknown_project_answer(name: str) -> str:
    return (f"I don't know of a project called {name} in Alfonso's portfolio. "
            f"You can see all of his projects at {SITE}/projects.")


def _norm_question(q: str) -> str:
    return q.lower().rstrip("?.!").strip()


def dedupe(examples: list[QA]) -> list[QA]:
    """Drop repeated questions, keeping the first one.

    Example: "What is ZapTap?" is both a company question and a project question,
    with two different answers. Training on both would teach the model to guess.
    """
    seen, out = set(), []
    for ex in examples:
        key = _norm_question(ex.question)
        if key not in seen:
            seen.add(key)
            out.append(ex)
    return out


# More ways to ask each question, used ONLY for training (v2). After the v1 run,
# error analysis showed 99% exact match on phrasings seen in training vs 34% on new
# ones: the model had memorized wording. More phrasing variety is the fix.
EXTRA_TRAIN_TEMPLATES: dict[str, list[str]] = {
    "profile.about": ["Who's Alfonso?", "What's Alfonso's background?", "Introduce Alfonso.",
                      "Can you tell me who Alfonso is?", "What should I know about Alfonso?",
                      "Summarize Alfonso's profile.", "Give me an overview of Alfonso.",
                      "Who is the person behind this site?"],
    "profile.looking_for": ["What roles is he interested in?", "Is he open to work?", "Is Alfonso job hunting?",
                            "What opportunities is he looking for?", "Would he consider an ML internship?",
                            "Is he available for hire?", "What position is he seeking?", "Is he looking for a job?"],
    "profile.contact": ["How do I get in touch with Alfonso?", "What is Alfonso's email address?",
                        "Where can I contact him?", "How can I reach out to him?", "Is there a way to contact Alfonso?",
                        "Can I email him?", "What's his contact info?"],
    "profile.location": ["Which city is Alfonso based in?", "Where is Alfonso based?", "Is he located in Washington?",
                         "Where does he work from?", "What's his location?"],
    "profile.languages": ["Which languages does he speak?", "Does Alfonso speak English?", "Can he speak German?",
                          "Is he fluent in English?", "What languages can Alfonso communicate in?",
                          "Does he speak any other languages?"],
    "greeting": ["Hey", "Good morning", "Hi there!", "Hello, who am I talking to?", "What are you?",
                 "How does this work?"],
    "education.current": ["Where does Alfonso go to school?", "What's he majoring in?", "Which university is he at?",
                          "What degree is he pursuing?", "When will he finish his degree?",
                          "What year is he expected to graduate?", "Does he go to UW?"],
    "education.gpa": ["What is Alfonso's GPA?", "How good are his grades?", "What were his grades like?",
                      "Tell me his GPA."],
    "education.before": ["Where did Alfonso study before?", "What's his educational background?",
                         "Where else has he studied?", "Did he transfer to UW?", "What was his path to UW?"],
    "education.bellevue": ["Did Alfonso go to Bellevue College?", "What courses did he take at Bellevue College?",
                           "What did he study at Bellevue College?", "When was he at Bellevue College?"],
    "education.certifications": ["Does he have any certifications?", "What courses has he taken online?",
                                 "Has he completed the Machine Learning Specialization?",
                                 "Which certificates does Alfonso have?", "What has he learned outside of school?",
                                 "Did he study deep learning online?"],
    "experience.overview": ["What's {c}?", "Explain {c} to me.", "What is {c} about?", "Give me an overview of {c}.",
                            "What kind of organization is {c}?", "Describe {c}."],
    "experience.role": ["What was Alfonso's role at {c}?", "What is his position at {c}?", "What did he do at {c}?",
                        "What is he responsible for at {c}?", "What's his title at {c}?",
                        "Tell me about his work at {c}."],
    "experience.dates": ["Since when has he been at {c}?", "When did Alfonso start at {c}?",
                         "How long did he work at {c}?", "What dates was he at {c}?", "When was he part of {c}?"],
    "experience.stack": ["What stack does he use at {c}?", "Which technologies did he use at {c}?",
                         "What tech does he work with at {c}?", "What languages and tools does he use at {c}?"],
    "project.overview": ["What's {t}?", "Describe {t}.", "What does {t} do?", "Give me an overview of {t}.",
                         "Explain {t} to me.", "I want to know about {t}.", "What is the {t} project?"],
    "project.built": ["What did he make in {t}?", "What features did he build for {t}?", "What does {t} include?",
                      "Which parts of {t} did he build?", "Describe what he built for {t}.",
                      "What did Alfonso create for {t}?", "What are the components of {t}?"],
    "project.stack": ["What stack does {t} use?", "What's the tech stack of {t}?",
                      "Which technologies did Alfonso use in {t}?", "What tools power {t}?",
                      "What frameworks does {t} use?", "Tech stack for {t}?", "What did he use to build {t}?"],
    "project.role": ["What did he do in {t}?", "What part did Alfonso play in {t}?", "Who built {t}?",
                     "How many people worked on {t}?", "What was Alfonso responsible for in {t}?",
                     "Did he build {t} alone?", "What was his contribution to {t}?"],
    "project.problem": ["What is the problem behind {t}?", "What problem was {t} built to solve?", "Why does {t} exist?",
                        "What pain point does {t} tackle?", "What's the purpose of {t}?", "What issue does {t} fix?"],
    "project.results": ["What results did {t} get?", "What was the outcome of {t}?", "Did {t} have any results?",
                        "How well did {t} work?", "What came out of {t}?", "Was {t} successful?"],
    "project.award": ["Did {t} get any awards?", "Did {t} win a hackathon?", "Has {t} won anything?",
                      "Any awards for {t}?", "Did {t} place in a competition?"],
    "project.links": ["Is there a live version of {t}?", "Where can I find {t}?", "Do you have a link for {t}?",
                      "Can I see a demo of {t}?", "Is {t} online?", "Where's the code for {t}?"],
    "award.detail": ["What did Alfonso win at {e}?", "How did he place at {e2}?", "What was his result at {e}?",
                     "Did he win at {e2}?", "What did he do at {e}?"],
    "award.list": ["Has he won any awards?", "What awards does Alfonso have?", "What hackathons has he won?",
                   "Tell me about his awards.", "What are his biggest wins?", "Has he received any recognition?"],
    "skill.has": ["Does Alfonso know {s}?", "Has Alfonso worked with {s}?", "Does he use {s}?", "Is he good at {s}?",
                  "Do you know if he knows {s}?", "Has he ever used {s}?", "Does he have {s} experience?",
                  "Is {s} one of his skills?"],
    "skill.group": ["What {g} skills does he have?", "How strong is he in {g}?", "List his {g} skills.",
                    "What does Alfonso know in {g}?", "Which {g} technologies does he know?"],
    "skill.programming_languages": ["Which languages does he program in?", "What coding languages does Alfonso know?",
                                    "What programming languages has he used?",
                                    "Does he know any programming languages?",
                                    "List the programming languages he uses."],
}


# ── post-processing ──────────────────────────────────────────────────────────


def add_casual_variants(examples: list[QA], seed: int = 42, rate: float = 0.25) -> None:
    """Real visitors type 'does he know pytorch' — lowercase, no punctuation.

    A fixed fraction of questions (chosen with a fixed seed, so it's reproducible)
    is rewritten that way, in every split, so training and evaluation both see it.
    """
    rng = random.Random(seed)
    for ex in examples:
        if rng.random() < rate:
            ex.question = ex.question.lower().rstrip("?.!").strip()


def to_record(ex: QA) -> dict:
    return asdict(ex)
