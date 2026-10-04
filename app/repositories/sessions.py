from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import DinerSession
from app.schemas import SessionCompleteUpdate, SessionCreate, SessionDraftUpdate


def get_by_id(db: Session, session_id: int) -> DinerSession | None:
    return db.get(DinerSession, session_id)


def list_recent_drafts(db: Session, restaurant_id: int, *, limit: int = 20) -> list[str]:
    stmt = (
        select(DinerSession.draft_text)
        .where(
            DinerSession.restaurant_id == restaurant_id,
            DinerSession.draft_text.is_not(None),
            DinerSession.draft_text != "",
        )
        .order_by(DinerSession.id.desc())
        .limit(limit)
    )
    return [text for text in db.scalars(stmt).all() if text]


def create(db: Session, data: SessionCreate) -> DinerSession:
    session = DinerSession(
        restaurant_id=data.restaurant_id,
        table_id=data.table_id,
        device_hash=data.device_hash,
    )
    db.add(session)
    db.flush()
    return session


def update_draft(db: Session, session: DinerSession, data: SessionDraftUpdate) -> DinerSession:
    payload: dict[str, Any] = data.model_dump(exclude_unset=True)
    for field, value in payload.items():
        setattr(session, field, value)
    db.flush()
    return session


def complete(db: Session, session: DinerSession, data: SessionCompleteUpdate) -> DinerSession:
    session.final_text = data.final_text
    session.clicked_google = data.clicked_google
    session.completed_at = datetime.now(UTC)
    db.flush()
    return session
