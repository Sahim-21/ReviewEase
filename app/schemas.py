from pydantic import BaseModel, Field, field_validator

from app.sanitize import strip_html


def _clean_optional(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = strip_html(value)
    return cleaned or None


class HealthResponse(BaseModel):
    status: str
    database: str


class RestaurantCreate(BaseModel):
    slug: str
    name: str
    google_place_id: str
    brand_color: str | None = None
    logo_url: str | None = None
    default_lang: str = "en"

    @field_validator("slug", "name", "google_place_id", "default_lang")
    @classmethod
    def clean_required(cls, value: str) -> str:
        cleaned = strip_html(value)
        if not cleaned:
            raise ValueError("field cannot be empty")
        return cleaned

    @field_validator("brand_color", "logo_url")
    @classmethod
    def clean_optional_url(cls, value: str | None) -> str | None:
        return _clean_optional(value)


class MenuItemCreate(BaseModel):
    name: str
    category: str | None = None
    active: bool = True

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        cleaned = strip_html(value)
        if not cleaned:
            raise ValueError("name is required")
        return cleaned

    @field_validator("category")
    @classmethod
    def clean_category(cls, value: str | None) -> str | None:
        return _clean_optional(value)


class TagCreate(BaseModel):
    label: str
    aspect: str = Field(pattern="^(food|service|ambience|value)$")

    @field_validator("label")
    @classmethod
    def clean_label(cls, value: str) -> str:
        cleaned = strip_html(value)
        if not cleaned:
            raise ValueError("label is required")
        return cleaned


class TableCreate(BaseModel):
    label: str

    @field_validator("label")
    @classmethod
    def clean_label(cls, value: str) -> str:
        cleaned = strip_html(value)
        if not cleaned:
            raise ValueError("label is required")
        return cleaned


class SessionCreate(BaseModel):
    restaurant_id: int
    device_hash: str
    table_id: int | None = None


class SessionDraftUpdate(BaseModel):
    items: list[object] | dict[str, object] | None = None
    ratings: dict[str, object] | None = None
    tags: list[object] | dict[str, object] | None = None
    raw_text: str | None = None
    tone: str | None = None
    out_lang: str | None = None
    draft_text: str | None = None
    llm_provider: str | None = None
    grounding_ok: bool | None = None


class SessionCompleteUpdate(BaseModel):
    final_text: str
    clicked_google: bool = False


class FeedbackCreate(BaseModel):
    restaurant_id: int
    message: str
    session_id: int | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    contact: str | None = None


class EventCreate(BaseModel):
    restaurant_id: int
    type: str
    session_id: int | None = None


class UserCreate(BaseModel):
    email: str
    password_hash: str
    role: str = Field(pattern="^(admin|owner)$")
    restaurant_id: int | None = None


class MenuItemPublic(BaseModel):
    id: int
    name: str
    category: str | None


class TagPublic(BaseModel):
    id: int
    label: str
    aspect: str


class RestaurantPublic(BaseModel):
    slug: str
    name: str
    google_place_id: str
    brand_color: str | None
    logo_url: str | None
    default_lang: str
    menu: list[MenuItemPublic]
    tags: list[TagPublic]


class SessionStartRequest(BaseModel):
    slug: str = Field(min_length=1, max_length=80)
    device_id: str = Field(min_length=8, max_length=256)
    table: str | None = Field(default=None, max_length=40)

    @field_validator("slug", "device_id")
    @classmethod
    def clean_start_required(cls, value: str) -> str:
        cleaned = strip_html(value)
        if not cleaned:
            raise ValueError("field cannot be empty")
        return cleaned

    @field_validator("table")
    @classmethod
    def clean_table(cls, value: str | None) -> str | None:
        return _clean_optional(value)


class SessionStartResponse(BaseModel):
    id: int
    token: str
    expires_in: int


class SessionCompleteRequest(BaseModel):
    final_text: str = Field(min_length=1, max_length=2000)
    clicked_google: bool = False
    copied: bool = False

    @field_validator("final_text")
    @classmethod
    def clean_final_text(cls, value: str) -> str:
        cleaned = strip_html(value)
        if not cleaned:
            raise ValueError("final_text is required")
        return cleaned


class SessionCompleteResponse(BaseModel):
    id: int
    final_text: str
    clicked_google: bool


class SessionDraftRequest(BaseModel):
    items: list[str] = Field(default_factory=list, max_length=20)
    ratings: dict[str, int] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list, max_length=20)
    raw_text: str = Field(default="", max_length=1000)
    tone: str = "casual"
    lang: str = Field(default="English", max_length=32)

    @field_validator("items")
    @classmethod
    def clean_items(cls, value: list[str]) -> list[str]:
        cleaned: list[str] = []
        for item in value:
            name = strip_html(item)
            if not name:
                continue
            if len(name) > 80:
                raise ValueError("item names must be 80 characters or fewer")
            cleaned.append(name)
        return cleaned

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, value: list[str]) -> list[str]:
        cleaned: list[str] = []
        for tag in value:
            label = strip_html(tag)
            if not label:
                continue
            if len(label) > 80:
                raise ValueError("tags must be 80 characters or fewer")
            cleaned.append(label)
        return cleaned

    @field_validator("raw_text")
    @classmethod
    def clean_raw_text(cls, value: str) -> str:
        return strip_html(value)

    @field_validator("ratings")
    @classmethod
    def clean_ratings(cls, value: dict[str, int]) -> dict[str, int]:
        allowed = {"food", "service", "ambience", "value"}
        cleaned: dict[str, int] = {}
        for aspect, score in value.items():
            key = aspect.strip().lower()
            if key not in allowed:
                raise ValueError("ratings keys must be food, service, ambience, or value")
            if int(score) < 1 or int(score) > 5:
                raise ValueError("ratings must be between 1 and 5")
            cleaned[key] = int(score)
        return cleaned


class SessionDraftResponse(BaseModel):
    id: int
    text: str
    provider: str
    grounding_ok: bool


class FeedbackRequest(BaseModel):
    slug: str = Field(min_length=1, max_length=80)
    message: str = Field(min_length=1, max_length=2000)
    rating: int | None = Field(default=None, ge=1, le=5)
    contact: str | None = Field(default=None, max_length=200)
    session_id: int | None = None

    @field_validator("message")
    @classmethod
    def clean_message(cls, value: str) -> str:
        cleaned = strip_html(value)
        if not cleaned:
            raise ValueError("message is required")
        return cleaned

    @field_validator("contact")
    @classmethod
    def clean_contact(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = strip_html(value)
        return cleaned or None


class FeedbackResponse(BaseModel):
    id: int
    submitted: bool = True


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def clean_email(cls, value: str) -> str:
        cleaned = strip_html(value).strip().lower()
        if not cleaned:
            raise ValueError("email is required")
        return cleaned


class AuthUser(BaseModel):
    email: str
    role: str
    restaurant_id: int | None = None
    token: str


class AdminRestaurantBody(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    google_place_id: str = Field(min_length=1, max_length=128)
    brand_color: str | None = Field(default=None, max_length=16)
    slug: str | None = Field(default=None, max_length=80)
    default_lang: str = "en"
    menu: list[MenuItemCreate] = Field(default_factory=list)
    tags: list[TagCreate] = Field(default_factory=list)
    tables: list[TableCreate] = Field(default_factory=list)
    owner_email: str | None = None
    owner_password: str | None = Field(default=None, min_length=8, max_length=128)

    @field_validator("name", "google_place_id", "default_lang")
    @classmethod
    def clean_admin_required(cls, value: str) -> str:
        cleaned = strip_html(value)
        if not cleaned:
            raise ValueError("field cannot be empty")
        return cleaned

    @field_validator("brand_color", "slug", "owner_email")
    @classmethod
    def clean_admin_optional(cls, value: str | None) -> str | None:
        return _clean_optional(value)


class RestaurantSummary(BaseModel):
    id: int
    slug: str
    name: str
    google_place_id: str
    brand_color: str | None


class FunnelCounts(BaseModel):
    scans: int
    started: int
    drafts: int
    copied: int
    opened_google: int


class DayCount(BaseModel):
    day: str
    scans: int
    drafts: int
    opened_google: int


class FeedbackItem(BaseModel):
    id: int
    message: str
    rating: int | None
    contact: str | None
    created_at: str


class OwnerMetrics(BaseModel):
    restaurant_id: int
    restaurant_name: str
    funnel: FunnelCounts
    daily: list[DayCount]
    feedback: list[FeedbackItem]
