from typing import Literal

from pydantic import BaseModel, Field


class DraftInput(BaseModel):
    items: list[str] = Field(default_factory=list)
    ratings: dict[str, int] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    raw_text: str = ""
    tone: Literal["casual", "detailed", "short"] = "casual"
    lang: str = "English"
    menu: list[str] = Field(default_factory=list)


class Draft(BaseModel):
    text: str
    provider: str
    grounding_ok: bool
