from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.event_types import GENERATE, SCAN
from app.llm.schemas import Draft
from app.models import DinerSession, Event
from tests.conftest import TEST_SLUG

_PAYLOAD: dict[str, Any] = {
    "items": ["Butter chicken"],
    "ratings": {"food": 4, "service": 3},
    "tags": ["Flavourful"],
    "raw_text": "nice gravy",
    "tone": "casual",
    "lang": "English",
}


def _start(client: TestClient, device_id: str = "device-fingerprint-1") -> dict[str, Any]:
    response = client.post(
        "/api/sessions",
        json={"slug": TEST_SLUG, "device_id": device_id, "table": "1"},
    )
    assert response.status_code == 200
    return response.json()


def _draft(client: TestClient, started: dict[str, Any], payload: dict[str, Any] | None = None):
    return client.post(
        f"/api/sessions/{started['id']}/draft",
        headers={"Authorization": f"Bearer {started['token']}"},
        json=payload or _PAYLOAD,
    )


def test_draft_requires_token(client: TestClient) -> None:
    started = _start(client)
    response = client.post(f"/api/sessions/{started['id']}/draft", json=_PAYLOAD)
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "SESSION_TOKEN_REQUIRED"


def test_draft_rejects_invalid_tone(client: TestClient) -> None:
    started = _start(client)
    response = _draft(client, started, {**_PAYLOAD, "tone": "poetic"})
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "INVALID_TONE"


def test_draft_rejects_invalid_lang(client: TestClient) -> None:
    started = _start(client)
    response = _draft(client, started, {**_PAYLOAD, "lang": "Martian"})
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "INVALID_LANG"


def test_draft_accepts_custom_item_not_on_listed_menu(client: TestClient, monkeypatch) -> None:
    async def fake_draft(inp, **kwargs):
        assert "Haneeth" in inp.items
        assert "Butter chicken" in inp.items
        return Draft(text="I had butter chicken and haneeth.", provider="groq", grounding_ok=True)

    monkeypatch.setattr("app.routers.sessions.draft_review", fake_draft)
    started = _start(client)
    response = _draft(client, started, {**_PAYLOAD, "items": ["Butter chicken", "Haneeth"]})
    assert response.status_code == 200
    assert response.json()["text"]


def test_draft_rejects_long_raw_text(client: TestClient) -> None:
    started = _start(client)
    response = _draft(client, started, {**_PAYLOAD, "raw_text": "x" * 1001})
    assert response.status_code == 422


def test_draft_stores_text_and_logs_generate(client: TestClient, db: Session, monkeypatch) -> None:
    async def fake_draft(inp, **kwargs):
        assert inp.items == ["Butter chicken"]
        assert inp.tone == "casual"
        assert inp.lang == "English"
        return Draft(text="I had butter chicken.", provider="groq", grounding_ok=True)

    monkeypatch.setattr("app.routers.sessions.draft_review", fake_draft)
    started = _start(client)
    response = _draft(client, started)
    assert response.status_code == 200
    body = response.json()
    assert body["text"] == "I had butter chicken."
    assert body["provider"] == "groq"
    assert body["grounding_ok"] is True
    row = db.get(DinerSession, started["id"])
    assert row is not None
    assert row.draft_text == "I had butter chicken."
    assert row.llm_provider == "groq"
    assert row.grounding_ok is True
    types = [event.type for event in db.query(Event).filter(Event.session_id == started["id"]).all()]
    assert types == [SCAN, GENERATE]


def test_draft_rate_limit_per_session(client: TestClient, monkeypatch) -> None:
    async def fake_draft(inp, **kwargs):
        return Draft(text="I had butter chicken.", provider="template", grounding_ok=True)

    monkeypatch.setattr("app.routers.sessions.draft_review", fake_draft)
    started = _start(client)
    for _ in range(5):
        assert _draft(client, started).status_code == 200
    limited = _draft(client, started)
    assert limited.status_code == 429
    assert limited.json()["detail"]["code"] == "RATE_LIMIT_SESSION"


def test_draft_rate_limit_per_device_per_day(client: TestClient, monkeypatch) -> None:
    async def fake_draft(inp, **kwargs):
        return Draft(text="I had butter chicken.", provider="template", grounding_ok=True)

    monkeypatch.setattr("app.routers.sessions.draft_review", fake_draft)
    device = "shared-device-fingerprint"
    for _ in range(4):
        started = _start(client, device_id=device)
        for _inner in range(5):
            assert _draft(client, started).status_code == 200
    extra = _start(client, device_id=device)
    limited = _draft(client, extra)
    assert limited.status_code == 429
    assert limited.json()["detail"]["code"] == "RATE_LIMIT_DEVICE"
