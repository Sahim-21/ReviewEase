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


def _draft(client: TestClient, started: dict[str, object], **extra: object) -> dict[str, object]:
    response = client.post(
        f"/api/sessions/{started['id']}/draft",
        headers={"Authorization": f"Bearer {started['token']}"},
        json={"items": ["Butter chicken"], "tone": "casual", "lang": "English", **extra},
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_draft_stores_overall_stars_and_fills_aspects(client: TestClient, db: Session) -> None:
    started = _start(client)
    _draft(client, started, overall_rating=4, ratings={"service": 2})
    row = db.get(DinerSession, started["id"])
    assert row is not None
    assert row.overall_rating == 4
    assert row.ratings == {"service": 2, "food": 4, "ambience": 4, "value": 4}


def test_draft_derives_overall_from_aspect_ratings(client: TestClient, db: Session) -> None:
    started = _start(client)
    _draft(client, started, ratings={"food": 5, "service": 3, "ambience": 3, "value": 5})
    row = db.get(DinerSession, started["id"])
    assert row is not None
    assert row.overall_rating == 4


def test_draft_rejects_out_of_range_stars(client: TestClient) -> None:
    started = _start(client)
    for stars in (0, 6):
        response = client.post(
            f"/api/sessions/{started['id']}/draft",
            headers={"Authorization": f"Bearer {started['token']}"},
            json={"items": [], "overall_rating": stars},
        )
        assert response.status_code == 422


def test_draft_without_ratings_leaves_overall_empty(client: TestClient, db: Session) -> None:
    started = _start(client)
    _draft(client, started)
    row = db.get(DinerSession, started["id"])
    assert row is not None
    assert row.overall_rating is None
