"""Broken English handling, point coverage and cut-off detection."""

import asyncio
import random

from app.llm.brief import build_brief, normalize_note, point_keywords, split_note
from app.llm.gateway import draft_review
from app.llm.groq import GroqProvider
from app.llm.grounding import (
    ends_cleanly,
    grounding_check,
    grounding_issues,
    invents_company,
    missing_points,
    untranslated_words,
)
from app.llm.prompts import user_message
from app.llm.schemas import DraftInput
from app.llm.template import template_draft


def _inp(raw: str, **overrides: object) -> DraftInput:
    data: dict[str, object] = {
        "items": ["Mash potato", "Chicken Tikka", "Naan"],
        "ratings": {"food": 5, "service": 5, "ambience": 5, "value": 5},
        "tags": ["Flavourful"],
        "raw_text": raw,
        "tone": "detailed",
        "menu": ["Mash potato", "Chicken Tikka", "Naan", "Dal tadka"],
    }
    data.update(overrides)
    return DraftInput.model_validate(data)


GOOD = (
    "The chicken tikka had a lovely char, and the mash potato was creamy alongside a soft, fresh naan. "
    "Everything was full of flavour and the staff kept things moving without any fuss. The room felt calm and "
    "easy to settle into, and the prices felt fair for what arrived. Finding a parking spot was easy too, "
    "since there was plenty of space right outside."
)
# The exact failure the owner reported: the draft stopped at the token limit.
CUT_OFF = (
    "The mash potato was creamy, and the Chicken Tikka had a lovely char that made me smile. I paired them with a "
    "fresh Naan that stayed warm and soft. The food was flavourful, and the service was prompt and really friendly. "
    "The ambience felt clean and relaxed, just the right vibe for a quick bite. Value was solid; I felt I got my "
    "money's worth without any fuss. Parking was a"
)


# ── normalisation ──


def test_chat_speak_and_typos_are_repaired() -> None:
    assert normalize_note("parkng spce was v big n easy") == "parking space was very big and easy"
    assert normalize_note("chai gr8, view awsm, staff frndly") == "chai great, view awesome, staff friendly"
    assert normalize_note("servce was delicous") == "service was delicious"


def test_dish_and_place_names_are_not_corrected() -> None:
    assert normalize_note("Chicken Bakka at Koramangala") == "Chicken Bakka at Koramangala"
    assert normalize_note("ಬೆಣ್ಣೆ ಚಿಕನ್ ಚೆನ್ನಾಗಿತ್ತು") == "ಬೆಣ್ಣೆ ಚಿಕನ್ ಚೆನ್ನಾಗಿತ್ತು"


def test_broken_english_points_are_classified() -> None:
    kinds = {c.text: c.kind for c in split_note("dal was gud, naan soft. seating thoda tight. parkng easy")}
    assert kinds["dal was good"] == "praise"
    assert kinds["seating thoda tight"] == "concern"
    assert kinds["parking easy"] == "praise"


def test_unpunctuated_run_on_is_split_into_points() -> None:
    clauses = split_note("dal tasty roti also good ambience nice music loud little bit")
    assert [(c.text, c.kind) for c in clauses] == [
        ("dal tasty", "praise"),
        ("roti also good", "praise"),
        ("ambience nice", "praise"),
        ("music loud little bit", "concern"),
    ]


def test_single_sentiment_clause_is_not_split() -> None:
    assert [c.text for c in split_note("parking had a great space")] == ["parking had a great space"]
    assert [c.text for c in split_note("food was vry tasty n hot")] == ["food was very tasty and hot"]
    assert [c.text for c in split_note("great food great service")] == ["great food", "great service"]


def test_point_keywords_keep_the_topic() -> None:
    assert point_keywords("parking had a great space") == ["parking", "space"]
    assert point_keywords("valet guy polite") == ["valet", "guy"]
    assert point_keywords("very good") == []


# ── the brief tells the model what it must cover ──


def test_every_non_complaint_point_reaches_the_model() -> None:
    message = user_message(
        _inp("tikka smoky n juicy, parking easy, valet guy polite, seating thoda tight"),
        style_hint="x",
        rng=random.Random(1),
    )
    assert '"diner_points"' in message
    for point in ("tikka smoky and juicy", "parking easy", "valet guy polite"):
        assert point in message
    assert "tight" not in message  # complaints still only arrive as mild minor notes


def test_brief_lists_diner_points() -> None:
    brief = build_brief(_inp("parking had a great space"), rng=random.Random(0))
    assert brief.diner_points == ["parking had a great space"]


# ── grounding ──


def test_cut_off_draft_is_rejected() -> None:
    assert not ends_cleanly(CUT_OFF)
    issues = grounding_issues(CUT_OFF, _inp("parking had a great space"))
    assert any("mid-sentence" in issue for issue in issues)


def test_complete_draft_with_every_point_is_accepted() -> None:
    assert ends_cleanly(GOOD)
    assert grounding_check(GOOD, _inp("parking had a great space"))


def test_draft_that_drops_a_point_is_rejected() -> None:
    no_parking = GOOD.split(" Finding a parking spot")[0]
    assert missing_points(no_parking, _inp("parking had a great space")) == ["parking had a great space"]
    issues = grounding_issues(no_parking, _inp("parking had a great space"))
    assert any("left out" in issue and "parking" in issue for issue in issues)


def test_misspelled_point_still_counts_when_the_draft_spells_it_right() -> None:
    assert missing_points(GOOD, _inp("parkng spce was v gud")) == []


def test_complaint_clauses_are_not_required_in_the_draft() -> None:
    assert missing_points(GOOD, _inp("parking easy, seating thoda tight")) == []


def test_coverage_is_skipped_for_non_latin_output_languages() -> None:
    assert missing_points("ಚೆನ್ನಾಗಿತ್ತು.", _inp("parking had a great space", lang="Kannada")) == []


def test_complaint_words_from_the_note_must_not_be_echoed() -> None:
    inp = _inp("chai ekdum mast, seating thoda tight", items=["Masala chai"], tone="short", menu=["Masala chai"])
    echoed = "The masala chai was really great, though the seating was a little snug and quite tight overall."
    assert any("complaint wording" in issue for issue in grounding_issues(echoed, inp))
    mild = "The masala chai was really great, and the seating was a little snug but cosy enough to enjoy it."
    assert grounding_check(mild, inp)


def test_mild_word_that_overlaps_the_complaint_is_allowed() -> None:
    # "food thoda slow" softens to "food was a little slow": "slow" itself is part of the mild version.
    inp = _inp("food thoda slow", items=["Masala chai"], tone="short", menu=["Masala chai"])
    text = "The masala chai was lovely and warming, though the food was a little slow to arrive today."
    assert grounding_check(text, inp)


def test_invented_companions_are_rejected_unless_the_diner_mentioned_them() -> None:
    assert invents_company("We loved the naan.", _inp("naan soft"))
    assert not invents_company("We loved the naan.", _inp("we came for my birthday, naan soft"))
    assert not invents_company("I loved the naan.", _inp("naan soft"))


def test_hinglish_left_in_an_english_review_is_rejected() -> None:
    inp = _inp("chai ekdum mast", items=["Masala chai"], tone="short", menu=["Masala chai"])
    leaky = "The masala chai was ekdum mast, strong and warming, and I would happily order it again soon."
    assert any("untranslated" in issue for issue in grounding_issues(leaky, inp))
    fixed = "The masala chai was really great, strong and warming, and I would happily order it again soon."
    assert grounding_check(fixed, inp)
    hinglish = _inp("chai ekdum mast", items=["Masala chai"], lang="Hinglish", tone="short", menu=["Masala chai"])
    assert untranslated_words(leaky, hinglish) == []


def test_short_reviews_of_fifteen_words_are_accepted() -> None:
    inp = _inp("chai great and view from terrace awesome", items=["Masala chai"], tone="short", menu=["Masala chai"])
    text = "The masala chai was lovely, with the view from the terrace adding to the charm."
    assert grounding_check(text, inp)


# ── gateway end to end with a scripted model ──


class Scripted:
    def __init__(self, outputs: list[str]) -> None:
        self.name = "groq"
        self.outputs = list(outputs)
        self.users: list[str] = []

    async def generate(self, system: str, user: str, *, max_tokens: int, temperature: float) -> str:
        self.users.append(user)
        return self.outputs.pop(0)


def test_gateway_retries_a_cut_off_draft_and_accepts_the_complete_one() -> None:
    provider = Scripted([CUT_OFF, GOOD])
    draft = asyncio.run(draft_review(_inp("parking had a great space"), providers=[provider], temperature=0.8))
    assert draft.provider == "groq"
    assert draft.text == GOOD
    assert "mid-sentence" in provider.users[1]


def test_template_fallback_keeps_the_diners_points() -> None:
    text = template_draft(_inp("parkng had a gr8 space, valet guy polite, seating thoda tight"), rng=random.Random(2))
    lowered = text.casefold()
    assert "parking had a great space" in lowered
    assert "valet guy polite" in lowered
    assert "tight" not in lowered


# ── provider payload ──


def test_qwen3_requests_skip_hidden_reasoning() -> None:
    payload = GroqProvider("key", "qwen/qwen3.8-27b")._payload("s", "u", max_tokens=450, temperature=0.8)
    assert payload["reasoning_effort"] == "none"
    assert payload["max_tokens"] == 450
    other = GroqProvider("key", "openai/gpt-oss-20b")._payload("s", "u", max_tokens=450, temperature=0.8)
    assert "reasoning_effort" not in other


def test_groq_raises_when_the_answer_was_cut_off() -> None:
    import httpx

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, json={"choices": [{"finish_reason": "length", "message": {"role": "assistant", "content": CUT_OFF}}]}
        )

    async def run() -> None:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            provider = GroqProvider("key", "qwen/qwen3.8-27b", client=client)
            try:
                await provider.generate("s", "u", max_tokens=450, temperature=0.8)
            except RuntimeError as exc:
                assert "cut off" in str(exc)
            else:  # pragma: no cover - the test fails if no error is raised
                raise AssertionError("expected a RuntimeError")

    asyncio.run(run())
