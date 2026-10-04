from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.db import get_db
from app.limiter import limiter
from app.main import app
from app.models import Base
from app.repositories import menu_items, restaurants, tables, tags
from app.schemas import MenuItemCreate, RestaurantCreate, TableCreate, TagCreate

TEST_SLUG = "demo-cafe"


@pytest.fixture(autouse=True)
def _jwt_secret() -> Generator[None, None, None]:
    previous = settings.jwt_secret
    settings.jwt_secret = "test-jwt-secret-value-32-bytes-ok"
    yield
    settings.jwt_secret = previous


@pytest.fixture(autouse=True)
def _reset_limiter() -> None:
    limiter.reset()


@pytest.fixture()
def db() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    with engine.begin() as conn:
        conn.execute(text("PRAGMA foreign_keys=ON"))
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSession()
    restaurant = restaurants.create(
        session,
        RestaurantCreate(
            slug=TEST_SLUG,
            name="Demo Cafe",
            google_place_id="ChIJDemoCafePlaceId000000000",
            brand_color="#C45C26",
        ),
    )
    menu_items.create_many(
        session,
        restaurant.id,
        [
            MenuItemCreate(name="Butter chicken", category="mains"),
            MenuItemCreate(name="Hidden special", category="mains", active=False),
        ],
    )
    tags.create_many(
        session,
        restaurant.id,
        [
            TagCreate(label="Flavourful", aspect="food"),
            TagCreate(label="Friendly", aspect="service"),
        ],
    )
    tables.create(session, restaurant.id, TableCreate(label="1"))
    session.commit()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
