"""Phase 7 — export Ask Alfonso so it runs in the visitor's browser, with no server.

    python ml/export_web.py --checkpoint ml/checkpoints/colab-v6/best.pt
    → public/ask-alfonso/model.bin       weights, float16 (~7.7 MB)
      public/ask-alfonso/model.json      shapes, offsets, config, tokenizer
      public/ask-alfonso/knowledge.json  chunks, TF-IDF index, guardrail rules
      ml/results/web_reference.json      Python's answers, to test the TypeScript port (npm run test:ask-alfonso)

Why the browser: the site is static on Vercel, so a model that runs client-side costs
nothing to serve — no GPU, no server, no cold starts, and it scales with visitors for
free. The model is small enough (3.9M parameters) to download once and run in plain
TypeScript in a Web Worker (src/lib/ask-alfonso/).

Why float16: half the size of float32 with no measurable change in answers (the
reference file below is computed with the same rounded weights, and the TypeScript
port is tested against it).

Everything the browser needs that isn't code comes from here — stopwords, synonyms,
private-topic patterns, refusal openings — so Python and TypeScript can't drift apart.
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

ML = Path(__file__).resolve().parent
sys.path.insert(0, str(ML))

import numpy as np  # noqa: E402
import torch  # noqa: E402

from askalfonso import guardrails as G  # noqa: E402
from askalfonso import retrieval as R  # noqa: E402
from askalfonso.knowledge import SITE, Knowledge, award_aliases, tech_aliases  # noqa: E402
from askalfonso.pipeline import AskAlfonso, PipelineConfig  # noqa: E402
from askalfonso.prompt import ANSWER, CONTEXT, END, QUESTION  # noqa: E402

SITE_ROOT = ML.parent
OUT = SITE_ROOT / "public" / "ask-alfonso"

# The order the browser reads tensors in. lm_head is tied to tok_emb, so it isn't stored twice.
def tensor_names(n_layer: int) -> list[str]:
    names = ["tok_emb.weight", "pos_emb.weight"]
    for i in range(n_layer):
        p = f"blocks.{i}."
        names += [p + "ln1.weight", p + "attn.qkv.weight", p + "attn.proj.weight", p + "ln2.weight",
                  p + "mlp.fc.weight", p + "mlp.proj.weight"]
    return names + ["ln_f.weight"]


def export_model(bot: AskAlfonso, ckpt: dict) -> dict:
    cfg = ckpt["config"]
    if cfg.get("bias"):
        raise ValueError("The browser port assumes bias=False (as trained).")
    state = bot.model.state_dict()
    blobs, tensors, offset = [], [], 0
    for name in tensor_names(cfg["n_layer"]):
        array = state[name].detach().cpu().float().numpy().astype(np.float16)
        blobs.append(array.tobytes())  # little-endian, row-major (out_features × in_features for Linear)
        tensors.append({"name": name, "shape": list(array.shape), "offset": offset})
        offset += array.size
    (OUT / "model.bin").write_bytes(b"".join(blobs))
    tok = bot.tok
    return {
        "format": "ask-alfonso/fp16-v1",
        "config": {k: cfg[k] for k in ("vocab_size", "block_size", "n_layer", "n_head", "n_embd")},
        "layer_norm_eps": 1e-5,
        "tensors": tensors,
        "parameters": offset,
        "tokenizer": {
            "pattern": tok.to_dict()["pattern"],
            "merges": [list(p) for p in tok.merges],
            "special_tokens": tok.special_tokens,
            "prompt": {"context": CONTEXT, "question": QUESTION, "answer": ANSWER, "end": END},
        },
        "trained": ckpt.get("meta", {}).get("trained_at"),
    }


def export_knowledge(bot: AskAlfonso, kb: Knowledge) -> dict:
    r = bot.retriever
    return {
        "retrieval": {
            "stopwords": sorted(R.STOPWORDS),
            "synonyms": R.SYNONYMS,
            "entity_bonus": r.entity_bonus,
            "idf": r.idf,
            "name_words": sorted(R.NAME_WORDS),
            "profile_chunk": R.PROFILE_CHUNK,
            "about_question": R.ABOUT_QUESTION,
            "chunks": [
                {"id": c["id"], "title": c["title"], "text": c["text"], "vector": vec,
                 "entities": [sorted(e) for e in ents], "techs": [sorted(t) for t in techs], "tech_bonus": tb,
                 "facts": bot.facts.get(c["id"], "")}
                for c, vec, ents, techs, tb in zip(r.chunks, r.vectors, r.entity_words, r.tech_words, r.tech_bonuses)
            ],
        },
        "pipeline": {
            "threshold": bot.cfg.threshold,
            "relative": bot.cfg.relative,
            "max_chunks": bot.cfg.max_chunks,
            "max_new_tokens": bot.cfg.max_new_tokens,
            "context_separator": "\n",
        },
        "guardrails": {
            "private_patterns": G.PRIVATE_PATTERNS,
            "refusal_prefixes": list(G.REFUSAL_PREFIXES),
            "greeting_prefix": G.GREETING_PREFIX,
            "common_capitalized": sorted(G.COMMON_CAPITALIZED),
            "generic_acronyms": sorted(G.GENERIC_ACRONYMS),
            "allowlist": bot.allowlist,
            "known_names": bot.known_names,
            "private_answer": bot.private_answer,
            "fallback": bot.fallback,
        },
        "query": export_query(kb),
        "site": SITE,
        # The model writes model_email (the address it was trained with); replies show email.
        "contact": {"email": bot.email, "model_email": bot.model_email},
    }


def export_query(kb: Knowledge) -> dict:
    """Names for the browser's query rewriter (src/lib/ask-alfonso/rewrite.ts): follow-ups
    ("what about X?") and other names for the same thing (".NET Core" → ASP.NET Core MVC)."""
    techs = set()
    for name in kb.tech_sources:
        techs.update(tech_aliases(name))
    skills = []
    for group in kb.skill_groups:
        for skill in group["skills"]:
            if skill.get("aliases"):  # kept apart from techs: the rewriter replaces these with skill["name"]
                skills.append({"name": skill["name"], "aliases": skill["aliases"]})
    return {
        "skills": skills,
        "groups": [{"name": g["name"], "aliases": g.get("aliases", [])} for g in kb.skill_groups],
        "techs": sorted(techs, key=lambda t: (-len(t), t)),
        "names": {
            "project": sorted({n for p in kb.projects for n in (p["title"], p["title"].split(" (")[0])}),
            "company": sorted({j["company"] for j in kb.experience}),
            "event": sorted({n for a in kb.awards for n in award_aliases(a["event"])}),
        },
        # Other names for an event → the short name the model knows ("Liverpool hackathon" → "HackMX").
        "events": [{"name": award_aliases(a["event"])[-1], "aliases": [a["title"], *a.get("aliases", [])]}
                   for a in kb.awards],
    }


def reference(bot: AskAlfonso, questions: list[str]) -> list[dict]:
    """What the Python pipeline answers, step by step, for the TypeScript tests to match."""
    out = []
    for q in questions:
        hits, kept = bot.retrieve(q)
        reply = bot.ask(q)
        asked = R.ABOUT_QUESTION if R.about_him(q) else q
        context = bot._context(bot.fit_context(kept, asked))
        out.append({
            "question": q,
            "prompt_ids": bot.tok.encode(f"{CONTEXT}{context.strip()}{QUESTION}{asked.strip()}{ANSWER}"),
            "hits": [[h.chunk_id, h.score] for h in hits],
            "context_ids": reply.debug.get("context_ids", []),
            "raw": reply.debug.get("raw"),
            "answer": reply.answer,
            "status": reply.status,
            "reason": reply.debug.get("reason", ""),
        })
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--data", type=Path, default=ML / "data")
    parser.add_argument("--reference", type=int, default=80, help="questions in web_reference.json (0 = none)")
    args = parser.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    bot = AskAlfonso.from_files(args.checkpoint, args.data, device="cpu", config=PipelineConfig())
    # Round the weights to float16 in Python too, so the reference answers are what the browser computes.
    with torch.no_grad():
        for p in bot.model.parameters():
            p.copy_(p.half().float())
    ckpt = torch.load(args.checkpoint, map_location="cpu", weights_only=False)

    model_json = export_model(bot, ckpt)
    (OUT / "model.json").write_text(json.dumps(model_json, separators=(",", ":")) + "\n", encoding="utf-8")
    kb = Knowledge.load(args.data / "knowledge.json")
    (OUT / "knowledge.json").write_text(json.dumps(export_knowledge(bot, kb), separators=(",", ":"), ensure_ascii=False)
                                        + "\n", encoding="utf-8")
    size = (OUT / "model.bin").stat().st_size
    print(f"✓ model.bin {size / 1e6:.1f} MB ({model_json['parameters']:,} parameters, float16)")
    print(f"✓ model.json, knowledge.json → {OUT.relative_to(SITE_ROOT)}/")

    if args.reference:
        rows = [json.loads(line) for split in ("test", "stress")
                for line in (args.data / "qa" / f"{split}.jsonl").open(encoding="utf-8")]
        rng = random.Random(7)
        questions = [r["question"] for r in rng.sample(rows, min(args.reference, len(rows)))]
        questions += ["Who is Juan Alfonso Vega Sol?", "What's his phone number?", "Tell me a joke.",
                      "Does he know Rust?", "Tecnológico de Monterrey GPA?", "Hi"]
        ref = reference(bot, questions)
        path = ML / "results" / "web_reference.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(ref, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"✓ {len(ref)} reference answers → {path.relative_to(SITE_ROOT)}")


if __name__ == "__main__":
    main()
