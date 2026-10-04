from app.draft_limits import ALLOWED_LANGS, ALLOWED_TONES
from app.errors import ApiError
from app.models import MenuItem, TagBank
from app.schemas import SessionDraftRequest


def normalize_lang(value: str) -> str:
    key = value.strip().casefold()
    lang = ALLOWED_LANGS.get(key)
    if lang is None:
        raise ApiError(422, "INVALID_LANG", "lang must be English, Hinglish, Hindi, or Kannada")
    return lang


def normalize_tone(value: str) -> str:
    tone = value.strip().casefold()
    if tone not in ALLOWED_TONES:
        raise ApiError(422, "INVALID_TONE", "tone must be casual, detailed, or short")
    return tone


def resolve_items(requested: list[str], menu: list[MenuItem]) -> list[str]:
    by_name = {item.name.casefold(): item.name for item in menu if item.active}
    resolved: list[str] = []
    seen: set[str] = set()
    for name in requested:
        cleaned = name.strip()
        if not cleaned:
            continue
        match = by_name.get(cleaned.casefold(), cleaned)
        key = match.casefold()
        if key in seen:
            continue
        seen.add(key)
        resolved.append(match)
    return resolved


def resolve_tags(requested: list[str], bank: list[TagBank]) -> list[str]:
    by_label = {row.label.casefold(): row.label for row in bank}
    resolved: list[str] = []
    seen: set[str] = set()
    for label in requested:
        cleaned = label.strip()
        if not cleaned:
            continue
        match = by_label.get(cleaned.casefold(), cleaned)
        key = match.casefold()
        if key in seen:
            continue
        seen.add(key)
        resolved.append(match)
    return resolved


def prepare_draft_input(body: SessionDraftRequest, menu: list[MenuItem], bank: list[TagBank]) -> tuple[str, str, list[str], list[str]]:
    tone = normalize_tone(body.tone)
    lang = normalize_lang(body.lang)
    items = resolve_items(body.items, menu)
    tags = resolve_tags(body.tags, bank)
    return tone, lang, items, tags
