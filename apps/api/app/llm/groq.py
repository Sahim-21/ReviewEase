import httpx

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_GROQ_MODEL = "qwen/qwen3.8-27b"
GROQ_MODELS = (
    "llama-3.1-8b-instant",
    "llama3-8b-8192",
    "mixtral-8x7b-32768",
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
)
_RETIRED_GROQ_MODELS = {
    "llama-3.1-8b-instant": DEFAULT_GROQ_MODEL,
    "llama3-8b-8192": DEFAULT_GROQ_MODEL,
    "mixtral-8x7b-32768": DEFAULT_GROQ_MODEL,
}


def resolve_groq_model(model: str) -> str:
    name = (model or "").strip()
    if name in _RETIRED_GROQ_MODELS:
        return _RETIRED_GROQ_MODELS[name]
    if name in GROQ_MODELS:
        return name
    return DEFAULT_GROQ_MODEL


class GroqProvider:
    name = "groq"

    def __init__(
        self,
        api_key: str,
        model: str,
        *,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.api_key = api_key
        self.model = resolve_groq_model(model)
        self._client = client

    async def generate(
        self,
        system: str,
        user: str,
        *,
        max_tokens: int,
        temperature: float,
    ) -> str:
        if not self.api_key:
            raise RuntimeError("GROQ_API_KEY is not set")
        if self._client is not None:
            return await self._complete(self._client, system, user, max_tokens=max_tokens, temperature=temperature)
        async with httpx.AsyncClient(timeout=6) as client:
            return await self._complete(client, system, user, max_tokens=max_tokens, temperature=temperature)

    def _payload(self, system: str, user: str, *, max_tokens: int, temperature: float) -> dict[str, object]:
        body: dict[str, object] = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
        }
        if self.model.startswith("openai/gpt-oss"):
            body["max_completion_tokens"] = max(max_tokens, 1200)
        else:
            body["max_tokens"] = max_tokens
        return body

    async def _complete(
        self,
        client: httpx.AsyncClient,
        system: str,
        user: str,
        *,
        max_tokens: int,
        temperature: float,
    ) -> str:
        response = await client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {self.api_key}"},
            json=self._payload(system, user, max_tokens=max_tokens, temperature=temperature),
        )
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(f"Groq HTTP {exc.response.status_code}") from exc
        content = response.json()["choices"][0]["message"]["content"]
        if not isinstance(content, str) or not content.strip():
            raise RuntimeError("Groq returned an empty draft")
        return content
