from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Event
from app.schemas import EventCreate


def create(db: Session, data: EventCreate) -> Event:
    row = Event(
        restaurant_id=data.restaurant_id,
        session_id=data.session_id,
        type=data.type,
    )
    db.add(row)
    db.flush()
    return row


def list_for_session(db: Session, session_id: int) -> list[Event]:
    stmt = select(Event).where(Event.session_id == session_id).order_by(Event.ts)
    return list(db.scalars(stmt).all())
