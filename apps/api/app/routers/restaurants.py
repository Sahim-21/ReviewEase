from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.repositories import menu_items, restaurants, tags
from app.schemas import MenuItemPublic, RestaurantPublic, TagPublic

router = APIRouter(prefix="/api")


@router.get("/r/{slug}", response_model=RestaurantPublic)
def get_restaurant(slug: str, db: Session = Depends(get_db)) -> RestaurantPublic:
    restaurant = restaurants.get_by_slug(db, slug)
    if restaurant is None:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    menu = menu_items.list_for_restaurant(db, restaurant.id, active_only=True)
    tag_rows = tags.list_for_restaurant(db, restaurant.id)
    return RestaurantPublic(
        slug=restaurant.slug,
        name=restaurant.name,
        google_place_id=restaurant.google_place_id,
        brand_color=restaurant.brand_color,
        logo_url=restaurant.logo_url,
        default_lang=restaurant.default_lang,
        menu=[MenuItemPublic(id=item.id, name=item.name, category=item.category) for item in menu],
        tags=[TagPublic(id=tag.id, label=tag.label, aspect=tag.aspect) for tag in tag_rows],
    )
