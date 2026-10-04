from datetime import UTC, datetime, timedelta

import jwt
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError

from app.config import settings


class TokenError(Exception):
    pass


def create_session_token(session_id: int, restaurant_id: int) -> str:
    expires = datetime.now(UTC) + timedelta(minutes=settings.session_token_minutes)
    payload = {
        "typ": "session",
        "sid": session_id,
        "rid": restaurant_id,
        "exp": expires,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_session_token(token: str) -> dict[str, int]:
    payload = _decode(token)
    if payload.get("typ") not in (None, "session"):
        raise TokenError("Invalid session token")
    try:
        return {"sid": int(payload["sid"]), "rid": int(payload["rid"])}
    except (KeyError, TypeError, ValueError) as exc:
        raise TokenError("Invalid session token") from exc


def create_user_token(*, user_id: int, role: str, restaurant_id: int | None) -> str:
    expires = datetime.now(UTC) + timedelta(minutes=settings.auth_token_minutes)
    payload = {
        "typ": "user",
        "sub": str(user_id),
        "role": role,
        "rid": restaurant_id,
        "exp": expires,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_user_token(token: str) -> dict[str, object]:
    payload = _decode(token)
    if payload.get("typ") != "user":
        raise TokenError("Invalid auth token")
    try:
        rid = payload.get("rid")
        return {
            "sub": int(payload["sub"]),
            "role": str(payload["role"]),
            "rid": int(rid) if rid is not None else None,
        }
    except (KeyError, TypeError, ValueError) as exc:
        raise TokenError("Invalid auth token") from exc


def _decode(token: str) -> dict[str, object]:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except ExpiredSignatureError as exc:
        raise TokenError("Token expired") from exc
    except InvalidTokenError as exc:
        raise TokenError("Invalid token") from exc
    if not isinstance(payload, dict):
        raise TokenError("Invalid token")
    return payload
