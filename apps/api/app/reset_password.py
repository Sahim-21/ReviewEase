"""Reset a staff password from the server shell (e.g. Render → Shell).

    python -m app.reset_password admin@example.com

Prompts for the new password (or reads NEW_PASSWORD from the environment) and stores only the
pbkdf2 hash. Use this when a password is forgotten; logged-in staff can change their own
password from the dashboard instead.
"""

from __future__ import annotations

import getpass
import os
import sys

from app.db import SessionLocal
from app.passwords import hash_password
from app.repositories import users as user_repo

MIN_LENGTH = 10


def reset_password(email: str, new_password: str) -> bool:
    db = SessionLocal()
    try:
        user = user_repo.get_by_email(db, email.strip().lower())
        if user is None:
            return False
        user.password_hash = hash_password(new_password)
        db.commit()
        return True
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print("Usage: python -m app.reset_password <email>")
        return 2
    password = os.environ.get("NEW_PASSWORD") or getpass.getpass("New password: ")
    if len(password) < MIN_LENGTH:
        print(f"Password must be at least {MIN_LENGTH} characters.")
        return 1
    if not os.environ.get("NEW_PASSWORD") and getpass.getpass("Repeat password: ") != password:
        print("Passwords do not match.")
        return 1
    if not reset_password(argv[0], password):
        print(f"No staff user with email {argv[0]}")
        return 1
    print(f"Password updated for {argv[0].strip().lower()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
