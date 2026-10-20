"""Fixed-window rate limits stored in Postgres.

The old limiter kept its counters in process memory, so every Render restart or spin-down
reset them (and the dict grew forever). Counters now live in the `rate_limits` table, keyed by
"<name>:<subject>:<window-bucket>", and expired rows are pruned opportunistically.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.models import RateLimit

SESSION_DRAFT_LIMIT = 5
DEVICE_DAILY_LIMIT = 20
_DAY = 24 * 60 * 60
_PRUNE_PROBABILITY = 0.02


@dataclass(frozen=True)
class Rule:
    name: str
    limit: int
    window_seconds: int


# Diner-facing endpoints
SESSION_PER_IP = Rule("session-ip", 60, 60 * 60)
SESSION_PER_DEVICE = Rule("session-device", 30, 60 * 60)
FEEDBACK_PER_IP = Rule("feedback-ip", 20, 60 * 60)
FEEDBACK_PER_DEVICE = Rule("feedback-device", 8, 60 * 60)
DRAFT_PER_SESSION = Rule("draft-session", SESSION_DRAFT_LIMIT, 30 * _DAY)
DRAFT_PER_DEVICE = Rule("draft-device", DEVICE_DAILY_LIMIT, _DAY)
# Staff login: only failed attempts are counted.
LOGIN_FAIL_PER_IP = Rule("login-ip", 20, 15 * 60)
LOGIN_FAIL_PER_EMAIL = Rule("login-email", 8, 15 * 60)


def _now() -> datetime:
    return datetime.now(UTC)


def _key(rule: Rule, subject: str, now: datetime) -> tuple[str, datetime]:
    bucket = int(now.timestamp()) // rule.window_seconds
    expires = datetime.fromtimestamp((bucket + 1) * rule.window_seconds, UTC)
    return f"{rule.name}:{subject}:{bucket}", expires


class RateLimiter:
    def used(self, db: Session, rule: Rule, subject: str) -> int:
        key, _ = _key(rule, subject, _now())
        return int(db.scalar(select(RateLimit.count).where(RateLimit.key == key)) or 0)

    def blocked(self, db: Session, rule: Rule, subject: str) -> bool:
        return self.used(db, rule, subject) >= rule.limit

    def hit(self, db: Session, rule: Rule, subject: str) -> int:
        """Count one use and return the new total for this window."""
        now = _now()
        key, expires = _key(rule, subject, now)
        dialect = db.get_bind().dialect.name
        insert = pg_insert if dialect == "postgresql" else sqlite_insert
        stmt = insert(RateLimit).values(key=key, count=1, expires_at=expires)
        stmt = stmt.on_conflict_do_update(index_elements=[RateLimit.key], set_={"count": RateLimit.count + 1})
        db.execute(stmt)
        if random.random() < _PRUNE_PROBABILITY:
            db.execute(delete(RateLimit).where(RateLimit.expires_at < now - timedelta(minutes=1)))
        return self.used(db, rule, subject)

    def take(self, db: Session, rule: Rule, subject: str) -> bool:
        """Count one use if the limit allows it. False means the caller is over the limit."""
        if self.blocked(db, rule, subject):
            return False
        self.hit(db, rule, subject)
        return True

    def allow_draft(self, db: Session, session_id: int, device_hash: str) -> str | None:
        if self.blocked(db, DRAFT_PER_SESSION, str(session_id)):
            return "RATE_LIMIT_SESSION"
        if self.blocked(db, DRAFT_PER_DEVICE, device_hash):
            return "RATE_LIMIT_DEVICE"
        self.hit(db, DRAFT_PER_SESSION, str(session_id))
        self.hit(db, DRAFT_PER_DEVICE, device_hash)
        return None

    def drafts_left(self, db: Session, session_id: int) -> int:
        return max(0, SESSION_DRAFT_LIMIT - self.used(db, DRAFT_PER_SESSION, str(session_id)))

    def reset(self) -> None:
        """Kept for tests: counters live in the per-test database, so there is nothing to clear."""


limiter = RateLimiter()
