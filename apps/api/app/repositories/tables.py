from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import DiningTable
from app.schemas import TableCreate


def get_by_id(db: Session, table_id: int) -> DiningTable | None:
    return db.get(DiningTable, table_id)


def get_by_label(db: Session, restaurant_id: int, label: str) -> DiningTable | None:
    stmt = select(DiningTable).where(
        DiningTable.restaurant_id == restaurant_id,
        DiningTable.label == label,
    )
    return db.scalar(stmt)


def list_for_restaurant(db: Session, restaurant_id: int) -> list[DiningTable]:
    stmt = select(DiningTable).where(DiningTable.restaurant_id == restaurant_id).order_by(DiningTable.id)
    return list(db.scalars(stmt).all())


def create(db: Session, restaurant_id: int, data: TableCreate) -> DiningTable:
    table = DiningTable(restaurant_id=restaurant_id, label=data.label)
    db.add(table)
    db.flush()
    return table
