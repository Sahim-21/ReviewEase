"""Login throttling, cookie sessions, CSRF, password change/reset, rate limits, secrets, funnel."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app import limiter as limiter_module
from app.config import Settings
from app.models import DinerSession, Event, RateLimit, Restaurant
from app.passwords import hash_password, verify_password
from app.repositories import users
from app.schemas import UserCreate
from app.security import STAFF_COOKIE, check_production_secrets
from tests.conftest import TEST_SLUG

PASSWORD = "owner-pass-12345"


def _admin(db: Session, email: str = "boss@demo.test") -> None:
    users.create(db, UserCreate(email=email, password_hash=hash_password(PASSWORD), role="admin", restaurant_id=None))
    db.commit()


def _login(client: TestClient, email: str, password: str = PASSWORD, **headers: str):  # type: ignore[no-untyped-def]
    return client.post("/api/auth/login", json={"email": email, "password": password}, headers=headers)


# ── login throttling ──


def test_login_is_throttled_after_repeated_failures_even_with_the_right_password(client: TestClient, db: Session) -> None:
    _admin(db)
    for _ in range(limiter_module.LOGIN_FAIL_PER_EMAIL.limit):
        assert _login(client, "boss@demo.test", "wrong-password-1").status_code == 401
    blocked = _login(client, "boss@demo.test")
    assert blocked.status_code == 429
    assert blocked.json()["detail"]["code"] == "LOGIN_THROTTLED"
    # the counters are rows in the database, so they survive a restart
    assert db.query(RateLimit).filter(RateLimit.key.like("login-email:boss@demo.test:%")).count() == 1


def test_per_ip_throttle_covers_many_different_emails(client: TestClient, db: Session, monkeypatch) -> None:
    monkeypatch.setattr(limiter_module, "LOGIN_FAIL_PER_IP", limiter_module.Rule("login-ip", 3, 900))
    monkeypatch.setattr("app.routers.auth.LOGIN_FAIL_PER_IP", limiter_module.LOGIN_FAIL_PER_IP)
    for i in range(3):
        _login(client, f"nobody{i}@demo.test", "wrong-password-1", **{"X-Forwarded-For": "203.0.113.9"})
    assert _login(client, "other@demo.test", "wrong-password-1", **{"X-Forwarded-For": "203.0.113.9"}).status_code == 429
    assert _login(client, "other@demo.test", "wrong-password-1", **{"X-Forwarded-For": "198.51.100.1"}).status_code == 401


def test_successful_logins_are_not_counted(client: TestClient, db: Session) -> None:
    _admin(db)
    for _ in range(limiter_module.LOGIN_FAIL_PER_EMAIL.limit + 2):
        assert _login(client, "boss@demo.test").status_code == 200


# ── cookie session + CSRF ──


def test_login_sets_an_httponly_cookie_and_hides_the_token(client: TestClient, db: Session) -> None:
    _admin(db)
    response = _login(client, "boss@demo.test")
    assert response.status_code == 200
    assert "token" not in response.json()
    cookie = response.headers["set-cookie"]
    assert cookie.startswith(f"{STAFF_COOKIE}=")
    assert "HttpOnly" in cookie and "Secure" in cookie and "SameSite=lax" in cookie
    bearer = _login(client, "boss@demo.test", **{"X-Auth-Mode": "bearer"})
    assert bearer.json()["token"]


def test_cookie_authenticates_reads_and_csrf_header_guards_writes(client: TestClient, db: Session) -> None:
    _admin(db)
    token = _login(client, "boss@demo.test", **{"X-Auth-Mode": "bearer"}).json()["token"]
    client.cookies.clear()
    client.cookies.set(STAFF_COOKIE, token)
    assert client.get("/api/auth/me").status_code == 200
    restaurant_id = db.query(Restaurant).filter(Restaurant.slug == TEST_SLUG).one().id
    path = f"/api/admin/restaurants/{restaurant_id}/status"
    assert client.patch(path, json={"active": False}).status_code == 403
    ok = client.patch(path, json={"active": False}, headers={"X-Requested-With": "ReviewEase"})
    assert ok.status_code == 200


def test_logout_clears_the_cookie(client: TestClient, db: Session) -> None:
    _admin(db)
    _login(client, "boss@demo.test")
    response = client.post("/api/auth/logout")
    assert response.status_code == 200
    assert f"{STAFF_COOKIE}=" in response.headers["set-cookie"]
    assert "Max-Age=0" in response.headers["set-cookie"]


# ── password change / reset ──


def _bearer(client: TestClient, email: str) -> dict[str, str]:
    token = _login(client, email, **{"X-Auth-Mode": "bearer"}).json()["token"]
    return {"Authorization": f"Bearer {token}"}


def test_password_change_requires_the_current_password(client: TestClient, db: Session) -> None:
    _admin(db)
    headers = _bearer(client, "boss@demo.test")
    wrong = client.post("/api/auth/password", json={"current_password": "nope", "new_password": "brand-new-pass-1"}, headers=headers)
    assert wrong.status_code == 400
    short = client.post("/api/auth/password", json={"current_password": PASSWORD, "new_password": "short"}, headers=headers)
    assert short.status_code == 422
    ok = client.post("/api/auth/password", json={"current_password": PASSWORD, "new_password": "brand-new-pass-1"}, headers=headers)
    assert ok.status_code == 200
    assert _login(client, "boss@demo.test").status_code == 401
    assert _login(client, "boss@demo.test", "brand-new-pass-1").status_code == 200


def test_reset_password_command_updates_the_hash(db: Session, monkeypatch) -> None:
    from app import reset_password as reset_module

    _admin(db)

    class _Shared:
        def __getattr__(self, name: str):  # type: ignore[no-untyped-def]
            return getattr(db, name)

        def close(self) -> None:  # keep the test session open
            pass

    monkeypatch.setattr(reset_module, "SessionLocal", lambda: _Shared())
    monkeypatch.setenv("NEW_PASSWORD", "reset-pass-12345")
    assert reset_module.main(["Boss@Demo.test"]) == 0
    user = users.get_by_email(db, "boss@demo.test")
    assert user is not None and verify_password("reset-pass-12345", user.password_hash)
    assert reset_module.main(["missing@demo.test"]) == 1
    monkeypatch.setenv("NEW_PASSWORD", "short")
    assert reset_module.main(["boss@demo.test"]) == 1


# ── diner-side limits ──


def _start(client: TestClient, device: str = "device-1", **headers: str):  # type: ignore[no-untyped-def]
    return client.post("/api/sessions", json={"slug": TEST_SLUG, "device_id": device}, headers=headers)


def test_paused_restaurant_rejects_new_sessions(client: TestClient, db: Session) -> None:
    restaurant = db.query(Restaurant).filter(Restaurant.slug == TEST_SLUG).one()
    restaurant.active = False
    db.commit()
    response = _start(client)
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "RESTAURANT_PAUSED"


def test_session_creation_is_rate_limited_per_device(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr("app.routers.sessions.SESSION_PER_DEVICE", limiter_module.Rule("session-device", 2, 3600))
    assert _start(client, "device-x").status_code == 200
    assert _start(client, "device-x").status_code == 200
    third = _start(client, "device-x")
    assert third.status_code == 429
    assert _start(client, "device-y").status_code == 200


def test_feedback_is_rate_limited_per_ip(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr("app.routers.feedback.FEEDBACK_PER_IP", limiter_module.Rule("feedback-ip", 2, 3600))
    body = {"slug": TEST_SLUG, "message": "Lovely place"}
    headers = {"X-Forwarded-For": "192.0.2.4"}
    assert client.post("/api/feedback", json=body, headers=headers).status_code == 200
    assert client.post("/api/feedback", json=body, headers=headers).status_code == 200
    assert client.post("/api/feedback", json=body, headers=headers).status_code == 429


def test_draft_limit_is_persisted_and_reported(client: TestClient, db: Session) -> None:
    started = _start(client).json()
    headers = {"Authorization": f"Bearer {started['token']}"}
    body = {"items": ["Butter chicken"], "overall_rating": 4}
    lefts = []
    for _ in range(limiter_module.SESSION_DRAFT_LIMIT):
        response = client.post(f"/api/sessions/{started['id']}/draft", json=body, headers=headers)
        assert response.status_code == 200
        lefts.append(response.json()["drafts_left"])
    assert lefts == [4, 3, 2, 1, 0]
    assert client.post(f"/api/sessions/{started['id']}/draft", json=body, headers=headers).status_code == 429
    assert db.query(RateLimit).filter(RateLimit.key.like("draft-session:%")).count() == 1


# ── funnel steps + admin overview ──


def test_steps_are_recorded_once_and_feed_the_funnel(client: TestClient, db: Session) -> None:
    owner_email = "owner@funnel.test"
    restaurant = db.query(Restaurant).filter(Restaurant.slug == TEST_SLUG).one()
    users.create(db, UserCreate(email=owner_email, password_hash=hash_password(PASSWORD), role="owner", restaurant_id=restaurant.id))
    db.commit()
    first = _start(client, "device-0001").json()
    second = _start(client, "device-0002").json()
    _start(client, "device-0003")
    for started, steps in ((first, ["stars", "stars", "notes"]), (second, ["stars"])):
        for step in steps:
            response = client.post(
                f"/api/sessions/{started['id']}/step",
                json={"step": step},
                headers={"Authorization": f"Bearer {started['token']}"},
            )
            assert response.status_code == 200
    bad = client.post(f"/api/sessions/{first['id']}/step", json={"step": "hack"}, headers={"Authorization": f"Bearer {first['token']}"})
    assert bad.status_code == 422
    assert db.query(Event).filter(Event.session_id == first["id"], Event.type == "step_stars").count() == 1

    funnel = client.get("/api/owner/metrics", headers=_bearer(client, owner_email)).json()["funnel"]
    assert (funnel["scans"], funnel["started"], funnel["rated"]) == (3, 2, 1)


def test_admin_overview_returns_details_and_stats_in_one_call(client: TestClient, db: Session) -> None:
    _admin(db)
    restaurant = db.query(Restaurant).filter(Restaurant.slug == TEST_SLUG).one()
    db.add(DinerSession(restaurant_id=restaurant.id, device_hash="h", overall_rating=4))
    db.add(DinerSession(restaurant_id=restaurant.id, device_hash="h", overall_rating=5))
    db.commit()
    _start(client, "device-0009")
    data = client.get("/api/admin/overview", headers=_bearer(client, "boss@demo.test")).json()
    assert len(data) == 1
    item = data[0]
    assert item["detail"]["slug"] == TEST_SLUG
    assert item["detail"]["menu"]
    assert item["stats"]["scans"] == 1
    assert item["stats"]["average_stars"] == 4.5


# ── production secrets ──


@pytest.mark.parametrize("secret", ["change-me", "", "change-me-in-local-dev-32b-min", "short-but-random"])
def test_weak_secrets_are_refused_against_a_real_database(secret: str) -> None:
    config = Settings(database_url="postgresql+psycopg2://u:p@ep-cool-123.neon.tech/db", jwt_secret=secret)
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        check_production_secrets(config)


def test_strong_secret_and_local_databases_are_allowed() -> None:
    check_production_secrets(
        Settings(database_url="postgresql+psycopg2://u:p@ep-cool-123.neon.tech/db", jwt_secret="x" * 40, device_hash_salt="s")
    )
    check_production_secrets(Settings(database_url="postgresql+psycopg2://u:p@localhost:5432/db", jwt_secret="change-me"))
    check_production_secrets(Settings(database_url="sqlite://", jwt_secret=""))


# ── LLM chain ──


def test_chain_accepts_extra_models(monkeypatch) -> None:
    from app.config import settings
    from app.llm.chain import build_providers

    monkeypatch.setattr(settings, "llm_chain", "groq, groq:openai/gpt-oss-20b, gemini")
    providers = build_providers()
    assert [p.name for p in providers] == ["groq", "groq:openai/gpt-oss-20b", "gemini"]
