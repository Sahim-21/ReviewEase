from typing import Protocol


class LLMProvider(Protocol):
    name: str

    async def generate(
        self,
        system: str,
        user: str,
        *,
        max_tokens: int,
        temperature: float,
    ) -> str: ...
