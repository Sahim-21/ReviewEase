import argparse
import asyncio
import sys
from pathlib import Path

from app.llm.gateway import draft_review
from app.llm.schemas import DraftInput


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.llm.try_it")
    parser.add_argument("path", nargs="?", help="JSON file with items, ratings, tags, raw_text, tone, lang")
    args = parser.parse_args(argv)
    if args.path:
        raw = Path(args.path).read_text(encoding="utf-8")
    elif not sys.stdin.isatty():
        raw = sys.stdin.read()
    else:
        parser.error("pass a JSON file or pipe JSON on stdin")
    draft = asyncio.run(draft_review(DraftInput.model_validate_json(raw)))
    print(draft.text)
    print(f"provider: {draft.provider}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
