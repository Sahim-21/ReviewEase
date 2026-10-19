import json
import random

from app.llm.brief import Brief, build_brief
from app.llm.prompts_safety import looks_like_instruction
from app.llm.schemas import DraftInput

__all__ = ["STYLE_HINTS", "looks_like_instruction", "system_prompt", "user_message"]

STYLE_HINTS = (
    "start with the dish",
    "start with the vibe",
    "start with the service",
    "start with what stood out",
)


def _length_rule(tone: str) -> str:
    if tone == "detailed":
        return "80-120 words"
    if tone == "short":
        return "20-40 words"
    return "40-80 words"


# Kept compact on purpose: Groq's free tier allows ~8k tokens/minute, so every token in
# this prompt is paid on every draft.
def system_prompt(*, tone: str, lang: str) -> str:
    length_rule = _length_rule(tone)
    return (
        "You ghost-write a short Google review for a restaurant diner from a structured BRIEF (JSON). "
        "Write it in the diner's own first-person voice.\n"
        "\n"
        "BRIEF FIELDS\n"
        "- dishes: what they ate; use these names exactly, add none.\n"
        "- overall_feeling: match it. delighted/happy = warm; fine = balanced, no gushing; "
        "disappointed/let down = polite and restrained, never angry.\n"
        "- liked: what they enjoyed. This is the backbone.\n"
        "- minor_notes: the ONLY source of concerns, already mild. Mention at most one (two if disappointed/"
        "let down) in one short clause after the positives, like 'though X could be a touch better'. "
        "If empty, mention no negatives.\n"
        "- descriptors: plain observations about the place or food; never say they were picked or tagged.\n"
        "- diners_own_words: may be broken English, Hinglish, Hindi or Kannada. Use only to understand details. "
        "Never paste or quote it; rewrite in fluent sentences.\n"
        "- writing_plan: follow angle, voice, closer, sentences and target_words; mention feature dishes first.\n"
        "- avoid_openings / avoid_phrases: recent reviews; do not start or phrase like them.\n"
        "\n"
        "RULES\n"
        "1. Only facts from the brief. Invent no dishes, prices, staff, reasons for visiting, companions (write 'I', never 'we'), "
        "occasions or advice to others.\n"
        "2. Never exaggerate or repeat a complaint. Never use: terrible, awful, horrible, disgusting, worst, "
        "bland, rude, nasty, gross.\n"
        "3. Never mention ratings, scores, '/5', tags, or any app or AI.\n"
        "4. No clichés ('overall experience', 'great time', 'definitely come back', 'I would recommend', "
        "'hidden gem', 'all in all').\n"
        "5. Sound human: contractions, varied sentence length, no 'X was good. Y was good.' pattern.\n"
        "6. No hashtags or markdown; at most one emoji, only if the tone is casual.\n"
        "\n"
        f"Tone: {tone} (casual = relaxed like telling a friend; detailed = fuller, specific; short = punchy)\n"
        f"Length: {length_rule}\n"
        f"Language: {lang}. Write in {lang} only.\n"
        "\n"
        "Shape example (never reuse its wording): dishes=[Paneer tikka, Mint lemonade], feeling=happy, "
        "liked=[food, ambience] -> \"Came in for the paneer tikka and it had a proper char on it. The mint "
        "lemonade was properly cold, and the courtyard made it easy to linger.\"\n"
        "\n"
        "Output only the review text."
    )


def _brief_payload(brief: Brief) -> dict[str, object]:
    plan = brief.plan
    liked = [*brief.liked_aspects, *brief.praise_points]
    payload: dict[str, object] = {
        "dishes": brief.dishes,
        "overall_feeling": brief.mood,
        "liked": liked,
        "minor_notes": brief.minor_notes,
        "descriptors": brief.descriptors,
    }
    if brief.diner_words:
        payload["diners_own_words"] = brief.diner_words
    if plan is not None:
        payload["writing_plan"] = {
            "angle": plan.angle,
            "voice": plan.voice,
            "closer": plan.closer,
            "sentences": plan.sentences,
            "target_words": plan.target_words,
            "feature": list(plan.feature),
        }
    if brief.avoid_openings:
        payload["avoid_openings"] = brief.avoid_openings
    if brief.avoid_phrases:
        payload["avoid_phrases"] = brief.avoid_phrases
    return payload


def user_message(
    inp: DraftInput,
    *,
    style_hint: str,
    brief: Brief | None = None,
    rng: random.Random | None = None,
) -> str:
    brief = brief or build_brief(inp, rng=rng, style_hint=style_hint)
    body = json.dumps(_brief_payload(brief), ensure_ascii=False, separators=(",", ":"))
    return f"Diner visit data (structured brief; use only these facts): {body}"
