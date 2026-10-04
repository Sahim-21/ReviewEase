from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import MenuItem
from app.schemas import MenuItemCreate


def list_for_restaurant(db: Session, restaurant_id: int, *, active_only: bool = False) -> list[MenuItem]:
    stmt = select(MenuItem).where(MenuItem.restaurant_id == restaurant_id)
    if active_only:
        stmt = stmt.where(MenuItem.active.is_(True))
    return list(db.scalars(stmt.order_by(MenuItem.id)).all())


def create_many(db: Session, restaurant_id: int, items: list[MenuItemCreate]) -> list[MenuItem]:
    rows = [
        MenuItem(
            restaurant_id=restaurant_id,
            name=item.name,
            category=item.category,
            active=item.active,
        )
        for item in items
    ]
    db.add_all(rows)
    db.flush()
    return rows


def replace_for_restaurant(db: Session, restaurant_id: int, items: list[MenuItemCreate]) -> list[MenuItem]:
    db.execute(delete(MenuItem).where(MenuItem.restaurant_id == restaurant_id))
    return create_many(db, restaurant_id, items)
