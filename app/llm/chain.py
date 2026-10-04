from app.config import settings
from app.llm.gemini import GeminiProvider
from app.llm.groq import GroqProvider
from app.llm.protocol import LLMProvider


def build_providers() -> list[LLMProvider]:
    providers: list[LLMProvider] = []
    for name in (part.strip() for part in settings.llm_chain.split(",")):
        if not name:
            continue
        if name == "groq":
            providers.append(GroqProvider(settings.groq_api_key, settings.groq_model))
        elif name == "gemini":
            providers.append(GeminiProvider(settings.gemini_api_key, settings.gemini_model))
        else:
            raise ValueError(f"Unknown LLM provider: {name}")
    return providers
