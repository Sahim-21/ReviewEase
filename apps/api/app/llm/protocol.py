from typing import Protocol


class RateLimited(RuntimeError):
    """The provider refused the call because a rate limit was hit (HTTP 429)."""

    def __init__(self, provider: str, retry_after: float | None = None) -> None:
        super().__init__(f"{provider} rate limited")
        self.provider = provider
        self.retry_after = retry_after


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
