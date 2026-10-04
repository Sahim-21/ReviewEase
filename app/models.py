from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.types import PortableJSON


class Base(DeclarativeBase):
    pass


class TagAspect(StrEnum):
    FOOD = "food"
    SERVICE = "service"
    AMBIENCE = "ambience"
    VALUE = "value"


class UserRole(StrEnum):
    ADMIN = "admin"
    OWNER = "owner"


class Restaurant(Base):
    __tablename__ = "restaurants"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    google_place_id: Mapped[str] = mapped_column(String(128))
    brand_color: Mapped[str | None] = mapped_column(String(16), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    default_lang: Mapped[str] = mapped_column(String(16), default="en")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    menu_items: Mapped[list["MenuItem"]] = relationship(back_populates="restaurant")
    tags: Mapped[list["TagBank"]] = relationship(back_populates="restaurant")
    tables: Mapped[list["DiningTable"]] = relationship(back_populates="restaurant")
    sessions: Mapped[list["DinerSession"]] = relationship(back_populates="restaurant")
    feedback: Mapped[list["PrivateFeedback"]] = relationship(back_populates="restaurant")
    events: Mapped[list["Event"]] = relationship(back_populates="restaurant")
    users: Mapped[list["User"]] = relationship(back_populates="restaurant")


class MenuItem(Base):
    __tablename__ = "menu_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str | None] = mapped_column(String(80), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    restaurant: Mapped[Restaurant] = relationship(back_populates="menu_items")


class TagBank(Base):
    __tablename__ = "tag_bank"
    __table_args__ = (
        CheckConstraint(
            "aspect IN ('food', 'service', 'ambience', 'value')",
            name="ck_tag_bank_aspect",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(80))
    aspect: Mapped[str] = mapped_column(String(32))

    restaurant: Mapped[Restaurant] = relationship(back_populates="tags")


class DiningTable(Base):
    __tablename__ = "tables"

    id: Mapped[int] = mapped_column(primary_key=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(40))

    restaurant: Mapped[Restaurant] = relationship(back_populates="tables")
    sessions: Mapped[list["DinerSession"]] = relationship(back_populates="table")


class DinerSession(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id"), index=True)
    table_id: Mapped[int | None] = mapped_column(ForeignKey("tables.id", ondelete="SET NULL"), nullable=True)
    device_hash: Mapped[str] = mapped_column(String(128))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    items: Mapped[Any | None] = mapped_column(PortableJSON, nullable=True)
    ratings: Mapped[Any | None] = mapped_column(PortableJSON, nullable=True)
    tags: Mapped[Any | None] = mapped_column(PortableJSON, nullable=True)
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    tone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    out_lang: Mapped[str | None] = mapped_column(String(16), nullable=True)
    draft_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    final_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    llm_provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    grounding_ok: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    clicked_google: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    restaurant: Mapped[Restaurant] = relationship(back_populates="sessions")
    table: Mapped[DiningTable | None] = relationship(back_populates="sessions")
    feedback: Mapped[list["PrivateFeedback"]] = relationship(back_populates="session")
    events: Mapped[list["Event"]] = relationship(back_populates="session")


class PrivateFeedback(Base):
    __tablename__ = "private_feedback"
    __table_args__ = (
        CheckConstraint("rating IS NULL OR (rating >= 1 AND rating <= 5)", name="ck_feedback_rating"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id"), index=True)
    session_id: Mapped[int | None] = mapped_column(
        ForeignKey("sessions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    message: Mapped[str] = mapped_column(Text)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    contact: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    restaurant: Mapped[Restaurant] = relationship(back_populates="feedback")
    session: Mapped[DinerSession | None] = relationship(back_populates="feedback")


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id"), index=True)
    session_id: Mapped[int | None] = mapped_column(
        ForeignKey("sessions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    type: Mapped[str] = mapped_column(String(40))
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    restaurant: Mapped[Restaurant] = relationship(back_populates="events")
    session: Mapped[DinerSession | None] = relationship(back_populates="events")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('admin', 'owner')", name="ck_users_role"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(32))
    restaurant_id: Mapped[int | None] = mapped_column(ForeignKey("restaurants.id"), nullable=True, index=True)

    restaurant: Mapped[Restaurant | None] = relationship(back_populates="users")
