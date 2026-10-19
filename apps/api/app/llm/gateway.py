import asyncio
import logging
import random
from collections.abc import Sequence

from app.llm.brief import build_brief
from app.llm.chain import build_providers
from app.llm.grounding import clean_output, grounding_issues
from app.llm.prompts import STYLE_HINTS, system_prompt, user_message
from app.llm.protocol import LLMProvider, RateLimited
from app.llm.schemas import Draft, DraftInput
from app.llm.template import template_draft

TIMEOUT_SECONDS = 8.0
MAX_TOKENS = 300
_ATTEMPTS = 3
_BACKOFF_SECONDS = 1.0

logger = logging.getLogger("app.llm")


def _lower(temperature: float) -> float:
    return max(0.2, temperature - 0.3)


def _log(event: str, **fields: object) -> None:
    logger.warning(event, extra={"extra_fields": fields})


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
    rng = random.Random()
    hint = style_hint or rng.choice(STYLE_HINTS)
    brief = build_brief(inp, rng=rng, style_hint=hint, recent_drafts=recent_drafts)
    system = system_prompt(tone=inp.tone, lang=inp.lang)
    base_user = user_message(inp, style_hint=hint, brief=brief)
    current = temperature if temperature is not None else rng.uniform(0.75, 0.95)
    for provider in chain:
        temp = current
        user = base_user
        for attempt in range(_ATTEMPTS):
            try:
                raw = await asyncio.wait_for(
                    provider.generate(system, user, max_tokens=MAX_TOKENS, temperature=temp),
                    timeout=timeout,
                )
            except RateLimited as exc:
                # The limit resets in seconds, so retrying right away only burns the budget: move on.
                _log("llm_rate_limited", provider=provider.name, retry_after=exc.retry_after)
                break
            except Exception as exc:  # noqa: BLE001 - any provider failure falls through to the next attempt
                _log("llm_provider_error", provider=provider.name, attempt=attempt + 1, error=f"{type(exc).__name__}: {exc}"[:200])
                temp = _lower(temp)
                if attempt + 1 < _ATTEMPTS:
                    await asyncio.sleep(_BACKOFF_SECONDS * (attempt + 1))
                continue
            issues = grounding_issues(raw, inp, recent_drafts=recent_drafts)
            if not issues:
                return Draft(text=clean_output(raw), provider=provider.name, grounding_ok=True)
            _log("llm_draft_rejected", provider=provider.name, attempt=attempt + 1, issues=issues)
            temp = _lower(temp)
            user = f"{base_user}\n\nYour previous draft was rejected because: {'; '.join(issues)}. Write a new one that fixes this."
    _log("llm_fallback_to_template", providers=[p.name for p in chain])
    return Draft(text=template_draft(inp, rng=rng), provider="template", grounding_ok=True)
