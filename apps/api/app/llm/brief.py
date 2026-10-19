"""Turns a diner's raw inputs into a structured brief for the model.

The old pipeline dumped everything on the model as a flat list ("Food 4/5",
"Tags chosen by diner: ...", the raw note) and left it to work out which parts
were praise, which were complaints and how to phrase them. That is why drafts
read like a form being read out loud, why complaints were repeated word for word
and why every review had the same shape.

Here the sorting happens in code:
  * overall feeling is derived once from the ratings;
  * the note is split into clauses, each classified as praise / concern / neutral;
  * concerns are rewritten in a deliberately mild voice (we never repeat harsh
    wording, and we keep at most a couple of them);
  * a random "writing plan" (angle, voice, shape) is attached so two diners with
    similar inputs still get differently shaped reviews.
"""

from __future__ import annotations

import random
import re
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass, field

from app.llm.prompts_safety import looks_like_instruction
from app.llm.schemas import DraftInput

ASPECTS = ("food", "service", "ambience", "value")

# ── Mood ────────────────────────────────────────────────────────────────

_MOODS = {
    5: "delighted",
    4: "happy",
    3: "fine, a mixed or middling visit",
    2: "a little disappointed",
    1: "let down",
}


def overall_score(ratings: dict[str, int]) -> int | None:
    scores = [int(score) for score in ratings.values() if 1 <= int(score) <= 5]
    if not scores:
        return None
    return max(1, min(5, round(sum(scores) / len(scores))))


# ── Note analysis ───────────────────────────────────────────────────────

_NEGATIVE = frozenset(
    """
    bad worse worst terrible awful horrible disgusting gross nasty poor pathetic
    bland tasteless sticky soggy dry hard cold stale burnt burned oily greasy
    salty spicy overcooked undercooked raw rude slow late delay delayed wait waited
    noisy loud dirty smelly expensive overpriced costly small less
    bakwas bekar ganda thanda thandi kam km namak tez lamba late dheere
    """.split()
)
_POSITIVE = frozenset(
    """
    good great nice tasty delicious yummy lovely amazing excellent fresh crisp
    friendly quick fast prompt clean cozy cosy warm soft juicy perfect awesome
    best love loved enjoyed superb fantastic wonderful flavourful flavorful
    accha acha achha mast badhiya badiya zabardast swadisht lajawab
    """.split()
)
_NEGATORS = frozenset({"not", "no", "never", "nahi", "nhi", "na", "without", "isn't", "wasn't", "wasnt", "isnt"})
_SOFTENERS = frozenset({"thoda", "thodi", "slightly", "bit", "little", "somewhat", "bhi"})

# word → mild replacement. Only used to build the "minor_notes" the model sees,
# so the model never has to echo the diner's harsher phrasing.
_SOFT_WORDS: dict[str, str] = {
    "bland": "a little light on flavour",
    "tasteless": "a little light on flavour",
    "sticky": "a touch dense",
    "soggy": "a touch soft",
    "dry": "a little dry",
    "hard": "a little firm",
    "cold": "not as warm as I like",
    "stale": "not quite fresh",
    "burnt": "a little well done",
    "burned": "a little well done",
    "oily": "a little rich",
    "greasy": "a little rich",
    "salty": "on the salty side",
    "spicy": "on the spicy side",
    "tez": "on the spicy side",
    "overcooked": "a little over done",
    "undercooked": "a little underdone",
    "slow": "a little slow",
    "late": "a little slow",
    "lamba": "a little long",
    "dheere": "a little slow",
    "wait": "a bit of a wait",
    "noisy": "a little lively",
    "loud": "a little lively",
    "expensive": "on the pricier side",
    "overpriced": "on the pricier side",
    "costly": "on the pricier side",
    "bakwas": "not quite to my taste",
    "bekar": "not quite to my taste",
    "bad": "not quite to my taste",
    "poor": "not at its best",
    "terrible": "not at its best",
    "awful": "not at its best",
    "horrible": "not at its best",
    "worst": "not at its best",
    "disgusting": "not to my taste",
    "gross": "not to my taste",
    "nasty": "not to my taste",
    "pathetic": "not at its best",
    "rude": "a little less warm than I hoped",
    "dirty": "not as tidy as I hoped",
    "smelly": "not as fresh as I hoped",
    "ganda": "not quite to my taste",
    "thanda": "not as warm as I like",
    "thandi": "not as warm as I like",
    "km": "a bit light",
    "kam": "a bit light",
    "namak": "salt",
}

_CLAUSE_SPLIT = re.compile(r"[.;!?\n]+|\s+(?:but|however|though|although|lekin|magar|par|aur)\s+|,\s*", re.IGNORECASE)
_WORD = re.compile(r"[^\W\d_]+(?:'[^\W\d_]+)?", re.UNICODE)


@dataclass(frozen=True)
class Clause:
    text: str
    kind: str  # "praise" | "concern" | "neutral"


def _classify(clause: str) -> str:
    words = [w.casefold() for w in _WORD.findall(clause)]
    if not words:
        return "neutral"
    positive = negative = 0
    for index, word in enumerate(words):
        negated = any(prev in _NEGATORS for prev in words[max(0, index - 2) : index])
        if word in _POSITIVE:
            if negated:
                negative += 1
            else:
                positive += 1
        elif word in _NEGATIVE:
            # "thoda slow" / "a bit slow" are already gentle: still a concern, but a small one.
            if negated:
                positive += 1
            else:
                negative += 1
    if negative > positive:
        return "concern"
    if positive > negative:
        return "praise"
    return "neutral"


def split_note(raw_text: str) -> list[Clause]:
    if not raw_text or looks_like_instruction(raw_text):
        return []
    clauses: list[Clause] = []
    for part in _CLAUSE_SPLIT.split(raw_text):
        text = (part or "").strip(" \t-–—:\"'")
        if len(text) < 3:
            continue
        clauses.append(Clause(text=text, kind=_classify(text)))
    return clauses


_STOP = frozenset(
    "was were is are am be been too very so quite really just and the a an of thi tha hai ho gya gaya tha. food".split()
)


def soften(clause: str) -> str:
    """Mild paraphrase of a complaint, built from the diner's own subject words."""
    words = _WORD.findall(clause)
    lowered = [w.casefold() for w in words]
    subject_words: list[str] = []
    for word, low in zip(words, lowered, strict=True):
        if low in _STOP - {"food"} or low in _NEGATIVE or low in _POSITIVE or low in _NEGATORS or low in _SOFTENERS:
            break
        subject_words.append(word)
        if len(subject_words) == 4:
            break
    subject = " ".join(subject_words).strip()
    mild = next((_SOFT_WORDS[w] for w in lowered if w in _SOFT_WORDS and w != "namak"), "")
    if subject and mild:
        return f"{subject} was {mild}"
    if mild:
        return mild
    return "one small thing could be a bit better"


def _dedupe(values: Sequence[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for value in values:
        key = value.casefold().strip()
        if key and key not in seen:
            seen.add(key)
            out.append(value.strip())
    return out


# ── Tags ────────────────────────────────────────────────────────────────

_NEGATIVE_TAGS = {
    "slow": "a little slow at times",
    "noisy": "a little lively",
    "expensive": "on the pricier side",
    "crowded": "fairly busy",
    "late": "a little slow at times",
}
_TAG_ADJECTIVES = {
    "cleanliness": "clean",
    "hygiene": "clean",
    "service": "well served",
    "ambience": "pleasant",
    "atmosphere": "pleasant",
    "value": "good value",
    "portions": "generously portioned",
    "taste": "tasty",
    "freshness": "fresh",
}


def tag_phrase(tag: str) -> tuple[str, bool]:
    """(phrase, is_concern) for a tag label."""
    key = tag.strip().casefold()
    if key in _NEGATIVE_TAGS:
        return _NEGATIVE_TAGS[key], True
    return _TAG_ADJECTIVES.get(key, tag.strip().lower()), False


# ── Writing plan (uniqueness) ───────────────────────────────────────────

ANGLES = (
    "open with the dish that stood out most",
    "open with how the food and the place came together",
    "open with the service or the people, if they were liked; otherwise with a dish",
    "open with a short, direct verdict, then back it up with the dishes",
    "open mid-thought, like a text to a friend",
    "open with the second dish, then circle back to the first",
)
VOICES = (
    "warm and plain-spoken",
    "relaxed and a little playful",
    "calm, understated, matter-of-fact",
    "enthusiastic but brief",
    "thoughtful, like someone who eats out often",
)
CLOSERS = (
    "end on the last real detail from the brief",
    "end on one dish, said simply",
    "end on the atmosphere, only if it was liked",
    "no closing line: stop after the last real detail",
)


@dataclass(frozen=True)
class Plan:
    angle: str
    voice: str
    closer: str
    sentences: int
    target_words: str
    feature: tuple[str, ...]


def _sentence_count(tone: str, rng: random.Random) -> int:
    if tone == "short":
        return rng.choice((2, 2, 3))
    if tone == "detailed":
        return rng.choice((5, 6, 6, 7))
    return rng.choice((4, 4, 5))


_TARGET_WORDS = {"short": "22-36", "detailed": "90-115", "casual": "55-75"}


def make_plan(inp: DraftInput, rng: random.Random, style_hint: str | None = None) -> Plan:
    items = list(inp.items)
    rng.shuffle(items)
    feature = tuple(items[:2]) if len(items) > 2 else tuple(items)
    angle = rng.choice(ANGLES)
    if style_hint:
        angle = f"{angle} (app hint: {style_hint})"
    return Plan(
        angle=angle,
        voice=rng.choice(VOICES),
        closer=rng.choice(CLOSERS),
        sentences=_sentence_count(inp.tone, rng),
        target_words=_TARGET_WORDS.get(inp.tone, "55-75"),
        feature=feature,
    )


# ── Repetition guard ────────────────────────────────────────────────────


def overused_phrases(recent_drafts: Sequence[str], *, limit: int = 6) -> list[str]:
    """Most repeated 3-word phrases across this restaurant's recent drafts."""
    counts: Counter[str] = Counter()
    for draft in recent_drafts:
        words = [w.casefold() for w in _WORD.findall(draft)]
        grams = {" ".join(words[i : i + 3]) for i in range(len(words) - 2)}
        counts.update(grams)
    return [gram for gram, n in counts.most_common(40) if n >= 3][:limit]


def recent_openings(recent_drafts: Sequence[str], *, limit: int = 6) -> list[str]:
    openings: list[str] = []
    for draft in recent_drafts[:limit * 2]:
        words = draft.strip().split()
        if words:
            openings.append(" ".join(words[:5]))
    return _dedupe(openings)[:limit]


# ── The brief ───────────────────────────────────────────────────────────


@dataclass
class Brief:
    dishes: list[str]
    overall: int | None
    mood: str
    liked_aspects: list[str] = field(default_factory=list)
    praise_points: list[str] = field(default_factory=list)
    minor_notes: list[str] = field(default_factory=list)
    descriptors: list[str] = field(default_factory=list)
    diner_words: str = ""
    plan: Plan | None = None
    avoid_openings: list[str] = field(default_factory=list)
    avoid_phrases: list[str] = field(default_factory=list)


def build_brief(
    inp: DraftInput,
    *,
    rng: random.Random | None = None,
    style_hint: str | None = None,
    recent_drafts: Sequence[str] = (),
) -> Brief:
    rng = rng or random.Random()
    overall = overall_score(inp.ratings)
    liked_aspects: list[str] = []
    praise_points: list[str] = []
    minor: list[str] = []

    for aspect in ASPECTS:
        score = inp.ratings.get(aspect)
        if score is None:
            continue
        if score >= 4:
            liked_aspects.append(aspect)
        elif score <= 2:
            minor.append(f"{aspect} could have been a little better")

    descriptors: list[str] = []
    for tag in inp.tags:
        phrase, is_concern = tag_phrase(tag)
        (minor if is_concern else descriptors).append(phrase)

    note = "" if looks_like_instruction(inp.raw_text) else inp.raw_text.strip()
    clauses = split_note(note)
    # The model never sees the diner's complaint wording: concerns reach it only as the mild
    # "minor_notes" built below, so it cannot echo or amplify them.
    shareable_words = ". ".join(c.text for c in clauses if c.kind != "concern")
    for clause in clauses:
        if clause.kind == "praise":
            praise_points.append(clause.text)
        elif clause.kind == "concern":
            minor.append(soften(clause.text))

    # Keep concerns rare and short: the review should lead with what went well.
    minor = _dedupe(minor)
    limit = 2 if (overall or 3) <= 2 else 1
    minor = minor[:limit]

    return Brief(
        dishes=list(inp.items),
        overall=overall,
        mood=_MOODS.get(overall or 0, "no overall rating given"),
        liked_aspects=liked_aspects,
        praise_points=_dedupe(praise_points),
        minor_notes=minor,
        descriptors=_dedupe(descriptors),
        diner_words=shareable_words,
        plan=make_plan(inp, rng, style_hint),
        avoid_openings=recent_openings(recent_drafts),
        avoid_phrases=overused_phrases(recent_drafts),
    )
