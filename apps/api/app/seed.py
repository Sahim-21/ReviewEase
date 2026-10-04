from app.db import SessionLocal
from app.models import TagAspect
from app.repositories import menu_items, restaurants, tables, tags
from app.schemas import MenuItemCreate, RestaurantCreate, TableCreate, TagCreate

DEMO_SLUG = "demo-cafe"

MENU_ITEMS = [
    MenuItemCreate(name="Butter chicken", category="mains"),
    MenuItemCreate(name="Palak paneer", category="mains"),
    MenuItemCreate(name="Dal tadka", category="mains"),
    MenuItemCreate(name="Chicken biryani", category="mains"),
    MenuItemCreate(name="Garlic naan", category="breads"),
    MenuItemCreate(name="Butter naan", category="breads"),
    MenuItemCreate(name="Cucumber raita", category="sides"),
    MenuItemCreate(name="Masala fries", category="sides"),
    MenuItemCreate(name="Masala chai", category="drinks"),
    MenuItemCreate(name="Mango lassi", category="drinks"),
    MenuItemCreate(name="Gulab jamun", category="desserts"),
    MenuItemCreate(name="Pistachio kulfi", category="desserts"),
]

TAGS = [
    TagCreate(label="Flavourful", aspect=TagAspect.FOOD),
    TagCreate(label="Spicy", aspect=TagAspect.FOOD),
    TagCreate(label="Fresh", aspect=TagAspect.FOOD),
    TagCreate(label="Generous portions", aspect=TagAspect.FOOD),
    TagCreate(label="Well cooked", aspect=TagAspect.FOOD),
    TagCreate(label="Attentive", aspect=TagAspect.SERVICE),
    TagCreate(label="Friendly", aspect=TagAspect.SERVICE),
    TagCreate(label="Prompt", aspect=TagAspect.SERVICE),
    TagCreate(label="Slow", aspect=TagAspect.SERVICE),
    TagCreate(label="Cozy", aspect=TagAspect.AMBIENCE),
    TagCreate(label="Clean", aspect=TagAspect.AMBIENCE),
    TagCreate(label="Noisy", aspect=TagAspect.AMBIENCE),
    TagCreate(label="Good music", aspect=TagAspect.AMBIENCE),
    TagCreate(label="Fair price", aspect=TagAspect.VALUE),
    TagCreate(label="Filling", aspect=TagAspect.VALUE),
]


def seed_demo_cafe() -> None:
    db = SessionLocal()
    try:
        existing = restaurants.get_by_slug(db, DEMO_SLUG)
        if existing is not None:
            print(f"Seed skipped: restaurant '{DEMO_SLUG}' already exists (id={existing.id}).")
            return

        restaurant = restaurants.create(
            db,
            RestaurantCreate(
                slug=DEMO_SLUG,
                name="Demo Cafe",
                google_place_id="ChIJDemoCafePlaceId000000000",
                brand_color="#C45C26",
                default_lang="en",
            ),
        )
        menu_items.create_many(db, restaurant.id, MENU_ITEMS)
        tags.create_many(db, restaurant.id, TAGS)
        tables.create(db, restaurant.id, TableCreate(label="1"))
        db.commit()
        print(
            f"Seeded {DEMO_SLUG}: {len(MENU_ITEMS)} menu items, {len(TAGS)} tags, 1 table."
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_cafe()
