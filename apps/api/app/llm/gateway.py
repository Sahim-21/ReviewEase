import asyncio
import random
from collections.abc import Sequence

from app.llm.chain import build_providers
from app.llm.grounding import clean_output, grounding_check
from app.llm.prompts import STYLE_HINTS, system_prompt, user_message
from app.llm.protocol import LLMProvider
from app.llm.schemas import Draft, DraftInput
from app.llm.template import template_draft

TIMEOUT_SECONDS = 6.0
MAX_TOKENS = 300
_ATTEMPTS = 2


def _lower(temperature: float) -> float:
    return max(0.2, temperature - 0.3)


async def draft_review(
    inp: DraftInput,
    *,
    providers: Sequence[LLMProvider] | None = None,
    timeout: float = TIMEOUT_SECONDS,
    temperature: float | None = None,
    style_hint: str | None = None,
    recent_drafts: Sequence[str] = (),
) -> Draft:
    chain = list(providers) if providers is not None else build_providers()
    hint = style_hint or random.choice(STYLE_HINTS)
    system = system_prompt(tone=inp.tone, lang=inp.lang)
    user = user_message(inp, style_hint=hint)
    current = temperature if temperature is not None else random.uniform(0.7, 0.9)
    for provider in chain:
        temp = current
        for _ in range(_ATTEMPTS):
            try:
                raw = await asyncio.wait_for(
                    provider.generate(system, user, max_tokens=MAX_TOKENS, temperature=temp),
                    timeout=timeout,
                )
            except Exception:
                temp = _lower(temp)
                continue
            if grounding_check(raw, inp, recent_drafts=recent_drafts):
                return Draft(text=clean_output(raw), provider=provider.name, grounding_ok=True)
            temp = _lower(temp)
    return Draft(text=template_draft(inp), provider="template", grounding_ok=True)
