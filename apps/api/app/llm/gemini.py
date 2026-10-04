import httpx

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


class GeminiProvider:
    name = "gemini"

    def __init__(
        self,
        api_key: str,
        model: str,
        *,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.api_key = api_key
        self.model = model
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
            raise RuntimeError("GEMINI_API_KEY is not set")
        if self._client is not None:
            return await self._complete(self._client, system, user, max_tokens=max_tokens, temperature=temperature)
        async with httpx.AsyncClient(timeout=6) as client:
            return await self._complete(client, system, user, max_tokens=max_tokens, temperature=temperature)

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
            GEMINI_URL.format(model=self.model),
            headers={"x-goog-api-key": self.api_key},
            json={
                "system_instruction": {"parts": [{"text": system}]},
                "contents": [{"role": "user", "parts": [{"text": user}]}],
                "generationConfig": {
                    "maxOutputTokens": max_tokens,
                    "temperature": temperature,
                },
            },
        )
        response.raise_for_status()
        content = response.json()["candidates"][0]["content"]["parts"][0]["text"]
        if not isinstance(content, str) or not content.strip():
            raise RuntimeError("Gemini returned an empty draft")
        return content
