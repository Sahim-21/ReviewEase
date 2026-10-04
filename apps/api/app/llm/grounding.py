import re
from collections.abc import Sequence

from rapidfuzz import fuzz

from app.llm.prompts import looks_like_instruction
from app.llm.schemas import DraftInput

_PRAISE = frozenset(
    {
        "amazing",
        "excellent",
        "wonderful",
        "delicious",
        "fantastic",
        "perfect",
        "outstanding",
        "loved",
        "incredible",
        "awesome",
        "best",
        "superb",
        "exceptional",
    }
)
_NEGATIVES = frozenset(
    {
        "terrible",
        "awful",
        "disgusting",
        "worst",
        "rude",
        "inedible",
        "horrible",
        "bland",
        "gross",
        "nasty",
    }
)
_FENCE = re.compile(r"```[\w-]*\n?|```")
_BOLD = re.compile(r"\*\*|__")
_ITALIC = re.compile(r"(?<!\*)\*(?!\*)|(?<!_)_(?!_)")
_HEADING = re.compile(r"^#{1,6}\s+", re.MULTILINE)
_BLOCKQUOTE = re.compile(r"^>\s?", re.MULTILINE)
_WORD = re.compile(r"[A-Za-z']+")
OPENING_NGRAM = 4
MENTION_THRESHOLD = 88
SELECTED_THRESHOLD = 86


def word_bounds(tone: str) -> tuple[int, int]:
    if tone == "short":
        return 20, 40
    return 40, 120


def clean_output(text: str) -> str:
    stripped = _FENCE.sub("", text)
    stripped = _HEADING.sub("", stripped)
    stripped = _BLOCKQUOTE.sub("", stripped)
    stripped = _BOLD.sub("", stripped)
    stripped = _ITALIC.sub("", stripped)
    stripped = stripped.replace("#", "")
    stripped = stripped.strip()
    while len(stripped) >= 2 and stripped[0] == stripped[-1] and stripped[0] in {'"', "'"}:
        stripped = stripped[1:-1].strip()
    if stripped.startswith('"') and stripped.endswith('"'):
        stripped = stripped[1:-1].strip()
    return stripped.strip()


def opening_ngram(text: str, n: int = OPENING_NGRAM) -> str:
    words = [match.group(0).casefold() for match in _WORD.finditer(clean_output(text))]
    return " ".join(words[:n])


def repeats_opening(text: str, recent_drafts: Sequence[str], *, n: int = OPENING_NGRAM) -> bool:
    current = opening_ngram(text, n)
    if not current or len(current.split()) < min(n, 2):
        return False
    prior = {opening_ngram(draft, n) for draft in recent_drafts if draft.strip()}
    return current in prior


def _windows(text: str, size: int) -> list[str]:
    words = [match.group(0) for match in _WORD.finditer(text)]
    if not words:
        return []
    width = max(size, 1)
    return [" ".join(words[i : i + width]) for i in range(len(words) - width + 1)] or [" ".join(words)]


def _best_mention_score(name: str, text: str) -> float:
    windows = _windows(text, len(name.split()))
    window_score = max((fuzz.token_set_ratio(name, window) for window in windows), default=0.0)
    return max(float(window_score), float(fuzz.partial_ratio(name, text)))


def mentioned_menu_items(text: str, menu: Sequence[str]) -> list[str]:
    cleaned = clean_output(text)
    found: list[str] = []
    for name in menu:
        if name.strip() and _best_mention_score(name, cleaned) >= MENTION_THRESHOLD:
            found.append(name)
    return found


def _matches_selection(name: str, selected: Sequence[str]) -> bool:
    return any(fuzz.WRatio(name, item) >= SELECTED_THRESHOLD for item in selected if item.strip())


def extra_menu_mentions(text: str, inp: DraftInput) -> list[str]:
    menu = list(inp.menu or inp.items)
    return [name for name in mentioned_menu_items(text, menu) if not _matches_selection(name, inp.items)]


def _words(text: str) -> set[str]:
    return {match.group(0).casefold() for match in _WORD.finditer(text)}


def _average_rating(inp: DraftInput) -> float | None:
    scores = [int(score) for score in inp.ratings.values()]
    if not scores:
        return None
    return sum(scores) / len(scores)


def sentiment_ok(text: str, inp: DraftInput) -> bool:
    average = _average_rating(inp)
    if average is None:
        return True
    output_words = _words(clean_output(text))
    provided = _words(" ".join(inp.tags) + " " + inp.raw_text)
    if average <= 2 and output_words & _PRAISE:
        return False
    if average >= 4 and (output_words & _NEGATIVES) - provided:
        return False
    return True


def word_count_ok(text: str, tone: str) -> bool:
    count = len(clean_output(text).split())
    low, high = word_bounds(tone)
    return low <= count <= high


def grounding_check(
    text: str,
    inp: DraftInput,
    *,
    recent_drafts: Sequence[str] = (),
) -> bool:
    cleaned = clean_output(text)
    if not cleaned:
        return False
    if extra_menu_mentions(cleaned, inp):
        return False
    if not word_count_ok(cleaned, inp.tone):
        return False
    if not sentiment_ok(cleaned, inp):
        return False
    if recent_drafts and repeats_opening(cleaned, recent_drafts):
        return False
    if looks_like_instruction(cleaned):
        return False
    return True
