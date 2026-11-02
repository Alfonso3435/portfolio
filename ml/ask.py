"""Chat with Ask Alfonso in the terminal and see every decision the pipeline makes.

    python ml/ask.py --checkpoint ml/checkpoints/colab-v2/best.pt
    python ml/ask.py --checkpoint … "Does he know PyTorch?" "What is Answr?"
    python ml/ask.py --checkpoint … --debug      # also show retrieval scores and raw output
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

ML = Path(__file__).resolve().parent
sys.path.insert(0, str(ML))

from askalfonso.pipeline import AskAlfonso, PipelineConfig  # noqa: E402


def show(bot: AskAlfonso, question: str, debug: bool) -> None:
    start = time.perf_counter()
    reply = bot.ask(question)
    ms = (time.perf_counter() - start) * 1000
    print(f"\nQ: {question}\nA: {reply.answer}")
    if reply.sources:
        print("   sources: " + ", ".join(h.title for h in reply.sources))
    print(f"   [{reply.status}, {ms:.0f} ms]")
    if debug:
        d = reply.debug
        if "hits" in d:
            print("   retrieval: " + ", ".join(f"{cid} {score:.3f}" for cid, score in d["hits"]))
            print(f"   context:   {d['context_ids'] or '(empty: below τ)'}")
            print(f"   raw model: {d['raw']}")
        if d.get("reason"):
            print(f"   guard:     {d['reason']} {d.get('ungrounded') or ''}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("questions", nargs="*")
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--data", type=Path, default=ML / "data")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--threshold", type=float, default=PipelineConfig.threshold)
    parser.add_argument("--no-guards", action="store_true", help="retrieval + model only, to compare")
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()

    config = PipelineConfig(threshold=args.threshold, guards=not args.no_guards)
    bot = AskAlfonso.from_files(args.checkpoint, args.data, device=args.device, config=config)
    if args.questions:
        for q in args.questions:
            show(bot, q, args.debug)
        return
    print("Ask Alfonso — type a question (empty line to quit).")
    while True:
        try:
            q = input("\n> ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if not q:
            break
        show(bot, q, args.debug)


if __name__ == "__main__":
    main()
