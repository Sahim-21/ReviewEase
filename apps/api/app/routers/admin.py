from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.auth_deps import CurrentUser, require_admin
from app.db import get_db
from app.errors import ApiError
from app.passwords import hash_password
from app.qr import qr_png, qr_svg, review_url
from app.repositories import menu_items, restaurants, tables, tags, users as user_repo
from app.schemas import (
    AdminRestaurantBody,
    AdminRestaurantDetail,
    MenuItemCreate,
    MenuItemPublic,
    MenuItemsReplaceBody,
    RestaurantCreate,
    RestaurantDeletedResponse,
    RestaurantStatusBody,
    RestaurantStatusResponse,
    RestaurantSummary,
    TagCreate,
    TagPublic,
    TagsReplaceBody,
    UserCreate,
)
from app.slug import unique_slug

router = APIRouter(prefix="/api/admin")


@router.get("/restaurants", response_model=list[RestaurantSummary])
def list_restaurants(
    _: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[RestaurantSummary]:
    rows = restaurants.list_all(db)
    return [
        RestaurantSummary(
            id=row.id,
            slug=row.slug,
            name=row.name,
            google_place_id=row.google_place_id,
            brand_color=row.brand_color,
            active=row.active,
        )
        for row in rows
    ]


@router.post("/restaurants", response_model=RestaurantSummary)
def create_restaurant(
    body: AdminRestaurantBody,
    _: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> RestaurantSummary:
    slug = unique_slug(db, body.name, body.slug)
    restaurant = restaurants.create(
        db,
        RestaurantCreate(
            slug=slug,
            name=body.name.strip(),
            google_place_id=body.google_place_id.strip(),
            brand_color=body.brand_color,
            default_lang=body.default_lang,
        ),
    )
    if body.menu:
        menu_items.create_many(db, restaurant.id, body.menu)
    if body.tags:
        tags.create_many(db, restaurant.id, body.tags)
    if body.tables:
        for table in body.tables:
            tables.create(db, restaurant.id, table)
    if body.owner_email and body.owner_password:
        email = body.owner_email.strip().lower()
        if user_repo.get_by_email(db, email) is not None:
            raise ApiError(409, "EMAIL_TAKEN", "Owner email already exists")
        user_repo.create(
            db,
            UserCreate(
                email=email,
                password_hash=hash_password(body.owner_password),
                role="owner",
                restaurant_id=restaurant.id,
            ),
        )
    return RestaurantSummary(
        id=restaurant.id,
        slug=restaurant.slug,
        name=restaurant.name,
        google_place_id=restaurant.google_place_id,
        brand_color=restaurant.brand_color,
        active=restaurant.active,
    )


@router.get("/restaurants/{restaurant_id}", response_model=AdminRestaurantDetail)
def get_restaurant(
    restaurant_id: int,
    _: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminRestaurantDetail:
    restaurant = restaurants.get_by_id(db, restaurant_id)
    if restaurant is None:
        raise ApiError(404, "RESTAURANT_NOT_FOUND", "Restaurant not found")
    menu = menu_items.list_for_restaurant(db, restaurant.id, active_only=False)
    tag_rows = tags.list_for_restaurant(db, restaurant.id)
    created = restaurant.created_at.isoformat() if restaurant.created_at else ""
    return AdminRestaurantDetail(
        id=restaurant.id,
        slug=restaurant.slug,
        name=restaurant.name,
        google_place_id=restaurant.google_place_id,
        brand_color=restaurant.brand_color,
        created_at=created,
        active=restaurant.active,
        menu=[MenuItemPublic(id=item.id, name=item.name, category=item.category) for item in menu],
        tags=[TagPublic(id=tag.id, label=tag.label, aspect=tag.aspect) for tag in tag_rows],
    )


@router.get("/restaurants/{restaurant_id}/qr")
def restaurant_qr(
    restaurant_id: int,
    _: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
    format: Literal["svg", "png"] = Query(default="svg"),
    table: str | None = Query(default=None, max_length=40),
) -> Response:
    restaurant = restaurants.get_by_id(db, restaurant_id)
    if restaurant is None:
        raise ApiError(404, "RESTAURANT_NOT_FOUND", "Restaurant not found")
    url = review_url(restaurant.slug, table)
    if format == "png":
        return Response(
            content=qr_png(url, title=restaurant.name, table=table),
            media_type="image/png",
        )
    return Response(content=qr_svg(url), media_type="image/svg+xml")


def _require_restaurant(db: Session, restaurant_id: int):
    restaurant = restaurants.get_by_id(db, restaurant_id)
    if restaurant is None:
        raise ApiError(404, "RESTAURANT_NOT_FOUND", "Restaurant not found")
    return restaurant


@router.patch("/restaurants/{restaurant_id}/menu-items", response_model=list[MenuItemPublic])
def replace_menu_items(
    restaurant_id: int,
    body: MenuItemsReplaceBody,
    _: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[MenuItemPublic]:
    restaurant = _require_restaurant(db, restaurant_id)
    rows = menu_items.replace_for_restaurant(
        db,
        restaurant.id,
        [MenuItemCreate(name=item.name, category=item.category, active=True) for item in body.items],
    )
    return [MenuItemPublic(id=item.id, name=item.name, category=item.category) for item in rows]


@router.patch("/restaurants/{restaurant_id}/tags", response_model=list[TagPublic])
def replace_tags(
    restaurant_id: int,
    body: TagsReplaceBody,
    _: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[TagPublic]:
    restaurant = _require_restaurant(db, restaurant_id)
    rows = tags.replace_for_restaurant(
        db,
        restaurant.id,
        [TagCreate(label=tag.label, aspect=tag.aspect) for tag in body.tags],
    )
    return [TagPublic(id=tag.id, label=tag.label, aspect=tag.aspect) for tag in rows]


@router.patch("/restaurants/{restaurant_id}/status", response_model=RestaurantStatusResponse)
def set_restaurant_status(
    restaurant_id: int,
    body: RestaurantStatusBody,
    _: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> RestaurantStatusResponse:
    restaurant = _require_restaurant(db, restaurant_id)
    restaurants.set_active(db, restaurant, body.active)
    return RestaurantStatusResponse(id=restaurant.id, active=restaurant.active)


@router.delete("/restaurants/{restaurant_id}", response_model=RestaurantDeletedResponse)
def delete_restaurant(
    restaurant_id: int,
    _: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> RestaurantDeletedResponse:
    restaurant = _require_restaurant(db, restaurant_id)
    restaurants.delete_restaurant(db, restaurant)
    return RestaurantDeletedResponse(deleted=True)
