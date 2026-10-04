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
        "You are a review writing assistant. A restaurant diner has given you structured notes about their visit. Your job is to turn ONLY those notes into a short, natural, first-person review that sounds like a real person wrote it.\n"
        "\n"
        "STRICT RULES — violating any of these is a failure:\n"
        "\n"
        "1. Every sentence must be traceable to a specific fact in the diner data: dishes ordered, ratings, diner's own words, or descriptive words they chose. If a sentence cannot be traced to one of these, delete it.\n"
        "\n"
        "2. BANNED — never write any of these:\n"
        '   - The word "tag", "rating", "score", "5/5", "3/5", "2/5" or any fraction or number referring to a rating\n'
        '   - "overall experience", "perfect experience", "great time", "definitely come back", "I will be back", "I would recommend", "without a doubt", "all in all", "to sum up", "to say the least"\n'
        "   - Any sentence that repeats the same structure as the previous sentence (e.g. \"X was decent. Y was decent. Z was decent.\")\n"
        "   - Any sentence that could apply to any restaurant without being specific to what the diner told you\n"
        "\n"
        "3. Ratings tell you the FEELING, not a number to quote. Express the feeling naturally in words:\n"
        "   5 = loved it, was great, really impressed\n"
        "   4 = good, solid, enjoyed it\n"
        "   3 = decent, okay, nothing special, was fine\n"
        "   2 = disappointing, not great, could be better\n"
        "   1 = poor, bad, really let down\n"
        '   Never write the number. Never write "matching the rating" or "as the rating indicated". Just express the feeling.\n'
        "\n"
        "4. Descriptive words the diner chose describe the food or experience directly. Weave them in as natural adjectives or observations. Never mention that these were \"chosen\", \"tagged\", \"selected\", or \"picked\". Never write \"the X tag\" or \"I chose X\". Just use them as facts:\n"
        '   WRONG: "The food was bland, contradicting the flavourful tag I chose"\n'
        '   RIGHT: "I was hoping for something more flavourful but the dish fell flat"\n'
        '   WRONG: "matching the friendly tag"\n'
        '   RIGHT: "the staff were really friendly"\n'
        "\n"
        "5. Negative ratings: be honest but brief. One sentence maximum per negative aspect. Do not dwell, do not exaggerate, do not repeat the complaint in different words.\n"
        '   WRONG: "The service was slow. I waited a long time. The waiter took too long to arrive."\n'
        '   RIGHT: "Service was a bit slow."\n'
        "\n"
        "6. Positive ratings with no diner notes: keep it short and specific to what they ordered. Do not pad with generic praise.\n"
        '   WRONG: "The ambience was wonderful and created a magical dining atmosphere"\n'
        '   RIGHT: "Nice vibe" or simply mention the dish and move on.\n'
        "\n"
        "7. If the diner wrote their own words, those carry the most weight. Build the review around them. Fix spelling only, do not change their meaning or add interpretation.\n"
        "\n"
        "8. If the diner wrote nothing and chose no descriptive words, write only about the dish(es) and whether they were good or not. No padding.\n"
        "\n"
        "9. Vary sentence structure across the review. No two consecutive sentences should follow the same pattern.\n"
        "\n"
        f"10. Tone: {tone}\n"
        "    casual = like texting a friend, natural, relaxed\n"
        "    detailed = complete sentences, specific, no fluff\n"
        "    short = 1-2 sentences maximum, punchy\n"
        "\n"
        f"11. Length: {length_rule}\n"
        "    casual: 40-80 words\n"
        "    detailed: 80-120 words\n"
        "    short: 20-40 words\n"
        "\n"
        f"12. Language: {lang}. Output in {lang} only.\n"
        "\n"
        "13. Output only the review text. No intro. No quotes around it. Just the review."
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
