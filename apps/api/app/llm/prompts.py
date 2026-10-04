import re

from app.llm.schemas import DraftInput

STYLE_HINTS = (
    "start with the dish",
    "start with the vibe",
    "start with the service",
    "start with what stood out",
)

_INJECTION = re.compile(
    r"ignore (all |previous |the )?instructions|system prompt|you are now|"
    r"forget the json|reveal the (system )?prompt|as an ai|discount code|"
    r"pretend ratings|marketing bot|pwned|ignore rules",
    re.IGNORECASE,
)

_ASPECTS = ("food", "service", "ambience", "value")
_ASPECT_LABELS = {
    "food": "Food",
    "service": "Service",
    "ambience": "Ambience",
    "value": "Value",
}


def looks_like_instruction(text: str) -> bool:
    return bool(_INJECTION.search(text or ""))


def _length_rule(tone: str) -> str:
    if tone == "detailed":
        return "80-120 words"
    if tone == "short":
        return "20-40 words"
    return "40-80 words"


def system_prompt(*, tone: str, lang: str) -> str:
    length_rule = _length_rule(tone)
    return (
        "You are a review writing assistant. A restaurant diner has given you structured notes about their visit. Your job is to turn ONLY those notes into a short, natural, first-person review.\n"
        "\n"
        "STRICT RULES — violating any of these is a failure:\n"
        "\n"
        "1. Every sentence you write must be traceable to a specific fact in INPUT. If a sentence cannot be traced to INPUT items, ratings, tags, or diner words then delete that sentence.\n"
        "\n"
        "2. NEVER write generic filler. These phrases are banned:\n"
        '   "overall experience", "perfect experience", "I really enjoyed", "everything was great", "I would recommend", "great time", "definitely come back", "I will be back", "without a doubt", "to say the least", "all in all", "to sum up", any sentence that could apply to any restaurant without being specific.\n'
        "\n"
        "3. Ratings map to these words only — use nothing stronger:\n"
        "   5 = great, loved it, really good\n"
        "   4 = good, solid, nice\n"
        "   3 = decent, okay, fine\n"
        "   2 = disappointing, not great, slow (if service)\n"
        "   1 = poor, bad\n"
        "\n"
        "4. Tags are adjectives the diner chose. Weave them in naturally. Do not list them.\n"
        "\n"
        "5. If the diner wrote their own words, those carry the most weight. Build the review around them, fix spelling and grammar, do not invent meaning.\n"
        "\n"
        "6. If the diner wrote nothing and chose no tags, write only about the dish and the ratings. No padding to fill space.\n"
        "\n"
        f"7. Tone: {tone}. Length: {length_rule}.\n"
        "   casual = conversational, natural, like texting a friend\n"
        "   detailed = complete sentences, specific, no fluff\n"
        "   short = 1-2 sentences only, punchy\n"
        "\n"
        f"8. Language: {lang}. Output must be in {lang} only.\n"
        "\n"
        '9. Output only the review text. No quotes around it. No intro like "Here is your review:". Just the review.'
    )


def _join(parts: list[str]) -> str:
    cleaned = [part.strip() for part in parts if part.strip()]
    return ", ".join(cleaned) if cleaned else "none"


def user_message(inp: DraftInput, *, style_hint: str) -> str:
    ratings = ", ".join(
        f"{_ASPECT_LABELS[aspect]} {inp.ratings.get(aspect, '-')}/5" for aspect in _ASPECTS
    )
    lines = [
        "Diner visit data (use only these facts):",
        f"- Dishes ordered: {_join(inp.items)}",
        f"- Ratings: {ratings}",
        f"- Tags chosen by diner: {_join(inp.tags)}",
    ]
    note = inp.raw_text.strip()
    if note:
        lines.append(f'- Diner\'s own words: "{note}"')
    lines.append(f"Style hint from the app (not the diner): {style_hint}.")
    return "\n".join(lines)
