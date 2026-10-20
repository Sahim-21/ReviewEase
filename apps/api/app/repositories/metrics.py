from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.event_types import COPY, GENERATE, OPEN_GOOGLE, SCAN, STEP_NOTES, STEP_STARS, STEP_TAGS
from app.models import DinerSession, Event, PrivateFeedback, Restaurant
from app.schemas import (
    AttentionItem,
    DayCount,
    FeedbackItem,
    FunnelCounts,
    OwnerMetrics,
    RatingStats,
    RestaurantStats,
)


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


def _event_counts(db: Session, restaurant_id: int) -> dict[str, int]:
    rows = db.execute(
        select(Event.type, func.count()).where(Event.restaurant_id == restaurant_id).group_by(Event.type)
    ).all()
    return {str(kind): int(total) for kind, total in rows}


def _sessions_reaching(db: Session, restaurant_id: int, types: tuple[str, ...]) -> int:
    stmt = select(func.count(func.distinct(Event.session_id))).where(
        Event.restaurant_id == restaurant_id, Event.type.in_(types), Event.session_id.is_not(None)
    )
    return int(db.scalar(stmt) or 0)


def _rating_stats(db: Session, restaurant_id: int) -> RatingStats:
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
    return RatingStats(
        count=rated,
        average=round(sum((i + 1) * n for i, n in enumerate(distribution)) / rated, 2) if rated else None,
        distribution=distribution,
    )


def _daily(db: Session, restaurant_id: int, days: int) -> list[DayCount]:
    today = datetime.now(UTC).date()
    start = today - timedelta(days=days - 1)
    start_dt = datetime.combine(start, datetime.min.time(), tzinfo=UTC)
    day_col = func.date(Event.ts)
    rows = db.execute(
        select(day_col, Event.type, func.count())
        .where(
            Event.restaurant_id == restaurant_id,
            Event.ts >= start_dt,
            Event.type.in_((SCAN, GENERATE, OPEN_GOOGLE)),
        )
        .group_by(day_col, Event.type)
    ).all()
    field_for = {SCAN: "scans", GENERATE: "drafts", OPEN_GOOGLE: "opened_google"}
    by_day: dict[str, dict[str, int]] = {}
    for day, kind, total in rows:
        bucket = by_day.setdefault(str(day)[:10], {"scans": 0, "drafts": 0, "opened_google": 0})
        bucket[field_for[str(kind)]] += int(total)
    daily: list[DayCount] = []
    cursor = start
    while cursor <= today:
        key = cursor.isoformat()
        daily.append(DayCount(day=key, **by_day.get(key, {"scans": 0, "drafts": 0, "opened_google": 0})))
        cursor = date.fromordinal(cursor.toordinal() + 1)
    return daily


def owner_metrics(db: Session, restaurant_id: int, *, days: int = 14) -> OwnerMetrics:
    restaurant = db.get(Restaurant, restaurant_id)
    if restaurant is None:
        raise ValueError("restaurant")

    counts = _event_counts(db, restaurant_id)
    funnel = FunnelCounts(
        scans=counts.get(SCAN, 0),
        started=_sessions_reaching(db, restaurant_id, (STEP_STARS,)),
        rated=_sessions_reaching(db, restaurant_id, (STEP_TAGS, STEP_NOTES)),
        drafts=counts.get(GENERATE, 0),
        copied=counts.get(COPY, 0),
        opened_google=counts.get(OPEN_GOOGLE, 0),
    )

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
        daily=_daily(db, restaurant_id, days),
        feedback=feedback,
        ratings=_rating_stats(db, restaurant_id),
        attention=_attention(db, restaurant_id, feedback_rows),
    )


def stats_for_restaurants(db: Session, restaurant_ids: list[int]) -> dict[int, RestaurantStats]:
    """Headline numbers for many restaurants in a handful of grouped queries (admin overview)."""
    stats = {rid: RestaurantStats() for rid in restaurant_ids}
    if not restaurant_ids:
        return stats
    for rid, kind, total in db.execute(
        select(Event.restaurant_id, Event.type, func.count())
        .where(Event.restaurant_id.in_(restaurant_ids), Event.type.in_((SCAN, OPEN_GOOGLE)))
        .group_by(Event.restaurant_id, Event.type)
    ).all():
        if kind == SCAN:
            stats[rid].scans = int(total)
        else:
            stats[rid].opened_google = int(total)
    for rid, total in db.execute(
        select(Event.restaurant_id, func.count(func.distinct(Event.session_id)))
        .where(Event.restaurant_id.in_(restaurant_ids), Event.type == STEP_STARS)
        .group_by(Event.restaurant_id)
    ).all():
        stats[rid].started = int(total)
    for rid, total in db.execute(
        select(PrivateFeedback.restaurant_id, func.count())
        .where(PrivateFeedback.restaurant_id.in_(restaurant_ids))
        .group_by(PrivateFeedback.restaurant_id)
    ).all():
        stats[rid].feedback = int(total)
    for rid, average in db.execute(
        select(DinerSession.restaurant_id, func.avg(DinerSession.overall_rating))
        .where(DinerSession.restaurant_id.in_(restaurant_ids), DinerSession.overall_rating.is_not(None))
        .group_by(DinerSession.restaurant_id)
    ).all():
        stats[rid].average_stars = round(float(average), 2) if average is not None else None
    return stats
