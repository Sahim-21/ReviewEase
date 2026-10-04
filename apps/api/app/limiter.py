from datetime import UTC, date, datetime
from threading import Lock

SESSION_DRAFT_LIMIT = 5
DEVICE_DAILY_LIMIT = 20


class InMemoryLimiter:
    def __init__(self) -> None:
        self._lock = Lock()
        self._counts: dict[tuple[str, str], int] = {}

    def reset(self) -> None:
        with self._lock:
            self._counts.clear()

    def _used(self, key: str, window: str) -> int:
        return self._counts.get((key, window), 0)

    def allow_draft(self, session_id: int, device_hash: str, *, today: date | None = None) -> str | None:
        day = (today or datetime.now(UTC).date()).isoformat()
        session_key = ("session:" + str(session_id), "lifetime")
        device_key = ("device:" + device_hash, day)
        with self._lock:
            if self._counts.get(session_key, 0) >= SESSION_DRAFT_LIMIT:
                return "RATE_LIMIT_SESSION"
            if self._counts.get(device_key, 0) >= DEVICE_DAILY_LIMIT:
                return "RATE_LIMIT_DEVICE"
            self._counts[session_key] = self._counts.get(session_key, 0) + 1
            self._counts[device_key] = self._counts.get(device_key, 0) + 1
            return None


limiter = InMemoryLimiter()
