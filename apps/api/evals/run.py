"""Run prompt evals: python -m evals.run  (from apps/api)."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

from app.llm.gateway import draft_review
from app.llm.grounding import extra_menu_mentions, opening_ngram, repeats_opening, word_count_ok
from app.llm.schemas import DraftInput

CASES_PATH = Path(__file__).with_name("cases.json")

DEFAULT_MENU = [
    "Butter chicken",
    "Palak paneer",
    "Dal tadka",
    "Chicken biryani",
    "Garlic naan",
    "Butter naan",
    "Masala chai",
    "Mango lassi",
    "Gulab jamun",
]


def _words(text: str) -> int:
    return len(text.split())


def _inject_fail(text: str, case: dict[str, object]) -> list[str]:
    lower = text.casefold()
    hits: list[str] = []
    for phrase in case.get("forbid_phrases") or []:
        if str(phrase).casefold() in lower:
            hits.append(str(phrase))
    return hits


def _row(values: list[str], widths: list[int]) -> str:
    parts = []
    for value, width in zip(values, widths, strict=True):
        clipped = value if len(value) <= width else value[: width - 1] + "…"
        parts.append(clipped.ljust(width))
    return "  ".join(parts)


async def _run_case(case: dict[str, object], recent: list[str]) -> dict[str, object]:
    inp = DraftInput(
        items=list(case.get("items") or []),
        ratings=dict(case.get("ratings") or {}),
        tags=list(case.get("tags") or []),
        raw_text=str(case.get("raw_text") or ""),
        tone=str(case.get("tone") or "casual"),  # type: ignore[arg-type]
        lang=str(case.get("lang") or "English"),
        menu=list(case.get("menu") or DEFAULT_MENU),
    )
    draft = await draft_review(inp, recent_drafts=recent)
    extras = extra_menu_mentions(draft.text, inp)
    inject = _inject_fail(draft.text, case)
    repeated = repeats_opening(draft.text, recent)
    length_ok = word_count_ok(draft.text, inp.tone)
    halluc = bool(extras)
    return {
        "id": str(case["id"]),
        "group": str(case["group"]),
        "provider": draft.provider,
        "words": _words(draft.text),
        "length_ok": length_ok,
        "halluc": halluc,
        "extras": extras,
        "repeat": repeated,
        "inject": inject,
        "opening": opening_ngram(draft.text),
        "text": draft.text,
        "ok": (not halluc) and length_ok and (not repeated) and (not inject),
    }


async def _run_all(cases: list[dict[str, object]]) -> list[dict[str, object]]:
    recent: list[str] = []
    rows: list[dict[str, object]] = []
    for case in cases:
        row = await _run_case(case, recent)
        rows.append(row)
        text = str(row["text"])
        if text.strip():
            recent.append(text)
            recent = recent[-20:]
    return rows


def _print_table(rows: list[dict[str, object]]) -> None:
    headers = ["id", "group", "prov", "w", "len", "halluc", "repeat", "inject", "ok", "opening"]
    widths = [5, 12, 8, 4, 4, 6, 6, 6, 4, 28]
    print(_row(headers, widths))
    print(_row(["-" * w for w in widths], widths))
    for row in rows:
        extras = ",".join(str(x) for x in row["extras"]) if row["extras"] else ""
        inject = ",".join(str(x) for x in row["inject"]) if row["inject"] else "-"
        halluc = extras or ("Y" if row["halluc"] else "n")
        print(
            _row(
                [
                    str(row["id"]),
                    str(row["group"]),
                    str(row["provider"]),
                    str(row["words"]),
                    "ok" if row["length_ok"] else "FAIL",
                    halluc if extras else ("n" if not row["halluc"] else "Y"),
                    "Y" if row["repeat"] else "n",
                    inject,
                    "PASS" if row["ok"] else "FAIL",
                    str(row["opening"]),
                ],
                widths,
            )
        )


def _summary(rows: list[dict[str, object]]) -> None:
    n = len(rows) or 1
    halluc = sum(1 for row in rows if row["halluc"])
    length = sum(1 for row in rows if row["length_ok"])
    repeat = sum(1 for row in rows if row["repeat"])
    inject = sum(1 for row in rows if row["inject"])
    passed = sum(1 for row in rows if row["ok"])
    providers: dict[str, int] = {}
    for row in rows:
        name = str(row["provider"])
        providers[name] = providers.get(name, 0) + 1
    print()
    print(f"cases              {len(rows)}")
    print(f"pass               {passed}/{len(rows)} ({100 * passed / n:.0f}%)")
    print(f"hallucination rate {halluc}/{len(rows)} ({100 * halluc / n:.0f}%)")
    print(f"length compliance  {length}/{len(rows)} ({100 * length / n:.0f}%)")
    print(f"repeated openings  {repeat}/{len(rows)} ({100 * repeat / n:.0f}%)")
    print(f"injection leaks    {inject}/{len(rows)} ({100 * inject / n:.0f}%)")
    print("providers          " + ", ".join(f"{k}={v}" for k, v in sorted(providers.items())))


def main() -> int:
    parser = argparse.ArgumentParser(description="Run ReviewEase draft evals")
    parser.add_argument("--cases", type=Path, default=CASES_PATH)
    args = parser.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    from app.config import settings

    print(f"groq_key_set={bool(settings.groq_api_key)} gemini_key_set={bool(settings.gemini_api_key)}")
    cases = json.loads(args.cases.read_text(encoding="utf-8"))
    rows = asyncio.run(_run_all(cases))
    _print_table(rows)
    _summary(rows)
    failed = [row for row in rows if not row["ok"]]
    if failed:
        print("\nFailures:")
        for row in failed:
            extras = row["extras"] or row["inject"]
            snippet = str(row["text"]).encode("ascii", "replace").decode("ascii")
            print(f"  {row['id']}: provider={row['provider']} extras={extras} text={snippet!r}")
    return 0 if not failed else 1


if __name__ == "__main__":
    raise SystemExit(main())
