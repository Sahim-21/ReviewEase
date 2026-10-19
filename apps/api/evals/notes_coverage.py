"""Live eval: does the review keep every point the diner typed, including broken English?

Calls the real LLM chain configured in .env (GROQ_API_KEY / LLM_CHAIN), so it costs tokens and
is rate limited; cases are spaced out. Run from apps/api:

    python -m evals.notes_coverage                 # all cases
    python -m evals.notes_coverage parking kids    # only these ids

Each case lists `expect`: groups of words, at least one of each group must appear in the review.
`forbid`: complaint words that must not be echoed. A case also fails if the review ends
mid-sentence, leaves Hinglish untranslated, or falls back to the template.
"""

from __future__ import annotations

import asyncio
import re
import sys

from app.llm.gateway import draft_review
from app.llm.schemas import DraftInput

MENU = [
    "Chicken Bakka",
    "Mash potato",
    "Chicken Tikka",
    "Naan",
    "Dal tadka",
    "Paneer butter masala",
    "Masala chai",
    "Veg biryani",
    "Gulab jamun",
]
S5 = {"food": 5, "service": 5, "ambience": 5, "value": 5}
S4 = {"food": 4, "service": 4, "ambience": 4, "value": 4}
PARKING = ["parking", "park"]

CASES: list[dict[str, object]] = [
    dict(id="parking", items=["Mash potato", "Chicken Tikka", "Naan"], ratings=S5, tags=["Flavourful", "Friendly"],
         raw="parking had a great space", tone="detailed", expect=[PARKING], forbid=[]),
    dict(id="parking-broken", items=["Chicken Tikka"], ratings=S5, tags=[],
         raw="parkng space was v big n easy", tone="casual", expect=[PARKING], forbid=[]),
    dict(id="chatspeak", items=["Dal tadka", "Naan"], ratings=S4, tags=[],
         raw="dal was gud, naan soft. staff v frndly. music nice", tone="casual",
         expect=[["dal"], ["naan"], ["staff", "friendly"], ["music", "song", "playlist", "tunes"]], forbid=[]),
    dict(id="washroom", items=["Veg biryani"], ratings=S4, tags=["Clean"],
         raw="washroom clean and ac working good", tone="casual",
         expect=[["washroom", "restroom", "bathroom", "toilet"], ["ac", "air conditioning", "air-conditioning", "cool"]],
         forbid=[]),
    dict(id="kids", items=["Paneer butter masala", "Naan"], ratings=S5, tags=[],
         raw="kids play area was there so my son was happy. paneer was too good", tone="detailed",
         expect=[["kids", "play area", "children", "son"], ["paneer"]], forbid=[]),
    dict(id="mixed-hinglish", items=["Masala chai", "Gulab jamun"], ratings=S4, tags=[],
         raw="chai ekdum mast, gulab jamun bhi accha tha, seating thoda tight", tone="casual",
         expect=[["chai"], ["gulab jamun", "jamun"], ["seat", "seating", "space", "cosy", "cozy", "snug"]],
         forbid=["tight", "cramped"]),
    dict(id="complaint-plus-extra", items=["Mash potato"], ratings={"food": 3, "service": 4, "ambience": 4, "value": 4},
         tags=[], raw="mash potato bit cold but parking easy and staff helpful", tone="casual",
         expect=[PARKING, ["staff", "helpful"]], forbid=["cold"]),
    dict(id="long-detailed", items=["Chicken Tikka", "Veg biryani", "Naan"], ratings=S5, tags=["Flavourful", "Prompt", "Clean"],
         raw="tikka smoky n juicy, biryani rice long n fluffy, naan fresh from tandoor, parking easy, valet guy polite",
         tone="detailed", expect=[[*PARKING, "valet"], ["smoky", "smoke", "char"], ["fluffy", "long", "grain"]], forbid=[]),
    dict(id="short-extra", items=["Masala chai"], ratings=S5, tags=[],
         raw="chai gr8 n view from terrace awsm", tone="short", expect=[["chai"], ["view", "terrace"]], forbid=[]),
    dict(id="heavy-broken", items=["Chicken Tikka", "Naan"], ratings=S5, tags=[],
         raw="food was vry tasty n hot, waiter ws helpfull, parkng no problem, place neat n clean", tone="casual",
         expect=[PARKING, ["waiter", "staff", "server"], ["hot", "warm", "sizzling", "steaming"], ["neat", "clean", "tidy"]],
         forbid=[]),
    dict(id="no-punctuation", items=["Dal tadka"], ratings=S4, tags=[],
         raw="dal tasty roti also good ambience nice music loud little bit", tone="casual",
         expect=[["dal"], ["roti", "bread"], ["music"]], forbid=["loud"]),
    dict(id="owner-report", items=["Mash potato", "Chicken Bakka", "Naan"], ratings=S5,
         tags=["Flavourful", "Prompt", "Friendly", "Clean"], raw="parking had great space", tone="detailed",
         expect=[PARKING], forbid=[]),
]

_HINGLISH = ("mast", "ekdum", "accha", "thoda", "bhi", "tha")


def _has(text: str, word: str) -> bool:
    return re.search(rf"(?<![a-z]){re.escape(word.lower())}(?:s|es)?(?![a-z])", text.lower()) is not None


async def main(ids: list[str]) -> int:
    cases = [c for c in CASES if not ids or c["id"] in ids]
    passed = 0
    for index, case in enumerate(cases):
        if index:
            await asyncio.sleep(9)  # stay under the free-tier tokens-per-minute limit
        inp = DraftInput(
            items=list(case["items"]),  # type: ignore[arg-type]
            ratings=dict(case["ratings"]),  # type: ignore[arg-type]
            tags=list(case["tags"]),  # type: ignore[arg-type]
            raw_text=str(case["raw"]),
            tone=str(case["tone"]),  # type: ignore[arg-type]
            lang="English",
            menu=MENU,
        )
        draft = await draft_review(inp)
        text = draft.text
        missing = [g for g in case["expect"] if not any(_has(text, w) for w in g)]  # type: ignore[attr-defined]
        forbidden = [w for w in case["forbid"] if _has(text, w)]  # type: ignore[attr-defined]
        leftover = [w for w in _HINGLISH if _has(text, w)]
        complete = text.rstrip().endswith((".", "!", "?"))
        ok = not missing and not forbidden and not leftover and complete and draft.provider != "template"
        passed += ok
        print(f"[{'PASS' if ok else 'FAIL'}] {case['id']} ({draft.provider}, {len(text.split())} words)")
        for label, value in (("missing", missing), ("forbidden", forbidden), ("untranslated", leftover)):
            if value:
                print(f"    {label}: {value}")
        if not complete:
            print("    ends mid-sentence")
        print(f"    {text}")
    print(f"\n{passed}/{len(cases)} passed")
    return 0 if passed == len(cases) else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main(sys.argv[1:])))
