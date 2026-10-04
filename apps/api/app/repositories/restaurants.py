from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import (
    DiningTable,
    DinerSession,
    Event,
    MenuItem,
    PrivateFeedback,
    Restaurant,
    TagBank,
    User,
)
from app.schemas import RestaurantCreate


def get_by_id(db: Session, restaurant_id: int) -> Restaurant | None:
    return db.get(Restaurant, restaurant_id)


def get_by_slug(db: Session, slug: str) -> Restaurant | None:
    return db.scalar(select(Restaurant).where(Restaurant.slug == slug))


def list_all(db: Session) -> list[Restaurant]:
    return list(db.scalars(select(Restaurant).order_by(Restaurant.id)).all())


def create(db: Session, data: RestaurantCreate) -> Restaurant:
    restaurant = Restaurant(
        slug=data.slug,
        name=data.name,
        google_place_id=data.google_place_id,
        brand_color=data.brand_color,
        logo_url=data.logo_url,
        default_lang=data.default_lang,
    )
    db.add(restaurant)
    db.flush()
    return restaurant


def set_active(db: Session, restaurant: Restaurant, active: bool) -> Restaurant:
    restaurant.active = active
    db.flush()
    return restaurant


def delete_restaurant(db: Session, restaurant: Restaurant) -> None:
    restaurant_id = restaurant.id
    db.execute(delete(Event).where(Event.restaurant_id == restaurant_id))
    db.execute(delete(PrivateFeedback).where(PrivateFeedback.restaurant_id == restaurant_id))
    db.execute(delete(DinerSession).where(DinerSession.restaurant_id == restaurant_id))
    db.execute(delete(DiningTable).where(DiningTable.restaurant_id == restaurant_id))
    db.execute(delete(MenuItem).where(MenuItem.restaurant_id == restaurant_id))
    db.execute(delete(TagBank).where(TagBank.restaurant_id == restaurant_id))
    db.execute(delete(User).where(User.restaurant_id == restaurant_id))
    db.delete(restaurant)
    db.flush()
