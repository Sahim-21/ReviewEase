from app.config import settings
from app.db import SessionLocal
from app.passwords import hash_password
from app.repositories import users as user_repo
from app.schemas import UserCreate


def bootstrap_admin() -> None:
    email = settings.admin_email.strip().lower()
    password = settings.admin_password
    if not email or not password:
        print("Set ADMIN_EMAIL and ADMIN_PASSWORD in env to create the first admin.")
        return
    db = SessionLocal()
    try:
        existing = user_repo.get_by_email(db, email)
        if existing is not None:
            print(f"Admin already exists: {email}")
            return
        user_repo.create(
            db,
            UserCreate(email=email, password_hash=hash_password(password), role="admin", restaurant_id=None),
        )
        db.commit()
        print(f"Created admin {email}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    bootstrap_admin()
