"""Loads ml/data/knowledge.json and turns it into retrieval chunks.

A *chunk* is one self-contained paragraph about one thing (a project, a role,
an award…). Later, the retriever (TF-IDF) finds the best chunk for a question
and the model answers by reading it. Every Q&A example in the dataset points to
the chunk(s) that contain its answer — its `gold_chunks`.
"""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path

from .text import (
    as_he_sentence,
    ensure_period,
    format_date_range,
    format_year_month,
    join_list,
    school_phrase,
    slugify,
    to_third_person,
    with_article,
)

SUPPORTED_SCHEMA = 1


@dataclass
class Chunk:
    id: str
    title: str
    text: str
    source: str  # which data file it came from, for debugging and the Lab page
    # Names a visitor would type to mean this chunk ("IdentifEye", "Answr", "HackMX").
    # The retriever boosts a chunk whose entity name appears in the question.
    entities: list[str] = field(default_factory=list)


class Knowledge:
    """Typed-ish access to the exported site data, plus derived lookups."""

    def __init__(self, raw: dict):
        if raw.get("schemaVersion") != SUPPORTED_SCHEMA:
            raise ValueError(
                f"knowledge.json schemaVersion {raw.get('schemaVersion')} != {SUPPORTED_SCHEMA}. "
                "Re-run `npm run export:knowledge` or update ml/askalfonso."
            )
        self.profile: dict = raw["profile"]
        self.experience: list[dict] = raw["experience"]
        self.projects: list[dict] = raw["projects"]
        self.awards: list[dict] = raw["awards"]
        self.skill_groups: list[dict] = raw["skillGroups"]
        self.certifications: list[dict] = raw["certifications"]

        self.name: str = self.profile["shortName"]
        self.email: str = self.profile["email"]
        self.project_by_slug = {p["slug"]: p for p in self.projects}
        self.award_by_id = {a["id"]: a for a in self.awards}
        self.tech_sources = self._build_tech_sources()
        self.chunk_techs = self._build_chunk_techs()

    @classmethod
    def load(cls, path: Path) -> "Knowledge":
        return cls(json.loads(path.read_text(encoding="utf-8")))

    # ── derived lookups ──────────────────────────────────────────────────────

    def _build_tech_sources(self) -> dict[str, list[tuple[str, str]]]:
        """Every technology mentioned anywhere -> [(title, chunk_id)] of the projects/roles that use it.

        Merges skills.ts with the stacks of projects and roles, so a tool that
        only appears in a stack (e.g. Flutter at Fitness Tech) is still "known".
        """
        sources: dict[str, list[tuple[str, str]]] = {}

        def add(tech: str, where: tuple[str, str] | None) -> None:
            bucket = sources.setdefault(tech, [])
            if where and where not in bucket:
                bucket.append(where)

        for group in self.skill_groups:
            for skill in group["skills"]:
                add(skill["name"], None)
                for slug in skill["projectSlugs"]:
                    add(skill["name"], (self.project_by_slug[slug]["title"], f"project/{slug}"))
        for project in self.projects:
            for tech in project["stack"]:
                add(tech, (project["title"], f"project/{project['slug']}"))
        for job in self.experience:
            for tech in job["stack"]:
                add(tech, (job["company"], f"experience/{job['id']}"))
        return sources

    def _build_chunk_techs(self) -> dict[str, list[str]]:
        """chunk id -> technology names (with aliases) it mentions, so "Does he know Keras?"
        boosts every chunk that can answer it, like a project name does."""
        techs: dict[str, list[str]] = {}

        def add(chunk_id: str, tech: str) -> None:
            bucket = techs.setdefault(chunk_id, [])
            bucket += [a for a in tech_aliases(tech) if a not in bucket]

        for group in self.skill_groups:
            for skill in group["skills"]:
                add(skill_chunk_id(group), skill["name"])
                for slug in skill["projectSlugs"]:
                    add(f"project/{slug}", skill["name"])
        for project in self.projects:
            for tech in project["stack"]:
                add(f"project/{project['slug']}", tech)
        for job in self.experience:
            for tech in job["stack"]:
                add(f"experience/{job['id']}", tech)
        return techs

    def grounding_facts(self) -> dict[str, str]:
        """chunk id -> facts the model may state about that chunk's project that the chunk
        text itself doesn't spell out (its award, links and case-study URL).

        Since v3 these facts are also in the chunk text. They're kept here so a model
        trained before v3 (whose chunks lacked them) still passes the grounding check
        for a correct link or award — see ml/README.md, Phase 5.
        """
        facts = {}
        for proj in self.projects:
            parts = [f"{SITE}/projects/{proj['slug']}"]
            parts += [f"{LINK_LABELS[k]}: {url}" for k, url in proj.get("links", {}).items() if url and k in LINK_LABELS]
            award = self.award_for(proj)
            if award:
                parts.append(f"{award['placement']} at {award['event']} ({award['year']})")
            facts[f"project/{proj['slug']}"] = " ".join(parts)
        return facts

    def skill_group_chunk(self, tech: str) -> str | None:
        for group in self.skill_groups:
            if any(s["name"] == tech for s in group["skills"]):
                return skill_chunk_id(group)
        return None

    def award_for(self, project: dict) -> dict | None:
        return self.award_by_id.get(project.get("awardId") or "")

    def first_place_wins(self) -> list[dict]:
        return [a for a in self.awards if a["kind"] == "win" and a["placement"] == "1st Place"]

    def ventures(self) -> list[dict]:
        return [e for e in self.experience if "Founder" in e["role"]]

    def contact_sentence(self) -> str:
        return f"You can reach {self.name} at {self.email} or on LinkedIn."

    # ── chunks ──────────────────────────────────────────────────────────────

    def chunks(self) -> list[Chunk]:
        chunks = [
            *self._profile_chunks(),
            *self._education_chunks(),
            *self._experience_chunks(),
            *self._project_chunks(),
            *self._award_chunks(),
            *self._skill_chunks(),
            self._certifications_chunk(),
        ]
        for chunk in chunks:
            chunk.entities += [t for t in self.chunk_techs.get(chunk.id, []) if t not in chunk.entities]
        return chunks

    def _profile_chunks(self) -> list[Chunk]:
        p = self.profile
        uw = p["education"][0]
        wins = self.first_place_wins()
        about = (
            f"{p['name']} (Alfonso) is a Computer Science student at {school_phrase(uw['school'])}, focused on "
            f"{join_list([f.lower() for f in p['focusAreas'][:3]])}. "
            f"He won 1st place at {join_list([a['event'] for a in wins])}, and he founded "
            f"{join_list([v['company'] for v in self.ventures()])}. He is based in the {p['location']}."
        )
        looking = f"{to_third_person(p['lookingFor']['long'])} {self.contact_sentence()} His email is {p['email']}."
        langs = "Languages Alfonso speaks: " + join_list(
            [f"{l['language']} ({l['level'].lower()})" for l in p["spokenLanguages"]]
        ) + "."
        return [
            Chunk("profile/about", "About Alfonso", about, "profile.ts", ["background", "bio", "biography"]),
            Chunk("profile/looking-for", "What Alfonso is looking for and how to contact him", looking, "profile.ts"),
            Chunk("profile/languages", "Spoken languages", langs, "profile.ts"),
        ]

    def _education_chunks(self) -> list[Chunk]:
        chunks = []
        for edu in self.profile["education"]:
            parts = [f"Alfonso studied {edu['degree']} at {edu['school']} in {edu['location']}."]
            if edu.get("dates"):
                parts.append(f"Dates: {format_date_range(edu['dates'])}.")
            if edu.get("expectedGraduation"):
                parts.append(f"Expected graduation: {format_year_month(edu['expectedGraduation'])}.")
            if edu.get("gpa"):
                parts.append(f"GPA: {edu['gpa']}.")
            parts.append(f"Relevant coursework: {join_list(edu['coursework'])}.")
            parts += [ensure_period(n) for n in edu.get("notes", [])]
            name = edu["school"].split(" — ")[0]
            chunks.append(Chunk(education_chunk_id(edu), edu["school"], " ".join(parts), "profile.ts",
                                [name, *SCHOOL_ALIASES.get(name, []), "education", "academic"]))
        return chunks

    def _experience_chunks(self) -> list[Chunk]:
        chunks = []
        for job in self.experience:
            text = (
                f"{job['company']} is {with_article(job['summary'])} "
                f"Alfonso's role: {job['role']} ({format_date_range(job['dates'])}). "
                + " ".join(ensure_period(as_he_sentence(h)) for h in job["highlights"])
                + f" Stack: {join_list(job['stack'])}."
            )
            chunks.append(Chunk(f"experience/{job['id']}", f"{job['role']} at {job['company']}", text, "experience.ts",
                                [job["company"]]))
        return chunks

    def _project_chunks(self) -> list[Chunk]:
        chunks = []
        for proj in self.projects:
            parts = [f"{proj['title']}: {to_third_person(ensure_period(proj['pitch']))}"]
            parts.append(f"The problem: {proj['problem']}")
            parts.append("What Alfonso built: " + " ".join(ensure_period(b) for b in proj["built"]))
            parts.append(f"His role: {proj['role']}.")
            if proj.get("teamSize"):
                parts.append("It was a solo project." if proj["teamSize"] == 1 else f"Team size: {proj['teamSize']}.")
            parts.append(f"Stack: {join_list(proj['stack'])}.")
            if proj.get("results"):
                parts.append("Results: " + " ".join(ensure_period(r) for r in proj["results"]))
            # v3: the award and links live in the project's own chunk, so "Did X win
            # anything?" and "Is there a demo of X?" can be answered by reading it.
            award = self.award_for(proj)
            if award:
                parts.append(f"Award: {award['placement']} at {award['event']} ({award['year']}).")
            links = [f"{LINK_LABELS[k]}: {url}" for k, url in proj.get("links", {}).items() if url and k in LINK_LABELS]
            links.append(f"Case study: {SITE}/projects/{proj['slug']}")
            parts.append("Links: " + "; ".join(links) + ".")
            if proj.get("year"):
                parts.append(f"Year: {proj['year']}.")
            if proj["status"] == "in-progress":
                parts.append("Status: in progress.")
            # "Answr AI Agent" is also reachable as "Answr"; "PDF Chatbot (RAG)" as "PDF Chatbot".
            names = [proj["title"], proj["title"].split(" (")[0]]
            chunks.append(Chunk(f"project/{proj['slug']}", proj["title"], " ".join(parts), "projects.ts",
                                list(dict.fromkeys(names))))
        return chunks

    def _award_chunks(self) -> list[Chunk]:
        return [
            Chunk(
                f"award/{a['id']}",
                f"{a['placement']} — {a['title']}",
                f"{a['placement']} — {a['title']}, at {a['event']} ({a['year']}), organized by {a['organizer']}. "
                f"{as_he_sentence(to_third_person(a['summary']))}",
                "awards.ts",
                award_aliases(a["event"]),
            )
            for a in self.awards
        ]

    def _skill_chunks(self) -> list[Chunk]:
        chunks = []
        for group in self.skill_groups:
            items = []
            for skill in group["skills"]:
                where = [self.project_by_slug[s]["title"] for s in skill["projectSlugs"]]
                items.append(f"{skill['name']} (used in {join_list(where)})" if where else f"{skill['name']} (coursework)")
            text = f"Alfonso's {group['name']} skills: {'; '.join(items)}."
            chunks.append(Chunk(skill_chunk_id(group), group["name"], text, "skills.ts"))
        return chunks

    def _certifications_chunk(self) -> Chunk:
        lines = []
        for c in self.certifications:
            when = f", {format_year_month(c['date'])}" if c.get("date") else ""
            score = f", score {c['score']}" if c.get("score") else ""
            lines.append(f"{c['title']} ({c['issuer']}{when}{score})")
        text = "Alfonso's certifications and courses: " + "; ".join(lines) + "."
        return Chunk("certifications", "Certifications and courses", text, "certifications.ts")


def tech_aliases(name: str) -> list[str]:
    """How a visitor might type a skill: 'TensorFlow / Keras' -> TensorFlow, Keras;
    'Google Cloud (Vertex AI, Cloud Run)' -> Google Cloud, Vertex AI, Cloud Run;
    'n8n & webhooks' -> n8n, webhooks."""
    out = [name]
    head, _, inner = name.partition(" (")
    parts = [head] + [x.strip() for x in inner.rstrip(")").split(",") if x.strip()]
    for part in parts:
        for piece in re.split(r" / | & ", part):
            out.append(piece.strip())
    return list(dict.fromkeys(p for p in out if p))


SITE = "alfonsovegasol.com"
LINK_LABELS = {"site": "Live site", "demo": "Live demo", "repo": "Source code", "video": "Demo video"}


# How visitors actually refer to schools.
SCHOOL_ALIASES = {
    "University of Washington": ["UW", "Allen School"],
    "Tecnológico de Monterrey": ["Tec de Monterrey", "Tec", "ITESM"],
}


def award_aliases(event: str) -> list[str]:
    """'HackMX 6th Edition' -> ['HackMX 6th Edition', 'HackMX']; skips generic first words like 'Making'."""
    full = event.split(",")[0].split(" (")[0]
    first = full.split(" ")[0]
    names = [full]
    if first != full and first.lower() not in {"making", "the", "annual", "international"}:
        names.append(first)
    return names


def education_chunk_id(edu: dict) -> str:
    return f"education/{slugify(edu['school'].split(' — ')[0])}"


def skill_chunk_id(group: dict) -> str:
    return f"skills/{slugify(group['name'])}"


def chunk_to_dict(chunk: Chunk) -> dict:
    return asdict(chunk)
