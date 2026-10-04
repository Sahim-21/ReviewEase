from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth_deps import CurrentUser, require_user
from app.db import get_db
from app.errors import ApiError
from app.passwords import verify_password
from app.repositories import users as user_repo
from app.schemas import AuthUser, LoginRequest
from app.tokens import create_user_token

router = APIRouter(prefix="/api/auth")


@router.post("/login", response_model=AuthUser)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> AuthUser:
    user = user_repo.get_by_email(db, body.email.strip().lower())
    if user is None or not verify_password(body.password, user.password_hash):
        raise ApiError(401, "LOGIN_FAILED", "Email or password is wrong")
    token = create_user_token(user_id=user.id, role=user.role, restaurant_id=user.restaurant_id)
    return AuthUser(email=user.email, role=user.role, restaurant_id=user.restaurant_id, token=token)


@router.get("/me", response_model=AuthUser)
def me(user: CurrentUser = Depends(require_user)) -> AuthUser:
    token = create_user_token(user_id=user.id, role=user.role, restaurant_id=user.restaurant_id)
    return AuthUser(email=user.email, role=user.role, restaurant_id=user.restaurant_id, token=token)
