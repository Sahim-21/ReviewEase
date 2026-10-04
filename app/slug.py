import re

from sqlalchemy.orm import Session

from app.repositories import restaurants


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.strip().casefold())
    slug = slug.strip("-")[:80] or "restaurant"
    return slug


def unique_slug(db: Session, name: str, requested: str | None = None) -> str:
    base = slugify(requested or name)
    candidate = base
    n = 2
    while restaurants.get_by_slug(db, candidate) is not None:
        suffix = f"-{n}"
        candidate = f"{base[: 80 - len(suffix)]}{suffix}"
        n += 1
    return candidate
