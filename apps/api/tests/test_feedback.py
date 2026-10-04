from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import PrivateFeedback
from tests.conftest import TEST_SLUG


def test_feedback_accepted_at_low_rating(client: TestClient, db: Session) -> None:
    response = client.post(
        "/api/feedback",
        json={
            "slug": TEST_SLUG,
            "message": "<p>Service was slow.</p>",
            "rating": 1,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["submitted"] is True
    row = db.get(PrivateFeedback, body["id"])
    assert row is not None
    assert row.message == "Service was slow."
    assert row.rating == 1
    assert row.session_id is None


def test_feedback_with_session_requires_token(client: TestClient) -> None:
    started = client.post(
        "/api/sessions",
        json={"slug": TEST_SLUG, "device_id": "device-fingerprint-2"},
    ).json()
    response = client.post(
        "/api/feedback",
        json={"slug": TEST_SLUG, "message": "Great naan", "session_id": started["id"]},
    )
    assert response.status_code == 401


def test_feedback_with_session_token(client: TestClient, db: Session) -> None:
    started = client.post(
        "/api/sessions",
        json={"slug": TEST_SLUG, "device_id": "device-fingerprint-2"},
    ).json()
    response = client.post(
        "/api/feedback",
        headers={"Authorization": f"Bearer {started['token']}"},
        json={"slug": TEST_SLUG, "message": "Great naan", "rating": 5, "session_id": started["id"]},
    )
    assert response.status_code == 200
    row = db.get(PrivateFeedback, response.json()["id"])
    assert row is not None
    assert row.session_id == started["id"]


def test_feedback_unknown_restaurant(client: TestClient) -> None:
    response = client.post(
        "/api/feedback",
        json={"slug": "missing-place", "message": "hello"},
    )
    assert response.status_code == 404
