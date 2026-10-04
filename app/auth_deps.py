from dataclasses import dataclass

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import ApiError
from app.repositories import users as user_repo
from app.tokens import TokenError, decode_user_token


@dataclass
class CurrentUser:
    id: int
    email: str
    role: str
    restaurant_id: int | None


def _bearer(authorization: str | None) -> str:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    raise ApiError(401, "AUTH_REQUIRED", "Sign in required")


def require_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> CurrentUser:
    try:
        payload = decode_user_token(_bearer(authorization))
    except TokenError as exc:
        raise ApiError(401, "AUTH_INVALID", str(exc)) from exc
    user = user_repo.get_by_id(db, int(payload["sub"]))  # type: ignore[arg-type]
    if user is None:
        raise ApiError(401, "AUTH_INVALID", "User not found")
    return CurrentUser(
        id=user.id,
        email=user.email,
        role=user.role,
        restaurant_id=user.restaurant_id,
    )


def require_admin(user: CurrentUser = Depends(require_user)) -> CurrentUser:
    if user.role != "admin":
        raise ApiError(403, "ADMIN_REQUIRED", "Admin role required")
    return user


def scoped_restaurant_id(user: CurrentUser, requested: int | None) -> int:
    if user.role == "admin":
        if requested is None:
            raise ApiError(400, "RESTAURANT_REQUIRED", "restaurant_id is required")
        return requested
    if user.role == "owner":
        if user.restaurant_id is None:
            raise ApiError(403, "NO_RESTAURANT", "Owner has no restaurant")
        if requested is not None and requested != user.restaurant_id:
            raise ApiError(403, "SCOPE_DENIED", "Cannot query another restaurant")
        return user.restaurant_id
    raise ApiError(403, "FORBIDDEN", "Not allowed")
