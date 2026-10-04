from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import User
from app.schemas import UserCreate


def get_by_id(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def get_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email))


def create(db: Session, data: UserCreate) -> User:
    user = User(
        email=data.email,
        password_hash=data.password_hash,
        role=data.role,
        restaurant_id=data.restaurant_id,
    )
    db.add(user)
    db.flush()
    return user
