"""Turns Q&A rows into tensors the model can train on.

Language models learn "next-token prediction": at every position, predict the
token that comes next. So for a token sequence [t0, t1, …, tn]:

    input  = [t0, t1, …, t(n-1)]
    target = [t1, t2, …, tn]          (the same sequence, shifted left by one)

Answer-only loss: during fine-tuning we only grade the model on the *answer*.
Target positions inside the context and the question are set to IGNORE_INDEX,
so the model isn't rewarded for memorizing the paragraph — only for answering.
"""

from __future__ import annotations

from dataclasses import dataclass

import torch

from .model import IGNORE_INDEX
from .prompt import ANSWER, PAD, build_example
from .tokenizer import BPETokenizer


@dataclass
class Encoded:
    input_ids: list[int]
    targets: list[int]


def encode_example(tok: BPETokenizer, context: str, question: str, answer: str, max_len: int) -> Encoded | None:
    """Tokenize one example and build its shifted, answer-only targets.

    Returns None if it doesn't fit in `max_len` tokens (the caller decides what to do).
    """
    ids = tok.encode(build_example(context, question, answer))
    if len(ids) - 1 > max_len:
        return None
    answer_pos = ids.index(tok.token_id(ANSWER))
    inputs, targets = ids[:-1], ids[1:]
    # targets[i] is ids[i + 1]; only positions whose target lies after <|answer|> count.
    targets = [t if i >= answer_pos else IGNORE_INDEX for i, t in enumerate(targets)]
    return Encoded(inputs, targets)


def collate(batch: list[Encoded], pad_id: int) -> tuple[torch.Tensor, torch.Tensor]:
    """Pad a list of examples to the same length so they can be stacked into one tensor."""
    width = max(len(e.input_ids) for e in batch)
    x = torch.full((len(batch), width), pad_id, dtype=torch.long)
    y = torch.full((len(batch), width), IGNORE_INDEX, dtype=torch.long)  # padding is never graded
    for row, e in enumerate(batch):
        x[row, : len(e.input_ids)] = torch.tensor(e.input_ids)
        y[row, : len(e.targets)] = torch.tensor(e.targets)
    return x, y


def pad_id(tok: BPETokenizer) -> int:
    return tok.token_id(PAD)
