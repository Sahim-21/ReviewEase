import re
from collections.abc import Sequence

from rapidfuzz import fuzz

from app.llm.brief import NEGATIVE_WORDS, point_keywords, soften, split_note
from app.llm.prompts_safety import looks_like_instruction
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
# Wording we never let into a draft, even when the diner used it: complaints stay mild.
_HARSH = frozenset(
    {
        "terrible",
        "awful",
        "disgusting",
        "worst",
        "rude",
        "inedible",
        "horrible",
        "gross",
        "nasty",
        "pathetic",
        "bland",
        "tasteless",
        "sticky",
        "garbage",
        "trash",
        "disaster",
    }
)
_META_LEAK = re.compile(
    r"\b(?:tags?|ratings?|scores?)\b|\b\d\s*/\s*5\b|\bas an ai\b|\bi (?:chose|selected|picked)\b",
    re.IGNORECASE,
)
_THINK = re.compile(r"<think>.*?</think>|<think>.*\Z", re.DOTALL | re.IGNORECASE)
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
    # Accepted range. The prompt still asks for 20-40 / 40-80 / 80-120; a punchy 15-word "short"
    # review is fine and should not fall back to the template.
    if tone == "short":
        return 15, 45
    return 40, 120


def clean_output(text: str) -> str:
    stripped = _THINK.sub("", text)
    stripped = _FENCE.sub("", stripped)
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


def tone_ok(text: str) -> bool:
    """Reject harsh wording and any leak of how the data was collected (ratings, tags)."""
    cleaned = clean_output(text)
    if _words(cleaned) & _HARSH:
        return False
    return not _META_LEAK.search(cleaned)


_SCRIPT_LANGS = {"Hindi", "Kannada"}
_SENTENCE_END = (".", "!", "?", "।", ")", '"', "”")
_COMPANY = re.compile(r"\b(?:we|us|our|my (?:wife|husband|family|friends?|kids|son|daughter|partner))\b", re.IGNORECASE)
_COMPANY_HINTS = re.compile(
    r"\b(?:we|us|our|family|friends?|kids?|son|daughter|wife|husband|partner|parents|colleagues|hum|humne|humko)\b",
    re.IGNORECASE,
)


def ends_cleanly(text: str) -> bool:
    """False when the draft stops mid-sentence (e.g. it hit the token limit: "Parking was a")."""
    cleaned = clean_output(text).rstrip()
    if not cleaned:
        return False
    last = cleaned[-1]
    return last in _SENTENCE_END or not (last.isalnum() or last in ",;:-–—")


def _mentions(keyword: str, text: str, words: set[str]) -> bool:
    if re.search(rf"(?<![a-z]){re.escape(keyword)}", text):
        return True
    if len(keyword) < 5:
        return False
    return any(fuzz.ratio(keyword, word) >= 85 for word in words)


def missing_points(text: str, inp: DraftInput) -> list[str]:
    """Diner points (non-complaint clauses of the note) the draft left out entirely."""
    if inp.lang in _SCRIPT_LANGS:
        return []  # topic words would be translated into another script; nothing reliable to match
    lowered = clean_output(text).casefold()
    words = _words(lowered)
    missing: list[str] = []
    for clause in split_note(inp.raw_text):
        if clause.kind == "concern":
            continue
        keywords = point_keywords(clause.text)
        if keywords and not any(_mentions(k, lowered, words) for k in keywords):
            missing.append(clause.text)
    return missing


# Plain words a mild review may still use ("a short wait", "a little slow"); only descriptive
# complaint words (tight, cold, bland...) count as echoing.
_NEUTRAL_COMPLAINT_WORDS = frozenset(
    {"wait", "waited", "delay", "delayed", "late", "slow", "less", "small", "limited", "kam", "km", "namak"}
)


def echoed_complaints(text: str, inp: DraftInput) -> list[str]:
    """Complaint words from the diner's note that the draft repeats instead of using the mild version.

    The model only ever sees "seating was a little snug"; if the draft still says "tight", it is
    amplifying the complaint, which the owner asked us not to do.
    """
    found: set[str] = set()
    output = _words(clean_output(text))
    for clause in split_note(inp.raw_text):
        if clause.kind != "concern":
            continue
        allowed = _words(soften(clause.text)) | _NEUTRAL_COMPLAINT_WORDS
        harsh = {w for w in _words(clause.text) if w in NEGATIVE_WORDS} - allowed
        found |= harsh & output
    return sorted(found)


def invents_company(text: str, inp: DraftInput) -> bool:
    """The draft talks about 'we' or family when the diner never mentioned anyone else."""
    return bool(_COMPANY.search(clean_output(text))) and not _COMPANY_HINTS.search(inp.raw_text or "")


# Hinglish / Hindi words that should be translated when the review is written in English.
_HINGLISH = frozenset(
    """
    mast ekdum accha acha achha badhiya badiya bahut bohot thoda thodi bilkul zabardast lajawab swadisht
    bakwas bekar yaar hai hain tha thi bhi kaafi kafi jaisa jaise wala wali nahi nhi
    """.split()
)


def untranslated_words(text: str, inp: DraftInput) -> list[str]:
    """Hinglish words left in a review that should be in plain English (dish names excepted)."""
    if inp.lang != "English":
        return []
    allowed = _words(" ".join([*inp.items, *inp.menu]))
    return sorted((_words(clean_output(text)) & _HINGLISH) - allowed)


def word_count_ok(text: str, tone: str) -> bool:
    count = len(clean_output(text).split())
    low, high = word_bounds(tone)
    return low <= count <= high


def grounding_issues(
    text: str,
    inp: DraftInput,
    *,
    recent_drafts: Sequence[str] = (),
) -> list[str]:
    """Why a draft is not acceptable (empty list = acceptable)."""
    cleaned = clean_output(text)
    if not cleaned:
        return ["the draft was empty"]
    issues: list[str] = []
    extras = extra_menu_mentions(cleaned, inp)
    if extras:
        issues.append(f"it mentioned dishes the diner did not order: {', '.join(extras)}")
    if not word_count_ok(cleaned, inp.tone):
        low, high = word_bounds(inp.tone)
        issues.append(f"it must be {low}-{high} words")
    if not sentiment_ok(cleaned, inp):
        issues.append("its sentiment did not match how the diner felt")
    if not tone_ok(cleaned):
        issues.append("it used harsh wording or mentioned ratings/tags; keep complaints mild and never mention ratings")
    if not ends_cleanly(cleaned):
        issues.append("it stopped mid-sentence; finish every sentence")
    missing = missing_points(cleaned, inp)
    if missing:
        issues.append("it left out what the diner said about: " + "; ".join(missing))
    echoed = echoed_complaints(cleaned, inp)
    if echoed:
        issues.append("it repeated the diner's complaint wording (" + ", ".join(echoed) + "); use only the mild minor_notes")
    leftovers = untranslated_words(cleaned, inp)
    if leftovers:
        issues.append("it left Hinglish words untranslated in an English review: " + ", ".join(leftovers))
    if invents_company(cleaned, inp):
        issues.append("it mentioned 'we' or companions the diner never mentioned; write as 'I'")
    if recent_drafts and repeats_opening(cleaned, recent_drafts):
        issues.append("its opening repeated a recent review; start differently")
    if looks_like_instruction(cleaned):
        issues.append("it looked like an instruction")
    return issues


def grounding_check(
    text: str,
    inp: DraftInput,
    *,
    recent_drafts: Sequence[str] = (),
) -> bool:
    return not grounding_issues(text, inp, recent_drafts=recent_drafts)
