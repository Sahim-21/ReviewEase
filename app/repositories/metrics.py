from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.event_types import COPY, GENERATE, OPEN_GOOGLE, SCAN
from app.models import DinerSession, Event, PrivateFeedback, Restaurant
from app.schemas import DayCount, FeedbackItem, FunnelCounts, OwnerMetrics


def owner_metrics(db: Session, restaurant_id: int, *, days: int = 14) -> OwnerMetrics:
    restaurant = db.get(Restaurant, restaurant_id)
    if restaurant is None:
        raise ValueError("restaurant")

    def _count(event_type: str) -> int:
        stmt = (
            select(func.count())
            .select_from(Event)
            .where(Event.restaurant_id == restaurant_id, Event.type == event_type)
        )
        return int(db.scalar(stmt) or 0)

    started = int(
        db.scalar(
            select(func.count()).select_from(DinerSession).where(DinerSession.restaurant_id == restaurant_id)
        )
        or 0
    )
    funnel = FunnelCounts(
        scans=_count(SCAN),
        started=started,
        drafts=_count(GENERATE),
        copied=_count(COPY),
        opened_google=_count(OPEN_GOOGLE),
    )

    start = datetime.now(UTC).date() - timedelta(days=days - 1)
    start_dt = datetime.combine(start, datetime.min.time(), tzinfo=UTC)
    events = list(
        db.scalars(
            select(Event).where(Event.restaurant_id == restaurant_id, Event.ts >= start_dt)
        ).all()
    )
    by_day: dict[str, dict[str, int]] = {}
    for event in events:
        ts = event.ts
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=UTC)
        key = ts.astimezone(UTC).date().isoformat()
        bucket = by_day.setdefault(key, {"scans": 0, "drafts": 0, "opened_google": 0})
        if event.type == SCAN:
            bucket["scans"] += 1
        elif event.type == GENERATE:
            bucket["drafts"] += 1
        elif event.type == OPEN_GOOGLE:
            bucket["opened_google"] += 1

    daily: list[DayCount] = []
    cursor = start
    today = datetime.now(UTC).date()
    while cursor <= today:
        key = cursor.isoformat()
        bucket = by_day.get(key, {"scans": 0, "drafts": 0, "opened_google": 0})
        daily.append(DayCount(day=key, **bucket))
        cursor = date.fromordinal(cursor.toordinal() + 1)

    feedback_rows = list(
        db.scalars(
            select(PrivateFeedback)
            .where(PrivateFeedback.restaurant_id == restaurant_id)
            .order_by(PrivateFeedback.created_at.desc())
            .limit(50)
        ).all()
    )
    feedback = [
        FeedbackItem(
            id=row.id,
            message=row.message,
            rating=row.rating,
            contact=row.contact,
            created_at=row.created_at.isoformat(),
        )
        for row in feedback_rows
    ]
    return OwnerMetrics(
        restaurant_id=restaurant.id,
        restaurant_name=restaurant.name,
        funnel=funnel,
        daily=daily,
        feedback=feedback,
    )
