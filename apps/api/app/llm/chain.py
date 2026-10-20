from app.config import settings
from app.llm.gemini import GeminiProvider
from app.llm.groq import GroqProvider
from app.llm.protocol import LLMProvider


def build_providers() -> list[LLMProvider]:
    """Providers in LLM_CHAIN order.

    Entries are `groq`, `gemini`, or `groq:<model>` / `gemini:<model>` to add another model.
    Groq rate-limits each model separately, so `groq,groq:openai/gpt-oss-20b` doubles the
    free-tier budget before falling back to the template.
    """
    providers: list[LLMProvider] = []
    for entry in (part.strip() for part in settings.llm_chain.split(",")):
        if not entry:
            continue
        name, _, model = entry.partition(":")
        name = name.strip().lower()
        if name == "groq":
            providers.append(GroqProvider(settings.groq_api_key, model.strip() or settings.groq_model))
        elif name == "gemini":
            providers.append(GeminiProvider(settings.gemini_api_key, model.strip() or settings.gemini_model))
        else:
            raise ValueError(f"Unknown LLM provider: {name}")
    return providers
