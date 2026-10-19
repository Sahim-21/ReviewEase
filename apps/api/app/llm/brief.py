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

from rapidfuzz import fuzz, process

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
    tight cramped crowded congested problem problems issue issues messy unclean unhygienic
    stuffy hot humid broken limited
    bakwas bekar ganda thanda thandi kam km namak tez lamba late dheere
    """.split()
)
_POSITIVE = frozenset(
    """
    good great nice tasty delicious yummy lovely amazing excellent fresh crisp
    friendly quick fast prompt clean cozy cosy warm soft juicy perfect awesome
    best love loved enjoyed superb fantastic wonderful flavourful flavorful
    spacious big ample easy convenient comfortable roomy helpful polite courteous
    smoky juicy fluffy crispy tender creamy rich hot generous affordable reasonable worth
    happy pleasant beautiful calm peaceful neat hygienic working spotless cool
    accha acha achha mast badhiya badiya zabardast swadisht lajawab
    """.split()
)
NEGATIVE_WORDS = _NEGATIVE
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
    "tight": "a little snug",
    "cramped": "a little snug",
    "crowded": "fairly busy",
    "congested": "fairly busy",
    "small": "on the smaller side",
    "problem": "not perfect",
    "problems": "not perfect",
    "issue": "not perfect",
    "issues": "not perfect",
    "messy": "not as tidy as I hoped",
    "unclean": "not as tidy as I hoped",
    "unhygienic": "not as tidy as I hoped",
    "stuffy": "a little warm",
    "humid": "a little warm",
    "broken": "not working at the time",
    "limited": "a little limited",
    "km": "a bit light",
    "kam": "a bit light",
    "namak": "salt",
}

# Chat-speak and common shorthand diners type on a phone.
_SLANG: dict[str, str] = {
    "gr8": "great", "gud": "good", "gudd": "good", "gd": "good", "v": "very", "vry": "very", "vy": "very",
    "n": "and", "nd": "and", "lil": "little", "nyc": "nice", "nic": "nice", "awsm": "awesome", "osm": "awesome",
    "awsome": "awesome", "frndly": "friendly", "frndy": "friendly", "bt": "but", "coz": "because", "cuz": "because",
    "bcoz": "because", "tht": "that", "wid": "with", "w": "with", "ur": "your", "rly": "really", "thnx": "thanks",
    "thx": "thanks", "delish": "delicious", "yum": "yummy", "srvc": "service", "servc": "service",
    "servce": "service", "svc": "service", "hv": "have", "wz": "was", "ws": "was", "dis": "this", "dat": "that",
    "pls": "please", "plz": "please", "b4": "before", "luv": "love", "luvd": "loved", "gr8t": "great",
    "superb": "superb", "xlnt": "excellent", "exlnt": "excellent", "amzing": "amazing", "amazng": "amazing",
    "qty": "quantity", "amb": "ambience", "ambiance": "ambience", "spce": "space", "parkng": "parking",
    "prking": "parking", "washrm": "washroom", "rstrm": "restroom", "ac": "AC",
}
# Words worth repairing when misspelled. Fuzzy matching is limited to these so dish and place
# names are never "corrected".
_VOCAB = sorted(
    {w for w in _POSITIVE | _NEGATIVE if w.isascii() and len(w) >= 5}
    | set(
        """
        parking service staff waiter waiters waitress manager ambience atmosphere music washroom restroom
        toilet seating seats table tables terrace view garden rooftop price prices pricing portion portions
        quantity quality taste flavour flavor spicy space location crowd family friends birthday valet
        cleanliness hygiene menu dessert drinks starter starters lighting decor interior outdoor
        """.split()
    )
)
_TOKEN = re.compile(r"[A-Za-z0-9']+|[^A-Za-z0-9']+")


def _repair(token: str) -> str:
    low = token.casefold()
    if low in _SLANG:
        out = _SLANG[low]
    elif len(low) >= 5 and low.isalpha() and low not in _POSITIVE and low not in _NEGATIVE and low not in _VOCAB:
        match = process.extractOne(low, _VOCAB, scorer=fuzz.ratio, score_cutoff=86)
        out = match[0] if match else token
    else:
        return token
    return out.capitalize() if token[:1].isupper() and out.islower() else out


def normalize_note(raw_text: str) -> str:
    """Fix chat-speak and obvious misspellings ("parkng spce v gud" -> "parking space very good")."""
    return "".join(_repair(tok) if tok[:1].isalnum() else tok for tok in _TOKEN.findall(raw_text or ""))


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


_GLUE = frozenset({"and", "&", "too", "also", "very", "so", "bit", "little", "a", "quite", "really", "but"})


def _is_sentiment(word: str) -> bool:
    return word in _POSITIVE or word in _NEGATIVE


def _split_run_on(text: str) -> list[str]:
    """Split an unpunctuated run-on at sentiment boundaries.

    "dal tasty roti also good ambience nice music loud little bit" ->
    ["dal tasty", "roti also good", "ambience nice", "music loud little bit"]. A clause with a single
    sentiment word ("parking had a great space") is left alone.
    """
    words = text.split()
    lowered = [w.casefold().strip(",") for w in words]
    if sum(_is_sentiment(w) for w in lowered) < 2:
        return [text]
    parts: list[str] = []
    start = 0
    if _is_sentiment(lowered[0]):
        # Adjective-first ("great food great service"): cut before each new sentiment word.
        for i in range(1, len(lowered)):
            if _is_sentiment(lowered[i]) and lowered[i - 1] not in _GLUE | _NEGATORS | _SOFTENERS:
                if any(not _is_sentiment(w) for w in lowered[start:i]):
                    parts.append(" ".join(words[start:i]))
                    start = i
        parts.append(" ".join(words[start:]))
        return parts
    # Noun-first ("dal tasty roti also good"): cut after each sentiment word.
    for i, word in enumerate(lowered[:-1]):
        nxt = lowered[i + 1]
        if _is_sentiment(word) and not (_is_sentiment(nxt) or nxt in _NEGATORS or nxt in _SOFTENERS or nxt in _GLUE):
            parts.append(" ".join(words[start : i + 1]))
            start = i + 1
    parts.append(" ".join(words[start:]))
    return parts


def split_note(raw_text: str) -> list[Clause]:
    if not raw_text or looks_like_instruction(raw_text):
        return []
    clauses: list[Clause] = []
    for part in _CLAUSE_SPLIT.split(normalize_note(raw_text)):
        for piece in _split_run_on((part or "").strip()):
            text = piece.strip(" \t-–—:\"'")
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


# Words that carry no topic of their own (fillers, sentiment, generic nouns), in English and Hinglish.
_FILLER = frozenset(
    """
    the and was were are is am been being had has have with very really too quite just also its it's this that
    there their they them then than for from out our your you my me was not but bit little lot lots some more
    much many one all any had did does got get gets made make place food overall visit time day again
    tha thi the hai hain bhi aur ekdum bahut bohot bilkul jaisa jaise wala wali kafi thoda thodi tha. yaar
    great good nice very best better well
    """.split()
) | _POSITIVE | _NEGATIVE | _NEGATORS | _SOFTENERS


def point_keywords(point: str) -> list[str]:
    """Topic words of a diner point ("parking had a great space" -> ["parking", "space"])."""
    words = [w.casefold() for w in _WORD.findall(point)]
    return [w for w in words if len(w) >= 3 and w.isascii() and w not in _FILLER]


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
    diner_points: list[str] = field(default_factory=list)
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
    shareable = [c.text for c in clauses if c.kind != "concern"]
    shareable_words = ". ".join(shareable)
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
        diner_points=_dedupe(shareable),
        diner_words=shareable_words,
        plan=make_plan(inp, rng, style_hint),
        avoid_openings=recent_openings(recent_drafts),
        avoid_phrases=overused_phrases(recent_drafts),
    )
