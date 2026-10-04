import hashlib

from app.llm.grounding import word_bounds
from app.llm.prompts import looks_like_instruction
from app.llm.schemas import DraftInput

_RATING_WORDS = {1: "poor", 2: "weak", 3: "okay", 4: "good", 5: "great"}

_LEAD = (
    "Today",
    "Here",
    "Overall",
    "Mainly",
    "Mostly",
    "Finally",
    "First",
    "Later",
    "After",
    "Before",
    "During",
    "Around",
    "Meanwhile",
    "Plus",
    "Also",
    "Next",
)
_VERB = ("had", "ordered", "chose", "picked", "tried", "got", "ate", "wanted")


def _join(parts: list[str]) -> str:
    cleaned = [part.strip() for part in parts if part.strip()]
    if not cleaned:
        return ""
    if len(cleaned) == 1:
        return cleaned[0]
    return ", ".join(cleaned[:-1]) + f" and {cleaned[-1]}"


def _digest(inp: DraftInput) -> bytes:
    return hashlib.sha256(
        repr((inp.items, inp.tone, inp.lang, inp.tags, inp.raw_text, tuple(sorted(inp.ratings.items())))).encode()
    ).digest()


def _opening_sentence(inp: DraftInput, dishes: str) -> str:
    digest = _digest(inp)
    lead = _LEAD[digest[0] % len(_LEAD)]
    verb = _VERB[digest[3] % len(_VERB)]
    if dishes:
        return f"{lead} I {verb} {dishes}."
    if inp.ratings:
        return f"{lead} I {verb} to rate this visit."
    return f"{lead} I {verb} to note this visit."


def _safe_note(raw_text: str) -> str:
    note = raw_text.strip()
    if not note or looks_like_instruction(note):
        return ""
    return note if note.endswith((".", "!", "?")) else f"{note}."


def _pad(text: str, tone: str) -> str:
    low, high = word_bounds(tone)
    filler = " I am only describing what I chose for this visit."
    while len(text.split()) < low:
        nxt = text + filler
        if len(nxt.split()) > high:
            break
        text = nxt
    return text


def template_draft(inp: DraftInput) -> str:
    sentences: list[str] = []
    dishes = _join(inp.items)
    sentences.append(_opening_sentence(inp, dishes))
    if inp.ratings:
        bits = [
            f"{aspect} was {_RATING_WORDS.get(int(score), str(score))}"
            for aspect, score in inp.ratings.items()
        ]
        sentences.append("I rated " + ", ".join(bits) + ".")
    labels = _join(inp.tags)
    if labels:
        sentences.append(f"I would mention {labels}.")
    note = _safe_note(inp.raw_text)
    if note:
        sentences.append(note)
    if not sentences:
        sentences.append("I wanted to note how this visit went.")
    return _pad(" ".join(sentences), inp.tone)
