from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.auth_deps import CurrentUser, require_admin
from app.db import get_db
from app.errors import ApiError
from app.passwords import hash_password
from app.qr import qr_png, qr_svg, review_url
from app.repositories import menu_items, restaurants, tables, tags, users as user_repo
from app.schemas import AdminRestaurantBody, RestaurantCreate, RestaurantSummary, UserCreate
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
