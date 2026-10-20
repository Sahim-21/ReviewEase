"""Request-level security helpers: client IP, startup secret checks and the staff auth cookie."""

from __future__ import annotations

import logging
from urllib.parse import urlparse

from fastapi import Request, Response

from app.config import Settings, settings

STAFF_COOKIE = "re_staff"
# Sent by our own frontend on state-changing staff requests. Browsers will not attach a custom
# header to a cross-site form post, so requiring it blocks CSRF against the cookie session.
CSRF_HEADER = "X-Requested-With"
CSRF_VALUE = "ReviewEase"

# Values that have shipped in this repo's examples or defaults: never acceptable in production.
_KNOWN_WEAK_SECRETS = frozenset({"", "change-me", "change-me-in-local-dev-32b-min", "secret", "changeme"})
_MIN_SECRET_LENGTH = 32

_log = logging.getLogger("app.security")


def client_ip(request: Request) -> str:
    """Caller IP. Render and Vercel put the real client first in X-Forwarded-For."""
    forwarded = request.headers.get("x-forwarded-for", "")
    first = forwarded.split(",")[0].strip()
    if first:
        return first
    return request.client.host if request.client else "unknown"


def _is_local_database(url: str) -> bool:
    if url.startswith("sqlite"):
        return True
    host = urlparse(url.replace("+psycopg2", "")).hostname or ""
    return host in {"localhost", "127.0.0.1", "::1", "db", "postgres"}


def check_production_secrets(config: Settings = settings) -> None:
    """Refuse to start against a real database with a default or short JWT secret.

    A missing JWT_SECRET used to fall back to "change-me", which lets anyone forge an admin token.
    Local and CI databases are exempt so tests and docker-compose keep working.
    """
    if _is_local_database(config.database_url):
        return
    secret = config.jwt_secret or ""
    if secret in _KNOWN_WEAK_SECRETS or len(secret) < _MIN_SECRET_LENGTH:
        raise RuntimeError(
            "JWT_SECRET is missing, a known default, or shorter than 32 characters. "
            "Set a long random JWT_SECRET (e.g. `python -c \"import secrets; print(secrets.token_urlsafe(48))\"`)."
        )
    if not config.device_hash_salt:
        _log.warning("DEVICE_HASH_SALT is empty; set it so device hashes do not depend on JWT_SECRET")


def set_staff_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        STAFF_COOKIE,
        token,
        max_age=settings.auth_token_minutes * 60,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )


def clear_staff_cookie(response: Response) -> None:
    response.delete_cookie(STAFF_COOKIE, path="/", secure=True, httponly=True, samesite="lax")
