import asyncio

import httpx

from app.llm.gemini import GEMINI_URL, GeminiProvider
from app.llm.groq import GROQ_URL, GroqProvider, resolve_groq_model


def test_groq_posts_openai_compatible_chat() -> None:
    seen: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["auth"] = request.headers["Authorization"]
        seen["body"] = request.read().decode()
        return httpx.Response(200, json={"choices": [{"message": {"content": "A grounded draft."}}]})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = GroqProvider("test-key", "llama-3.1-8b-instant", client=client)
    text = asyncio.run(provider.generate("system rules", "user json", max_tokens=120, temperature=0.8))
    assert text == "A grounded draft."
    assert seen["url"] == GROQ_URL
    assert seen["auth"] == "Bearer test-key"
    assert "qwen/qwen3.8-27b" in str(seen["body"])
    assert "system rules" in str(seen["body"])


def test_groq_requires_api_key() -> None:
    provider = GroqProvider("", "llama-3.1-8b-instant")
    try:
        asyncio.run(provider.generate("s", "u", max_tokens=10, temperature=0.7))
    except RuntimeError as exc:
        assert "GROQ_API_KEY" in str(exc)
    else:
        raise AssertionError("expected missing key to fail")


def test_groq_falls_back_from_unknown_model() -> None:
    assert resolve_groq_model("not-a-real-model") == "qwen/qwen3.8-27b"
    assert resolve_groq_model("llama-3.1-8b-instant") == "qwen/qwen3.8-27b"
    assert resolve_groq_model("openai/gpt-oss-20b") == "openai/gpt-oss-20b"


def test_gemini_posts_generate_content() -> None:
    seen: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["key"] = request.headers["x-goog-api-key"]
        seen["body"] = request.read().decode()
        return httpx.Response(
            200,
            json={"candidates": [{"content": {"parts": [{"text": "Kannada draft."}]}}]},
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = GeminiProvider("gemini-key", "gemini-2.0-flash-lite", client=client)
    text = asyncio.run(provider.generate("system rules", "user json", max_tokens=80, temperature=0.4))
    assert text == "Kannada draft."
    assert seen["url"] == GEMINI_URL.format(model="gemini-2.0-flash-lite")
    assert "key=" not in seen["url"]
    assert seen["key"] == "gemini-key"
    assert "system rules" in seen["body"]
    assert "user json" in seen["body"]
