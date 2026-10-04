from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.event_types import COMPLETE, COPY, OPEN_GOOGLE, SCAN
from app.hashing import hash_device_id
from app.models import DinerSession, Event
from tests.conftest import TEST_SLUG


def _start(client: TestClient) -> dict[str, object]:
    response = client.post(
        "/api/sessions",
        json={"slug": TEST_SLUG, "device_id": "device-fingerprint-1", "table": "1"},
    )
    assert response.status_code == 200
    return response.json()


def test_start_session_returns_signed_token(client: TestClient, db: Session) -> None:
    body = _start(client)
    assert isinstance(body["id"], int)
    assert isinstance(body["token"], str)
    assert body["expires_in"] == 120 * 60
    types = [row.type for row in db.query(Event).filter(Event.session_id == body["id"]).all()]
    assert types == [SCAN]
    row = db.get(DinerSession, body["id"])
    assert row is not None
    assert row.device_hash == hash_device_id("device-fingerprint-1")
    assert row.device_hash != "device-fingerprint-1"


def test_start_session_unknown_restaurant(client: TestClient) -> None:
    response = client.post(
        "/api/sessions",
        json={"slug": "nope", "device_id": "device-fingerprint-1"},
    )
    assert response.status_code == 404


def test_complete_requires_token(client: TestClient) -> None:
    started = _start(client)
    response = client.post(
        f"/api/sessions/{started['id']}/complete",
        json={"final_text": "The butter chicken was good.", "clicked_google": True, "copied": True},
    )
    assert response.status_code == 401


def test_complete_rejects_mismatched_token(client: TestClient) -> None:
    first = _start(client)
    second = _start(client)
    response = client.post(
        f"/api/sessions/{first['id']}/complete",
        headers={"Authorization": f"Bearer {second['token']}"},
        json={"final_text": "The butter chicken was good."},
    )
    assert response.status_code == 403


def test_complete_saves_text_and_logs_events(client: TestClient, db: Session) -> None:
    started = _start(client)
    response = client.post(
        f"/api/sessions/{started['id']}/complete",
        headers={"Authorization": f"Bearer {started['token']}"},
        json={
            "final_text": "<b>The butter chicken was good.</b>",
            "clicked_google": True,
            "copied": True,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["final_text"] == "The butter chicken was good."
    assert body["clicked_google"] is True
    types = [row.type for row in db.query(Event).filter(Event.session_id == started["id"]).all()]
    assert types == [SCAN, COMPLETE, COPY, OPEN_GOOGLE]
