"""Phase 8: the numbers on the Lab page, generated from the files that produced them.

    python ml/export_lab.py
    → src/data/lab-metrics.ts

Every number the Lab page shows about the model comes from here, so the page can't
drift from the experiments. Sources:
    public/ask-alfonso/model.json        architecture and parameter counts (the shipped model)
    public/ask-alfonso/model.bin         download size
    ml/artifacts/tokenizer.json          tokens per character on the corpus
    ml/data/stats.json, qa/stress.jsonl  dataset sizes
    ml/results/train_colab-v6.jsonl      training log of the final run (loss curves)
    ml/results/phase6_colab-v6.json      the one-time test-split evaluation (Phase 6)
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ML = Path(__file__).resolve().parent
ROOT = ML.parent
sys.path.insert(0, str(ML))

from askalfonso.tokenizer import BPETokenizer  # noqa: E402

RUN = "colab-v6"
OUT = ROOT / "src" / "data" / "lab-metrics.ts"


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def parameter_groups(model: dict) -> dict[str, int]:
    """Parameters per part of the network, from the shipped tensor shapes."""
    groups = {"embeddings": 0, "attention": 0, "mlp": 0, "layerNorm": 0}
    for t in model["tensors"]:
        n = 1
        for d in t["shape"]:
            n *= d
        name = t["name"]
        if "emb" in name:
            groups["embeddings"] += n
        elif ".attn." in name:
            groups["attention"] += n
        elif ".mlp." in name:
            groups["mlp"] += n
        else:
            groups["layerNorm"] += n
    assert sum(groups.values()) == model["parameters"], "tensor shapes don't add up to the parameter count"
    return groups


def main() -> None:
    model = json.loads((ROOT / "public" / "ask-alfonso" / "model.json").read_text())
    cfg = model["config"]
    mlp_hidden = next(t["shape"][0] for t in model["tensors"] if t["name"].endswith("mlp.fc.weight"))
    model_mb = (ROOT / "public" / "ask-alfonso" / "model.bin").stat().st_size / 1e6

    tok = BPETokenizer.load(ML / "artifacts" / "tokenizer.json")
    corpus = (ML / "data" / "corpus.txt").read_text()
    chars_per_token = len(corpus) / len(tok.encode(corpus))

    stats = json.loads((ML / "data" / "stats.json").read_text())
    stress = len(read_jsonl(ML / "data" / "qa" / "stress.jsonl"))

    log = read_jsonl(ML / "results" / f"train_{RUN}.jsonl")
    pre = [r for r in log if r["stage"] == "pretrain"]
    fine = [r for r in log if r["stage"] == "finetune"]

    final = json.loads((ML / "results" / f"phase6_{RUN}.json").read_text())
    ans, hal, ref, lat, ret = (final[k] for k in ("answerable", "hallucination", "refusals", "latency_s", "retrieval"))

    metrics = {
        "run": RUN,
        "model": {
            "parameters": model["parameters"],
            "layers": cfg["n_layer"],
            "heads": cfg["n_head"],
            "embedding": cfg["n_embd"],
            "headSize": cfg["n_embd"] // cfg["n_head"],
            "mlpHidden": mlp_hidden,
            "context": cfg["block_size"],
            "vocab": cfg["vocab_size"],
            "groups": parameter_groups(model),
            "downloadMB": round(model_mb, 1),
            "charsPerToken": round(chars_per_token, 2),
        },
        "data": {
            "train": stats["per_split"]["train"],
            "dev": stats["per_split"]["dev"],
            "test": stats["per_split"]["test"],
            "stress": stress,
            "chunks": stats["chunks"],
        },
        "training": {
            "pretrainSteps": pre[-1]["step"] + 1,
            "pretrainLoss": [round(pre[0]["train_loss"], 2), round(pre[-1]["train_loss"], 2)],
            "epochs": fine[-1]["epoch"],
            "steps": fine[-1]["step"],
            "bestDevLoss": round(min(r["dev_loss"] for r in fine), 3),
            # One point per epoch: [epoch, train loss, dev loss] (cross-entropy on answer tokens).
            "curve": [[r["epoch"], round(r["train_loss"], 3), round(r["dev_loss"], 3)] for r in fine],
        },
        "test": {
            "questions": final["questions"],
            "answerable": ans["n"],
            "exactMatch": round(ans["exact_match"], 3),
            "tokenF1": round(ans["token_f1"], 3),
            "keyFacts": round(ans["key_facts"], 3),
            "declined": round(ans["declined"], 3),
            "wrongButGrounded": round(ans["wrong_but_grounded"], 3),
            "answered": hal["answered"],
            "fabricated": hal["fabricated"],
            "shouldRefuse": ref["n"],
            "refusedSafely": round(ref["handled_safely"] * ref["n"]),
            "recallAt1": round(ret["recall@1"], 3),
            "recallAt3": round(ret["recall@3"], 3),
            "latencyP50": round(lat["p50"], 2),
            "latencyP95": round(lat["p95"], 2),
        },
    }

    body = json.dumps(metrics, indent=2)
    # Keep arrays of numbers on one line (the loss curve would otherwise take 400 lines).
    body = re.sub(r"\[\s*([-\d.,\s]+?)\s*\]", lambda m: "[" + ", ".join(m.group(1).split()).replace(",,", ",") + "]", body)
    OUT.write_text(
        "// Generated by ml/export_lab.py from the experiment files. Do not edit by hand:\n"
        "// change the experiments and run `python ml/export_lab.py` instead.\n\n"
        f"export const labMetrics = {body} as const;\n"
    )
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
