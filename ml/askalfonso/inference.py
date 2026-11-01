"""Loading a trained model and asking it questions. Shared by training (dev scoring),
evaluation (Phase 6) and deployment (Phase 7)."""

from __future__ import annotations

import random
import re
from pathlib import Path

import torch

from .model import GPT, GPTConfig
from .prompt import END, build_prompt
from .tokenizer import BPETokenizer


def pick_device(preferred: str = "auto") -> torch.device:
    if preferred != "auto":
        return torch.device(preferred)
    if torch.cuda.is_available():
        return torch.device("cuda")
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def set_seed(seed: int) -> None:
    random.seed(seed)
    torch.manual_seed(seed)


def normalize(text: str) -> str:
    """For exact-match scoring: case, spacing and a trailing period don't count as errors."""
    return re.sub(r"\s+", " ", text).strip().rstrip(".").lower()


@torch.no_grad()
def answer(model: GPT, tok: BPETokenizer, context: str, question: str, max_new_tokens: int = 120) -> str:
    """Greedy decoding (temperature 0): for a factual assistant, the most likely answer, every time."""
    device = next(model.parameters()).device
    prompt_ids = tok.encode(build_prompt(context, question))
    # Leave room for the answer inside the context window.
    prompt_ids = prompt_ids[-(model.cfg.block_size - max_new_tokens):]
    x = torch.tensor([prompt_ids], device=device)
    out = model.generate(x, max_new_tokens=max_new_tokens, temperature=0, stop_token=tok.token_id(END))
    return tok.decode(out[0, len(prompt_ids):].tolist()).split(END)[0].strip()


def save_checkpoint(path: Path, model: GPT, tok: BPETokenizer, meta: dict) -> None:
    """One self-contained file: weights + config + tokenizer + training metadata."""
    path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(
        {
            "model": {k: v.detach().cpu() for k, v in model.state_dict().items()},
            "config": model.cfg.to_dict(),
            "tokenizer": tok.to_dict(),
            "meta": meta,
        },
        path,
    )


def load_checkpoint(path: Path, device: str = "auto") -> tuple[GPT, BPETokenizer, dict]:
    data = torch.load(path, map_location="cpu", weights_only=False)
    model = GPT(GPTConfig(**data["config"]))
    model.load_state_dict(data["model"])
    model.to(pick_device(device)).eval()
    tok = BPETokenizer.from_dict(data["tokenizer"])
    return model, tok, data["meta"]
