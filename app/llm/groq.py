import httpx

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


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
            raise RuntimeError("GROQ_API_KEY is not set")
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
            GROQ_URL,
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "max_tokens": max_tokens,
                "temperature": temperature,
            },
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        if not isinstance(content, str) or not content.strip():
            raise RuntimeError("Groq returned an empty draft")
        return content
