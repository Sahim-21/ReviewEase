from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.event_types import COPY, GENERATE, OPEN_GOOGLE, SCAN
from app.models import DinerSession, Event, PrivateFeedback, Restaurant
from app.schemas import AttentionItem, DayCount, FeedbackItem, FunnelCounts, OwnerMetrics, RatingStats


LOW_STARS = 2
ATTENTION_LIMIT = 20


def _iso(value: datetime | None) -> str:
    return value.isoformat() if value else ""


def _attention(db: Session, restaurant_id: int, feedback_rows: list[PrivateFeedback]) -> list[AttentionItem]:
    """Low-star private notes plus low-star visits that left no note, newest first."""
    items: list[tuple[datetime | None, AttentionItem]] = []
    noted_sessions = {row.session_id for row in feedback_rows if row.session_id is not None}
    for row in feedback_rows:
        if row.rating is not None and row.rating <= LOW_STARS:
            items.append(
                (
                    row.created_at,
                    AttentionItem(
                        kind="feedback",
                        id=row.id,
                        rating=row.rating,
                        message=row.message,
                        contact=row.contact,
                        created_at=_iso(row.created_at),
                    ),
                )
            )
    sessions = db.scalars(
        select(DinerSession)
        .where(DinerSession.restaurant_id == restaurant_id, DinerSession.overall_rating <= LOW_STARS)
        .order_by(DinerSession.started_at.desc())
        .limit(ATTENTION_LIMIT * 2)
    ).all()
    for row in sessions:
        if row.id in noted_sessions:
            continue
        dishes = [str(name) for name in row.items] if isinstance(row.items, list) else []
        items.append(
            (
                row.started_at,
                AttentionItem(
                    kind="session",
                    id=row.id,
                    rating=row.overall_rating,
                    items=dishes,
                    note=row.raw_text or None,
                    created_at=_iso(row.started_at),
                ),
            )
        )
    items.sort(key=lambda pair: pair[0].timestamp() if pair[0] else 0.0, reverse=True)
    return [item for _, item in items[:ATTENTION_LIMIT]]


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
    attention = _attention(db, restaurant_id, feedback_rows)
    star_rows = db.execute(
        select(DinerSession.overall_rating, func.count())
        .where(DinerSession.restaurant_id == restaurant_id, DinerSession.overall_rating.is_not(None))
        .group_by(DinerSession.overall_rating)
    ).all()
    distribution = [0, 0, 0, 0, 0]
    for stars, total in star_rows:
        if 1 <= int(stars) <= 5:
            distribution[int(stars) - 1] = int(total)
    rated = sum(distribution)
    ratings = RatingStats(
        count=rated,
        average=round(sum((i + 1) * n for i, n in enumerate(distribution)) / rated, 2) if rated else None,
        distribution=distribution,
    )
    return OwnerMetrics(
        restaurant_id=restaurant.id,
        restaurant_name=restaurant.name,
        funnel=funnel,
        daily=daily,
        feedback=feedback,
        ratings=ratings,
        attention=attention,
    )
