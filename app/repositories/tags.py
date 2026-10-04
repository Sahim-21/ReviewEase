from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import TagBank
from app.schemas import TagCreate


def list_for_restaurant(db: Session, restaurant_id: int) -> list[TagBank]:
    stmt = select(TagBank).where(TagBank.restaurant_id == restaurant_id).order_by(TagBank.id)
    return list(db.scalars(stmt).all())


def create_many(db: Session, restaurant_id: int, tags: list[TagCreate]) -> list[TagBank]:
    rows = [
        TagBank(restaurant_id=restaurant_id, label=tag.label, aspect=tag.aspect)
        for tag in tags
    ]
    db.add_all(rows)
    db.flush()
    return rows
