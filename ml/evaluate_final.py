"""Phase 6 — the final evaluation, on the test split (run once, after the model is frozen).

    python ml/evaluate_final.py --checkpoint ml/checkpoints/colab-v6/best.pt
    python ml/evaluate_final.py --checkpoint … --compare ml/checkpoints/colab-v4/best.pt

The test split was set aside in Phase 1 and never used to train, tune, or choose anything:
its 254 questions use phrasings (and refusal topics) that no model has seen. It's the
number to report. --compare runs another model on it *for reporting only* — the choice of
model was made before, on dev and the stress set.

What it measures (everything through the full pipeline the site will use):
    answer accuracy     exact match, token F1, key facts — answerable questions
    hallucination rate  answered questions whose answer names something (a project, a
                        number, a technology…) that appears NOWHERE in Alfonso's data —
                        the scary failure — and, separately, wrong-but-grounded answers
    refusal correctness questions it should refuse (unknown topics, private, off-topic):
                        did it decline or redirect without stating anything?
    latency             seconds per question on this machine, cold (no answer cache)
    error analysis      what kind of mistake each wrong answer is

Writes ml/results/phase6_<run>.json (and prints a markdown summary) for the Lab page.
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

ML = Path(__file__).resolve().parent
sys.path.insert(0, str(ML))

from askalfonso.guardrails import unsupported_names, ungrounded_tokens  # noqa: E402
from askalfonso.inference import normalize  # noqa: E402
from askalfonso.metrics import score  # noqa: E402
from askalfonso.pipeline import AskAlfonso, PipelineConfig  # noqa: E402
from askalfonso.retrieval import TfidfRetriever  # noqa: E402

REFUSE_TYPES = {"unknown_skill", "unknown_entity", "unknown", "private", "offtopic"}


def load(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.open(encoding="utf-8")]


def reference_index(data: Path) -> dict[str, tuple[str, str]]:
    """Every reference answer in the dataset → (intent, id), to recognize 'a right answer to
    a different question' among the mistakes."""
    index = {}
    for split in ("train", "dev", "test", "stress"):
        path = data / "qa" / f"{split}.jsonl"
        if path.exists():
            for row in load(path):
                index.setdefault(normalize(row["answer"]), (row["intent"], row["id"]))
    return index


def classify_error(row: dict, answer: str, status: str, refs: dict, kb_text: str, names: list[str]) -> str:
    if status in {"refused", "private", "fallback"}:
        return "declined (safe miss)"
    if ungrounded_tokens(answer, kb_text) or unsupported_names(answer, kb_text, names):
        return "fabricated (names something not in the data)"
    other = refs.get(normalize(answer))
    if other:
        return "right fact, wrong question" if other[0] != row["intent"] else "right type, wrong entity"
    return "partly right / reworded"


def evaluate(checkpoint: Path, data: Path, rows: list[dict], device: str) -> dict:
    bot = AskAlfonso.from_files(checkpoint, data, device=device, config=PipelineConfig())
    chunks = load(data / "chunks.jsonl")
    kb_text = " ".join([c["text"] for c in chunks] + list(bot.facts.values()) + [bot.allowlist])
    refs = reference_index(data)

    # Retrieval on its own (no model): did the right chunk make it into the context?
    retriever = TfidfRetriever(chunks)
    ranks = []
    for row in rows:
        if row["gold_chunks"]:
            ids = [h.chunk_id for h in retriever.search(row["question"], k=len(chunks))]
            ranks.append(min(ids.index(g) for g in row["gold_chunks"]) + 1)

    results, latencies = [], []
    for row in rows:
        start = time.perf_counter()
        reply = bot.ask(row["question"])  # every question is new: no cache hits
        latencies.append(time.perf_counter() - start)
        results.append((row, reply))

    answerable = [(r, rep) for r, rep in results if r["gold_chunks"]]
    refuse = [(r, rep) for r, rep in results if r["type"] in REFUSE_TYPES]
    greet = [(r, rep) for r, rep in results if r["type"] == "greeting"]

    soft = [score(rep.answer, r["answer"]) for r, rep in answerable]
    exact = [s["em"] == 1.0 for s in soft]
    errors = Counter()
    error_examples = defaultdict(list)
    by_type = defaultdict(lambda: [0, 0])
    for (r, rep), ok in zip(answerable, exact):
        by_type[r["intent"]][1] += 1
        if ok:
            by_type[r["intent"]][0] += 1
            continue
        kind = classify_error(r, rep.answer, rep.status, refs, kb_text, bot.known_names)
        errors[kind] += 1
        if len(error_examples[kind]) < 6:
            error_examples[kind].append({"question": r["question"], "expected": r["answer"], "got": rep.answer})

    answered_facts = [(r, rep) for r, rep in answerable if rep.status == "answered"]
    fabricated = [1 for r, rep in answered_facts
                  if ungrounded_tokens(rep.answer, kb_text) or unsupported_names(rep.answer, kb_text, bot.known_names)]
    refuse_safe = [rep.status in {"refused", "private", "fallback"} or rep.answer.startswith("Hi! I'm")
                   for _, rep in refuse]
    refuse_exact = [normalize(rep.answer) == normalize(r["answer"]) for r, rep in refuse]
    lat = sorted(latencies)
    n = len(answerable)
    return {
        "checkpoint": str(checkpoint),
        "questions": len(rows),
        "retrieval": {"recall@1": sum(x <= 1 for x in ranks) / len(ranks), "recall@3": sum(x <= 3 for x in ranks) / len(ranks),
                      "mrr": sum(1 / x for x in ranks) / len(ranks)},
        "answerable": {
            "n": n,
            "exact_match": sum(exact) / n,
            "token_f1": sum(s["f1"] for s in soft) / n,
            "key_facts": sum(s["facts"] for s in soft) / n,
            "declined": sum(rep.status != "answered" for _, rep in answerable) / n,
            "wrong_but_grounded": sum(1 for (r, rep), ok in zip(answerable, exact)
                                      if not ok and rep.status == "answered") / n - len(fabricated) / n,
        },
        "hallucination": {
            "answered": len(answered_facts),
            "fabricated": len(fabricated),
            "rate_of_answered": len(fabricated) / max(len(answered_facts), 1),
        },
        "refusals": {"n": len(refuse), "handled_safely": sum(refuse_safe) / max(len(refuse), 1),
                     "exact_refusal_text": sum(refuse_exact) / max(len(refuse), 1),
                     "stated_a_fact": len(refuse) - sum(refuse_safe)},
        "greetings": {"n": len(greet), "ok": sum(rep.answer.startswith("Hi! I'm") for _, rep in greet)},
        "latency_s": {"mean": statistics.mean(lat), "p50": lat[len(lat) // 2], "p95": lat[int(len(lat) * 0.95)],
                      "max": lat[-1]},
        "by_intent_exact": {k: f"{v[0]}/{v[1]}" for k, v in sorted(by_type.items())},
        "errors": dict(errors.most_common()),
        "error_examples": dict(error_examples),
        "per_question": [{"type": r["type"], "intent": r["intent"], "question": r["question"], "expected": r["answer"],
                          "answer": rep.answer, "status": rep.status, **rep.debug} for r, rep in results],
    }


def summary(name: str, rep: dict) -> str:
    a, h, f, lat = rep["answerable"], rep["hallucination"], rep["refusals"], rep["latency_s"]
    return "\n".join([
        f"### {name} — test split ({rep['questions']} questions)",
        "",
        "| Metric | Value |",
        "|---|---|",
        f"| Retrieval recall@1 / recall@3 | {rep['retrieval']['recall@1']:.1%} / {rep['retrieval']['recall@3']:.1%} |",
        f"| Answerable: exact match | {a['exact_match']:.1%} |",
        f"| Answerable: token F1 / key facts | {a['token_f1']:.1%} / {a['key_facts']:.1%} |",
        f"| Answerable: declined (safe miss) | {a['declined']:.1%} |",
        f"| Answerable: wrong but grounded | {a['wrong_but_grounded']:.1%} |",
        f"| Hallucination: answers naming something not in the data | {h['fabricated']}/{h['answered']} "
        f"({h['rate_of_answered']:.1%}) |",
        f"| Should-refuse questions handled safely | {f['handled_safely']:.1%} ({f['stated_a_fact']} stated a fact) |",
        f"| Greeting | {rep['greetings']['ok']}/{rep['greetings']['n']} |",
        f"| Latency per question (this CPU): mean / p50 / p95 | {lat['mean']:.2f}s / {lat['p50']:.2f}s / {lat['p95']:.2f}s |",
        "",
        "Errors on answerable questions: " + ", ".join(f"{k}: {v}" for k, v in rep["errors"].items()),
    ])


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--compare", type=Path, nargs="*", default=[], help="other checkpoints, for reporting only")
    parser.add_argument("--data", type=Path, default=ML / "data")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--out", type=Path, default=ML / "results")
    args = parser.parse_args()

    rows = load(args.data / "qa" / "test.jsonl")
    args.out.mkdir(parents=True, exist_ok=True)
    for ckpt in [args.checkpoint, *args.compare]:
        name = ckpt.parent.name
        print(f"Evaluating {name} on {len(rows)} test questions…", flush=True)
        rep = evaluate(ckpt, args.data, rows, args.device)
        (args.out / f"phase6_{name}.json").write_text(json.dumps(rep, indent=2, ensure_ascii=False) + "\n",
                                                      encoding="utf-8")
        print("\n" + summary(name, rep) + "\n", flush=True)


if __name__ == "__main__":
    main()
