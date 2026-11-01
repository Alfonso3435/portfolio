"""The exact text format the model reads and writes.

One training example looks like this (special tokens are single tokens):

    <|context|>IdentifEye: Snap a photo of any product…<|question|>What is IdentifEye built with?<|answer|>IdentifEye uses Vertex AI, …<|end|>

The model learns to continue the text after <|answer|> and to stop by writing <|end|>.
Keeping the format in one place guarantees training and inference never drift apart.
"""

from __future__ import annotations

PAD = "<|pad|>"
CONTEXT = "<|context|>"
QUESTION = "<|question|>"
ANSWER = "<|answer|>"
END = "<|end|>"

# Order matters: these become the last ids of the vocabulary, in this order.
SPECIAL_TOKENS = [PAD, CONTEXT, QUESTION, ANSWER, END]


def build_prompt(context: str, question: str) -> str:
    """What the model sees at inference time; it must generate the answer and <|end|>."""
    return f"{CONTEXT}{context.strip()}{QUESTION}{question.strip()}{ANSWER}"


def build_example(context: str, question: str, answer: str) -> str:
    """A full training example: prompt + target answer + end marker."""
    return f"{build_prompt(context, question)}{answer.strip()}{END}"
