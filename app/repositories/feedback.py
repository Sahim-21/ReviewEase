from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import PrivateFeedback
from app.schemas import FeedbackCreate


def create(db: Session, data: FeedbackCreate) -> PrivateFeedback:
    row = PrivateFeedback(
        restaurant_id=data.restaurant_id,
        session_id=data.session_id,
        message=data.message,
        rating=data.rating,
        contact=data.contact,
    )
    db.add(row)
    db.flush()
    return row


def list_for_restaurant(db: Session, restaurant_id: int) -> list[PrivateFeedback]:
    stmt = (
        select(PrivateFeedback)
        .where(PrivateFeedback.restaurant_id == restaurant_id)
        .order_by(PrivateFeedback.created_at.desc())
    )
    return list(db.scalars(stmt).all())
