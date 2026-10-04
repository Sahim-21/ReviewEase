import asyncio

from app.llm.gateway import draft_review
from app.llm.grounding import extra_menu_mentions, grounding_check, word_count_ok
from app.llm.prompts import system_prompt, user_message
from app.llm.schemas import DraftInput
from app.llm.template import template_draft


def _repeat(sentence: str, words: int) -> str:
    unit = sentence.split()
    out: list[str] = []
    while len(out) < words:
        out.extend(unit)
    return " ".join(out[:words])


HINGLISH_NOTE = "bttr chkn thoda tez tha wait lamba, gravy mast"
KANNADA_NOTE = "ಬೆಣ್ಣೆ ಚಿಕನ್ ಚೆನ್ನಾಗಿತ್ತು ಆದರೆ ಸರ್ವಿಸ್ ನಿಧಾನ"


def _hinglish(**overrides: object) -> DraftInput:
    data: dict[str, object] = {
        "items": ["butter chicken"],
        "ratings": {"food": 4, "service": 2},
        "tags": ["flavourful"],
        "raw_text": HINGLISH_NOTE,
        "tone": "casual",
        "lang": "Hinglish",
        "menu": ["butter chicken", "garlic naan", "mango lassi"],
    }
    data.update(overrides)
    return DraftInput.model_validate(data)


def _kannada(**overrides: object) -> DraftInput:
    data: dict[str, object] = {
        "items": ["butter chicken"],
        "ratings": {"food": 5, "service": 2},
        "tags": ["friendly"],
        "raw_text": KANNADA_NOTE,
        "tone": "detailed",
        "lang": "Kannada",
        "menu": ["butter chicken", "garlic naan"],
    }
    data.update(overrides)
    return DraftInput.model_validate(data)


class Capture:
    name = "capture"

    def __init__(self, output: str) -> None:
        self.output = output
        self.system = ""
        self.user = ""

    async def generate(self, system: str, user: str, *, max_tokens: int, temperature: float) -> str:
        self.system = system
        self.user = user
        return self.output


def test_prompt_asks_model_to_read_mixed_broken_words() -> None:
    prompt = system_prompt(tone="casual", lang="Hinglish")
    assert "Hinglish" in prompt
    assert "Tone: casual" in prompt
    assert "Language: Hinglish." in prompt
    assert "Length: 40-80 words" in prompt
    assert "If the diner wrote their own words" in prompt


def test_hinglish_eval_preserves_notes_and_output_lang() -> None:
    inp = _hinglish()
    message = user_message(inp, style_hint="start with the dish")
    assert HINGLISH_NOTE in message
    assert "garlic naan" not in message
    prompt = system_prompt(tone=inp.tone, lang=inp.lang)
    assert "Tone: casual" in prompt
    assert "Language: Hinglish." in prompt
    template = template_draft(inp)
    assert HINGLISH_NOTE in template
    assert "mango lassi" not in template
    review = _repeat(
        "Butter chicken was flavourful, a bit too spicy, and the wait felt long though the gravy was good.",
        48,
    )
    assert extra_menu_mentions(review, inp) == []
    assert word_count_ok(review, inp.tone)
    assert grounding_check(review, inp)


def test_kannada_eval_preserves_script_and_output_lang() -> None:
    inp = _kannada()
    message = user_message(inp, style_hint="start with the service")
    assert KANNADA_NOTE in message
    prompt = system_prompt(tone=inp.tone, lang=inp.lang)
    assert "Tone: detailed" in prompt
    assert "Language: Kannada." in prompt
    template = template_draft(inp)
    assert KANNADA_NOTE in template
    review = _repeat(
        "I had butter chicken and it was good but service was slow as I said.",
        48,
    )
    assert extra_menu_mentions(review, inp) == []
    assert grounding_check(review, inp)


def test_hinglish_low_rating_eval_rejects_invented_praise() -> None:
    inp = _hinglish(ratings={"food": 2, "service": 1}, raw_text="service bakwas wait lamba")
    praised = _repeat("I had butter chicken and it was amazing, perfect visit.", 48)
    honest = _repeat("I had butter chicken but service was poor and the wait was long.", 48)
    assert not grounding_check(praised, inp)
    assert grounding_check(honest, inp)


def test_gateway_passes_hinglish_and_kannada_to_model() -> None:
    hinglish_out = _repeat("I had butter chicken, a bit spicy, and the wait was long.", 48)
    kannada_out = _repeat("I had butter chicken and it was good but service was slow.", 48)
    h_cap = Capture(hinglish_out)
    k_cap = Capture(kannada_out)
    h_draft = asyncio.run(draft_review(_hinglish(), providers=[h_cap], temperature=0.8, style_hint="start with the dish"))
    k_draft = asyncio.run(draft_review(_kannada(), providers=[k_cap], temperature=0.8, style_hint="start with the vibe"))
    assert "Hinglish" in h_cap.system
    assert HINGLISH_NOTE in h_cap.user
    assert h_draft.provider == "capture"
    assert "Kannada" in k_cap.system
    assert KANNADA_NOTE in k_cap.user
    assert k_draft.provider == "capture"
