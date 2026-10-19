"""No-LLM fallback draft.

Used only when every provider fails. It is built from the same structured brief the
model gets, so it never prints ratings as "food was good, service was good...", never
pastes the diner's raw note and keeps complaints mild, but it is still plain English
assembled from a handful of phrasings, so it is deliberately short.
"""

from __future__ import annotations

import random

from app.llm.brief import Brief, build_brief
from app.llm.schemas import DraftInput

_ASPECT_NAMES = {"food": "the food", "service": "the service", "ambience": "the ambience", "value": "the value"}

_OPEN_POSITIVE = (
    "{D} {be} a real highlight for me.",
    "Really enjoyed {D}.",
    "Went for {D} and it did not disappoint.",
    "{D} {be} easily a highlight.",
    "{D} hit the spot.",
)
_OPEN_FINE = (
    "Tried {D}, and {be_it} decent.",
    "{D} {be} fine, nothing fancy.",
    "Had {D} on this visit and {be_it} okay.",
)
_OPEN_LOW = (
    "Tried {D} this time.",
    "Had {D} on this visit.",
    "{D} {be} on the table for us.",
)
_OPEN_NO_DISH = (
    "Stopped by for a meal here.",
    "Dropped in for a bite recently.",
    "Had a meal here recently.",
)
_ALSO = (
    "{A} stood out too.",
    "{A} also worked well.",
    "I liked {A} as well.",
)
_CONCERN = (
    "That said, {c}, but nothing major.",
    "The only small thing: {c}.",
    "{C}, though that is a minor thing.",
)


def _join(parts: list[str]) -> str:
    parts = [part for part in parts if part]
    if not parts:
        return ""
    if len(parts) == 1:
        return parts[0]
    return ", ".join(parts[:-1]) + f" and {parts[-1]}"


def _cap(text: str) -> str:
    text = text.strip()
    return text[:1].upper() + text[1:] if text else text


def _sentence(text: str) -> str:
    text = text.strip()
    return text if text.endswith((".", "!", "?")) else f"{text}."


def _opening(brief: Brief, rng: random.Random) -> str:
    dishes = list(brief.plan.feature) if brief.plan and brief.plan.feature else brief.dishes
    if not dishes:
        return rng.choice(_OPEN_NO_DISH)
    names = _join(dishes)
    plural = len(dishes) > 1
    pool = _OPEN_POSITIVE if (brief.overall or 3) >= 4 else _OPEN_FINE if (brief.overall or 3) == 3 else _OPEN_LOW
    be = "were" if plural else "was"
    be_it = "they were" if plural else "it was"
    return _cap(rng.choice(pool).format(D=names, be=be, be_it=be_it))


def _max_sentences(tone: str) -> int:
    return {"short": 2, "detailed": 6}.get(tone, 4)


def template_draft(inp: DraftInput, *, rng: random.Random | None = None) -> str:
    rng = rng or random.Random()
    brief = build_brief(inp, rng=rng)
    sentences: list[str] = [_opening(brief, rng)]

    aspects = [a for a in brief.liked_aspects if not (a == "food" and brief.dishes)]
    if aspects and (brief.overall or 3) >= 3:
        names = _join([_ASPECT_NAMES[a] for a in aspects])
        sentences.append(_cap(rng.choice(_ALSO).format(A=names)))

    if brief.descriptors:
        sentences.append(f"It felt {_join(brief.descriptors)}.")

    for point in [pt for pt in brief.praise_points if len(pt.split()) >= 3][:1]:
        sentences.append(_cap(_sentence(point)))

    if brief.minor_notes:
        concern = brief.minor_notes[0]
        sentences.append(_sentence(rng.choice(_CONCERN).format(c=concern, C=_cap(concern)).rstrip(".")))

    limit = _max_sentences(inp.tone)
    return " ".join(sentences[:limit])
