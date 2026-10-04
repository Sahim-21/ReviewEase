import asyncio

from app.config import settings
from app.llm.chain import build_providers
from app.llm.gateway import draft_review
from app.llm.template import template_draft
from app.llm.schemas import DraftInput


class Scripted:
    def __init__(self, name: str, outputs: list[object]) -> None:
        self.name = name
        self.outputs = list(outputs)
        self.temperatures: list[float] = []

    async def generate(
        self,
        system: str,
        user: str,
        *,
        max_tokens: int,
        temperature: float,
    ) -> str:
        self.temperatures.append(temperature)
        item = self.outputs.pop(0)
        if isinstance(item, Exception):
            raise item
        if not isinstance(item, str):
            raise TypeError(type(item))
        return item


def _repeat(sentence: str, words: int) -> str:
    unit = sentence.split()
    out: list[str] = []
    while len(out) < words:
        out.extend(unit)
    return " ".join(out[:words])


def _sample() -> DraftInput:
    return DraftInput(
        items=["butter chicken"],
        ratings={"food": 5, "service": 4},
        tags=["flavourful"],
        tone="casual",
        menu=["butter chicken", "garlic naan"],
    )


def _ok() -> str:
    return _repeat("I had butter chicken and it matched my rating.", 48)


def test_uses_first_provider_when_grounded() -> None:
    groq = Scripted("groq", [_ok()])
    gemini = Scripted("gemini", ["unused"])
    draft = asyncio.run(
        draft_review(_sample(), providers=[groq, gemini], temperature=0.8, style_hint="start with the dish")
    )
    assert draft.provider == "groq"
    assert draft.grounding_ok is True
    assert "butter chicken" in draft.text
    assert gemini.temperatures == []


def test_retries_once_with_lower_temperature_then_accepts() -> None:
    groq = Scripted("groq", ["too short", _ok()])
    draft = asyncio.run(draft_review(_sample(), providers=[groq], temperature=0.8, style_hint="start with the vibe"))
    assert draft.provider == "groq"
    assert groq.temperatures == [0.8, 0.5]


def test_falls_through_to_next_provider() -> None:
    groq = Scripted("groq", [TimeoutError("slow"), TimeoutError("slow")])
    gemini = Scripted("gemini", [_ok()])
    draft = asyncio.run(
        draft_review(_sample(), providers=[groq, gemini], temperature=0.8, style_hint="start with the dish")
    )
    assert draft.provider == "gemini"
    assert groq.temperatures == [0.8, 0.5]
    assert gemini.temperatures == [0.8]


def test_timeout_then_template() -> None:
    class Slow:
        name = "groq"

        async def generate(self, system: str, user: str, *, max_tokens: int, temperature: float) -> str:
            await asyncio.sleep(1)
            return _ok()

    draft = asyncio.run(
        draft_review(_sample(), providers=[Slow()], timeout=0.01, temperature=0.8, style_hint="start with the dish")
    )
    assert draft.provider == "template"
    assert draft.text == template_draft(_sample())


def test_template_when_chain_never_grounds() -> None:
    groq = Scripted("groq", ["nope", "still nope"])
    draft = asyncio.run(draft_review(_sample(), providers=[groq], temperature=0.8, style_hint="start with the dish"))
    assert draft.provider == "template"
    assert "garlic naan" not in draft.text


def test_hallucinated_dish_retries_then_next_provider() -> None:
    hallucinated = "I had garlic naan as well. " + _ok()
    groq = Scripted("groq", [hallucinated, hallucinated])
    gemini = Scripted("gemini", [_ok()])
    draft = asyncio.run(
        draft_review(_sample(), providers=[groq, gemini], temperature=0.8, style_hint="start with the dish")
    )
    assert groq.temperatures == [0.8, 0.5]
    assert draft.provider == "gemini"


def test_low_rating_praise_falls_to_template() -> None:
    praise = _repeat("I had butter chicken and it was amazing.", 48)
    groq = Scripted("groq", [praise, praise])
    gemini = Scripted("gemini", [praise, praise])
    inp = DraftInput(
        items=["butter chicken"],
        ratings={"food": 1, "service": 1},
        tags=[],
        tone="casual",
        menu=["butter chicken", "garlic naan"],
    )
    draft = asyncio.run(
        draft_review(inp, providers=[groq, gemini], temperature=0.8, style_hint="start with the dish")
    )
    assert draft.provider == "template"
    assert "amazing" not in draft.text


def test_repeated_opening_is_treated_as_grounding_failure() -> None:
    groq = Scripted("groq", [_ok(), _ok()])
    gemini = Scripted("gemini", [_repeat("The visit felt flavourful and the butter chicken matched.", 48)])
    recent = ["I had butter chicken last week and said it was fine."]
    draft = asyncio.run(
        draft_review(
            _sample(),
            providers=[groq, gemini],
            temperature=0.8,
            style_hint="start with the vibe",
            recent_drafts=recent,
        )
    )
    assert groq.temperatures == [0.8, 0.5]
    assert draft.provider == "gemini"


def test_chain_order_comes_from_env(monkeypatch) -> None:
    monkeypatch.setattr(settings, "llm_chain", "gemini,groq")
    names = [provider.name for provider in build_providers()]
    assert names == ["gemini", "groq"]
