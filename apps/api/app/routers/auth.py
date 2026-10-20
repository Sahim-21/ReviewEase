from fastapi import APIRouter, Depends, Header, Request, Response
from sqlalchemy.orm import Session

from app.auth_deps import CurrentUser, require_user
from app.db import get_db
from app.errors import ApiError
from app.limiter import LOGIN_FAIL_PER_EMAIL, LOGIN_FAIL_PER_IP, limiter
from app.passwords import hash_password, verify_password
from app.repositories import users as user_repo
from app.schemas import AuthUser, LoginRequest, PasswordChangeRequest
from app.security import clear_staff_cookie, client_ip, set_staff_cookie
from app.tokens import create_user_token

router = APIRouter(prefix="/api/auth")

_TOO_MANY = "Too many sign-in attempts. Try again in 15 minutes."


def _auth_user(user: CurrentUser | object, token: str, auth_mode: str | None) -> AuthUser:
    # The web app keeps the token in an HttpOnly cookie, so it is only returned in the body
    # to API clients that ask for bearer auth explicitly.
    return AuthUser(
        email=user.email,  # type: ignore[attr-defined]
        role=user.role,  # type: ignore[attr-defined]
        restaurant_id=user.restaurant_id,  # type: ignore[attr-defined]
        token=token if (auth_mode or "").lower() == "bearer" else None,
    )


@router.post("/login", response_model=AuthUser, response_model_exclude_none=True)
def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    x_auth_mode: str | None = Header(default=None, alias="X-Auth-Mode"),
) -> AuthUser:
    ip = client_ip(request)
    email = body.email.strip().lower()
    if limiter.blocked(db, LOGIN_FAIL_PER_IP, ip) or limiter.blocked(db, LOGIN_FAIL_PER_EMAIL, email):
        raise ApiError(429, "LOGIN_THROTTLED", _TOO_MANY)
    user = user_repo.get_by_email(db, email)
    if user is None or not verify_password(body.password, user.password_hash):
        limiter.hit(db, LOGIN_FAIL_PER_IP, ip)
        limiter.hit(db, LOGIN_FAIL_PER_EMAIL, email)
        # Commit the failed-attempt counters even though this request fails.
        db.commit()
        raise ApiError(401, "LOGIN_FAILED", "Email or password is wrong")
    token = create_user_token(user_id=user.id, role=user.role, restaurant_id=user.restaurant_id)
    set_staff_cookie(response, token)
    return _auth_user(user, token, x_auth_mode)


@router.get("/me", response_model=AuthUser, response_model_exclude_none=True)
def me(
    response: Response,
    user: CurrentUser = Depends(require_user),
    x_auth_mode: str | None = Header(default=None, alias="X-Auth-Mode"),
) -> AuthUser:
    token = create_user_token(user_id=user.id, role=user.role, restaurant_id=user.restaurant_id)
    set_staff_cookie(response, token)  # sliding expiry
    return _auth_user(user, token, x_auth_mode)


@router.post("/logout")
def logout(response: Response) -> dict[str, bool]:
    clear_staff_cookie(response)
    return {"signed_out": True}


@router.post("/password")
def change_password(
    body: PasswordChangeRequest,
    request: Request,
    user: CurrentUser = Depends(require_user),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    row = user_repo.get_by_id(db, user.id)
    if row is None:
        raise ApiError(401, "AUTH_INVALID", "User not found")
    ip = client_ip(request)
    if limiter.blocked(db, LOGIN_FAIL_PER_IP, ip):
        raise ApiError(429, "LOGIN_THROTTLED", _TOO_MANY)
    if not verify_password(body.current_password, row.password_hash):
        limiter.hit(db, LOGIN_FAIL_PER_IP, ip)
        db.commit()
        raise ApiError(400, "PASSWORD_WRONG", "Current password is wrong")
    if body.new_password == body.current_password:
        raise ApiError(400, "PASSWORD_UNCHANGED", "Choose a different password")
    row.password_hash = hash_password(body.new_password)
    db.flush()
    return {"changed": True}
