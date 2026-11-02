"""Synthetic "reading practice": fake projects with random names, stacks and roles.

The problem it solves
    Every real fact appears in training, so a model could get every real question
    right by *memorizing* ("IdentifEye → Vertex AI") instead of *reading* the
    context. That model would break the day a new project is added to the site.

The fix
    Each epoch we invent fresh fake projects ("Toravi Lens, built with Rust and
    Flask…") and generate Q&A about them with the same templates as the real data.
    Their names and stacks are random and change every epoch, so memorizing is
    impossible: the only way to get them right is to copy facts from the context.

    The real facts teach the answer *style*; the fake ones teach *reading*.

    The same trick teaches honest refusals: every epoch also asks about invented
    technologies ("Does he know Zorvex DB?") and projects that don't exist. A fixed
    list of unknowns can be memorized; an endless stream forces the model to copy
    the name from the question and say it doesn't know.

Two leakage guards
    • Only paraphrase templates from the *train* split are used, so the test set's
      unseen phrasings stay unseen.
    • Technologies used as dev/test "unknown skill" refusals are never placed in a
      fake stack, so those refusals stay unseen too.
"""

from __future__ import annotations

import random

from collections import defaultdict

from .knowledge import Chunk, Knowledge
from .qa import (
    PROJECT_UNKNOWN_TEMPLATES,
    QA,
    QAGenerator,
    skill_train_templates,
    unknown_project_answer,
    unknown_skill_answer,
)

SYLLABLES = ["ka", "lo", "mi", "ra", "ve", "zu", "to", "ne", "sa", "qui", "dor", "len", "vi", "ta", "mo", "rex",
             "pa", "li", "no", "ga", "fe", "tri", "so", "ul", "ber", "cam", "dex", "or", "ni", "plu"]
SUFFIXES = ["", "", "", " AI", " Lens", " Hub", " Bot", " Lab", " Flow", " Pulse"]

# Technologies by role, so built items read naturally ("Deployment on Vercel", never "on PyTorch").
TECH = {
    "backend": ["Python", "Node.js", "Flask", "Django", "FastAPI", "Spring Boot", "ASP.NET Core", "Go", "Rust",
                "Java", "PHP"],
    "frontend": ["React", "Next.js", "Vue", "Angular", "Svelte", "TypeScript", "Tailwind CSS", "Swift", "Kotlin",
                 "Flutter", "Unity"],
    "ml": ["PyTorch", "TensorFlow", "scikit-learn", "OpenCV", "Pandas", "NumPy", "XGBoost", "Hugging Face"],
    "llm": ["OpenAI API", "Claude API", "Gemini Vision", "LangChain", "ChromaDB", "LlamaIndex"],
    "data": ["PostgreSQL", "MySQL", "MongoDB", "Redis", "Supabase", "Firebase", "Kafka", "Snowflake"],
    "cloud": ["AWS Lambda", "Google Cloud Run", "Docker", "Kubernetes", "Terraform", "Vercel", "Azure"],
    "hardware": ["ESP32", "Arduino", "Raspberry Pi"],
}
BUILT = {
    "backend": ["A REST API built with {t}", "Backend services in {t}", "Background jobs written in {t}"],
    "frontend": ["The user interface in {t}", "A responsive front end with {t}", "Real-time screens built in {t}"],
    "ml": ["A model trained with {t} on a labeled dataset", "Feature engineering and evaluation with {t}"],
    "llm": ["LLM features powered by {t}", "Retrieval over documents using {t}"],
    "data": ["Data storage on {t}", "A {t} schema for users and events"],
    "cloud": ["Deployment on {t}", "Infrastructure managed with {t}"],
    "hardware": ["Firmware for {t} that streams sensor readings"],
}
TECH_POOL = sorted({t for techs in TECH.values() for t in techs})

THINGS = ["web app", "mobile app", "dashboard", "chatbot", "recommendation engine", "classifier", "API",
          "browser extension", "IoT device", "data pipeline", "game", "analytics platform", "voice assistant"]
PURPOSES = [
    "helps students plan their study schedules", "predicts equipment failures from sensor data",
    "matches volunteers with local nonprofits", "summarizes long legal documents", "tracks gym workouts and progress",
    "detects spam in customer messages", "recommends recipes from what's in the fridge",
    "monitors air quality in classrooms", "translates sign language from video", "forecasts restaurant demand",
    "finds the cheapest flights across airlines", "grades coding assignments automatically",
    "helps farmers detect crop disease from photos", "organizes receipts for small businesses",
]
PROBLEMS = [
    "Doing this by hand took hours every week and errors were common.",
    "Existing tools were too expensive for small teams.",
    "People didn't have a simple way to see this information in one place.",
    "The data existed, but nobody could act on it in time.",
    "Most solutions only worked in English and on desktop.",
]
ROLES = ["Backend engineer", "ML engineer", "Full-stack developer", "Team lead & developer", "Data engineer",
         "Front-end developer", "Developer & presenter"]
# Real technologies that never appear in the site data or in TECH_POOL, so a refusal
# about them can never contradict a (real or fake) chunk in the context.
EXTRA_UNKNOWN_TECH = ["Elm", "Clojure", "F#", "Julia", "Perl", "Lua", "Dart", "Erlang", "OCaml", "Zig", "Nim",
                      "Fortran", "COBOL", "Cassandra", "DynamoDB", "Neo4j", "Elasticsearch", "RabbitMQ", "Airflow",
                      "Databricks", "Looker", "Jenkins", "Prometheus", "Grafana", "Nginx", "jQuery", "Laravel",
                      "Express", "Ruby", "Haskell", "Scala", "Tableau", "Solidity", "Ansible"]
TECH_SUFFIXES = [".js", " DB", "Lang", " ML", "OS", "Kit", "Stack", "Script"]

RESULTS = [
    "Reached {n}% accuracy on the test set.", "Cut processing time from {m} minutes to under {s} seconds.",
    "Used by {u} students during the pilot.", "Placed in the top {k} at the final demo.",
]


def _name(rng: random.Random, taken: set[str]) -> str:
    while True:
        base = "".join(rng.choice(SYLLABLES) for _ in range(rng.choice([2, 2, 3])))
        name = base.capitalize() + rng.choice(SUFFIXES)
        if name.lower() not in taken:
            taken.add(name.lower())
            return name


def fake_project(rng: random.Random, taken: set[str], banned_tech: set[str]) -> dict:
    title = _name(rng, taken)
    slug = title.lower().replace(" ", "-")
    kinds = rng.sample(list(TECH), rng.randint(3, 5))
    picked: list[tuple[str, str]] = []
    for kind in kinds:
        options = [t for t in TECH[kind] if t.lower() not in banned_tech]
        if options:
            picked.append((kind, rng.choice(options)))
    stack = [t for _, t in picked]
    team = rng.choice([1, 2, 3, 4, 5, 6])
    built = [rng.choice(BUILT[kind]).format(t=tech) for kind, tech in picked]
    if rng.random() < 0.5:
        built.append("Authentication and user roles")
    results = []
    if rng.random() < 0.5:
        results.append(rng.choice(RESULTS).format(n=rng.randint(80, 99), m=rng.randint(5, 60), s=rng.randint(2, 30),
                                                   u=rng.randint(20, 500), k=rng.randint(3, 10)))
    links = {}
    if rng.random() < 0.3:
        links["site"] = f"https://{slug}.example.com"
    if rng.random() < 0.2:
        links["video"] = f"https://youtu.be/{''.join(rng.choice('abcdefghijkLMNOPQ0123456789') for _ in range(11))}"
    thing = rng.choice(THINGS)
    article = "An" if thing[0].lower() in "aeiou" else "A"
    return {
        "slug": slug,
        "title": title,
        "pitch": f"{article} {thing} that {rng.choice(PURPOSES)}.",
        "categories": ["ai-ml"],
        "featured": False,
        "status": rng.choice(["shipped", "shipped", "prototype", "in-progress"]),
        "year": rng.randint(2022, 2026),
        "teamSize": team,
        "role": "Solo project" if team == 1 else rng.choice(ROLES),
        "problem": rng.choice(PROBLEMS),
        "built": built,
        "stack": stack,
        "results": results,
        "links": links,
    }


def fake_knowledge(real: Knowledge, n_projects: int, rng: random.Random, banned_tech: set[str]) -> Knowledge:
    taken = {p["title"].lower() for p in real.projects}
    projects = [fake_project(rng, taken, banned_tech) for _ in range(n_projects)]
    return Knowledge({
        "schemaVersion": 1,
        "profile": real.profile,  # same name, email and assistant name as the real one
        "experience": [],
        "projects": projects,
        "awards": [],
        "skillGroups": [],
        "certifications": [],
    })


def synthetic_examples(
    real: Knowledge, n_projects: int, rng: random.Random, banned_tech: set[str], per_intent: int = 2
) -> tuple[list[QA], dict[str, str]]:
    """Fresh fake projects → (Q&A using train templates only, {chunk_id: text}).

    Keeps `per_intent` random phrasings per (intent, project), so synthetic data
    stays a minority next to the real examples.
    """
    kb = fake_knowledge(real, n_projects, rng, banned_tech)
    chunks: list[Chunk] = kb._project_chunks()
    gen = QAGenerator(kb)
    gen._projects()
    gen._skills()
    groups: dict[tuple[str, str], list[QA]] = defaultdict(list)
    for ex in gen.examples:
        if ex.split == "train":
            groups[(ex.intent, ex.id.split(":")[1])].append(ex)
    examples = []
    for group in groups.values():
        examples += rng.sample(group, min(per_intent, len(group)))
    for ex in examples:
        ex.id = f"synthetic:{ex.id}"
    return examples, {c.id: c.text for c in chunks}


def invented_tech(rng: random.Random) -> str:
    base = "".join(rng.choice(SYLLABLES) for _ in range(2)).capitalize()
    return base + rng.choice(TECH_SUFFIXES)


def synthetic_refusals(
    real: Knowledge, rng: random.Random, n_tech: int, n_projects: int, banned_tech: set[str]
) -> list[QA]:
    """Questions about technologies and projects that don't exist anywhere in the data."""
    known = {a.lower() for t in real.tech_sources for a in [t, t.split(" (")[0], *t.split(" / ")]}
    known |= {t.lower() for t in TECH_POOL} | banned_tech
    real_unknown = [t for t in EXTRA_UNKNOWN_TECH if t.lower() not in known]
    taken = {p["title"].lower() for p in real.projects}
    templates = skill_train_templates()
    out = []
    for i in range(n_tech):
        tech = rng.choice(real_unknown) if rng.random() < 0.5 else invented_tech(rng)
        for template in rng.sample(templates, 2):
            out.append(QA(id=f"synthetic:skill.unknown:{tech}:{i}", intent="skill.unknown", type="unknown_skill",
                          question=template.format(s=tech), answer=unknown_skill_answer(tech, real.email),
                          gold_chunks=[], split="train"))
    for i in range(n_projects):
        name = _name(rng, taken)
        for template in rng.sample(PROJECT_UNKNOWN_TEMPLATES, 2):
            out.append(QA(id=f"synthetic:project.unknown:{name}:{i}", intent="project.unknown",
                          type="unknown_entity", question=template.format(n=name),
                          answer=unknown_project_answer(name), gold_chunks=[], split="train"))
    return out
