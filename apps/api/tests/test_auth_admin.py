from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.passwords import hash_password
from app.qr import review_url
from app.repositories import users
from app.schemas import UserCreate
from tests.conftest import TEST_SLUG


def _user(db: Session, *, email: str, password: str, role: str, restaurant_id: int | None) -> None:
    users.create(
        db,
        UserCreate(
            email=email,
            password_hash=hash_password(password),
            role=role,
            restaurant_id=restaurant_id,
        ),
    )
    db.commit()


def _login(client: TestClient, email: str, password: str) -> str:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return str(response.json()["token"])


def test_login_rejects_bad_password(client: TestClient, db: Session) -> None:
    _user(db, email="admin@example.com", password="correct-horse", role="admin", restaurant_id=None)
    response = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "wrong-pass"})
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "LOGIN_FAILED"


def test_session_jwt_cannot_call_admin(client: TestClient) -> None:
    started = client.post("/api/sessions", json={"slug": TEST_SLUG, "device_id": "dev-auth-1"})
    token = started.json()["token"]
    response = client.get("/api/admin/restaurants", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_admin_creates_restaurant_and_qr(client: TestClient, db: Session) -> None:
    _user(db, email="admin@example.com", password="correct-horse", role="admin", restaurant_id=None)
    token = _login(client, "admin@example.com", "correct-horse")
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post(
        "/api/admin/restaurants",
        headers=headers,
        json={
            "name": "Spice Lane",
            "google_place_id": "ChIJSpiceLane00000000000000",
            "brand_color": "#334455",
            "menu": [{"name": "Dal tadka", "category": "mains"}],
            "tags": [{"label": "Warm", "aspect": "ambience"}],
            "owner_email": "owner@spice.test",
            "owner_password": "owner-pass-1",
        },
    )
    assert created.status_code == 200, created.text
    body = created.json()
    assert body["slug"] == "spice-lane"
    restaurant_id = body["id"]

    assert review_url("spice-lane", "12").endswith("/r/spice-lane?t=12")
    svg = client.get(
        f"/api/admin/restaurants/{restaurant_id}/qr",
        headers=headers,
        params={"format": "svg", "table": "12"},
    )
    assert svg.status_code == 200
    assert "image/svg" in svg.headers["content-type"]
    assert b"<svg" in svg.content.lower() or b"svg" in svg.content.lower()

    png = client.get(f"/api/admin/restaurants/{restaurant_id}/qr", headers=headers, params={"format": "png"})
    assert png.status_code == 200
    assert png.headers["content-type"] == "image/png"
    assert png.content[:8] == b"\x89PNG\r\n\x1a\n"

    owner_token = _login(client, "owner@spice.test", "owner-pass-1")
    denied = client.post(
        "/api/admin/restaurants",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"name": "Nope", "google_place_id": "ChIJNope"},
    )
    assert denied.status_code == 403


def test_owner_metrics_scoped_by_restaurant(client: TestClient, db: Session) -> None:
    from app.models import Event, Restaurant
    from app.event_types import SCAN
    from datetime import UTC, datetime

    demo = db.query(Restaurant).filter(Restaurant.slug == TEST_SLUG).one()
    _user(db, email="owner@demo.test", password="owner-pass-1", role="owner", restaurant_id=demo.id)
    other = Restaurant(slug="other-cafe", name="Other", google_place_id="ChIJOther")
    db.add(other)
    db.flush()
    db.add(Event(restaurant_id=other.id, type=SCAN, ts=datetime.now(UTC)))
    db.commit()

    token = _login(client, "owner@demo.test", "owner-pass-1")
    mine = client.get("/api/owner/metrics", headers={"Authorization": f"Bearer {token}"})
    assert mine.status_code == 200
    data = mine.json()
    assert data["restaurant_id"] == demo.id
    assert data["funnel"]["scans"] == 0

    other_q = client.get(
        "/api/owner/metrics",
        headers={"Authorization": f"Bearer {token}"},
        params={"restaurant_id": other.id},
    )
    assert other_q.status_code == 403
    assert other_q.json()["detail"]["code"] == "SCOPE_DENIED"
