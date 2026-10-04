from fastapi import Depends, Header, Path
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import ApiError
from app.models import DinerSession
from app.repositories import sessions as session_repo
from app.tokens import TokenError, decode_session_token


def _extract_token(
    authorization: str | None,
    x_session_token: str | None,
) -> str:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    if x_session_token:
        return x_session_token.strip()
    raise ApiError(401, "SESSION_TOKEN_REQUIRED", "Session token required")


def require_session(
    session_id: int = Path(..., alias="id"),
    authorization: str | None = Header(default=None),
    x_session_token: str | None = Header(default=None, alias="X-Session-Token"),
    db: Session = Depends(get_db),
) -> DinerSession:
    token = _extract_token(authorization, x_session_token)
    try:
        payload = decode_session_token(token)
    except TokenError as exc:
        raise ApiError(401, "SESSION_TOKEN_INVALID", str(exc)) from exc
    if payload["sid"] != session_id:
        raise ApiError(403, "SESSION_TOKEN_MISMATCH", "Token does not match session")
    session = session_repo.get_by_id(db, session_id)
    if session is None or session.restaurant_id != payload["rid"]:
        raise ApiError(404, "SESSION_NOT_FOUND", "Session not found")
    return session
