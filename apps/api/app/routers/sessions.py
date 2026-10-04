from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import require_session
from app.draft_validate import prepare_draft_input
from app.errors import ApiError
from app.event_types import COMPLETE, COPY, GENERATE, OPEN_GOOGLE, SCAN
from app.hashing import hash_device_id
from app.limiter import limiter
from app.llm.gateway import draft_review
from app.llm.schemas import DraftInput
from app.models import DinerSession
from app.repositories import events, menu_items, restaurants, sessions as session_repo, tables, tags
from app.schemas import (
    EventCreate,
    SessionCompleteRequest,
    SessionCompleteResponse,
    SessionCompleteUpdate,
    SessionCreate,
    SessionDraftRequest,
    SessionDraftResponse,
    SessionDraftUpdate,
    SessionStartRequest,
    SessionStartResponse,
)
from app.tokens import create_session_token

router = APIRouter(prefix="/api")


@router.post("/sessions", response_model=SessionStartResponse)
def start_session(body: SessionStartRequest, db: Session = Depends(get_db)) -> SessionStartResponse:
    restaurant = restaurants.get_by_slug(db, body.slug)
    if restaurant is None:
        raise ApiError(404, "RESTAURANT_NOT_FOUND", "Restaurant not found")
    table_id = None
    if body.table:
        table = tables.get_by_label(db, restaurant.id, body.table)
        table_id = table.id if table else None
    session = session_repo.create(
        db,
        SessionCreate(
            restaurant_id=restaurant.id,
            table_id=table_id,
            device_hash=hash_device_id(body.device_id),
        ),
    )
    events.create(
        db,
        EventCreate(restaurant_id=restaurant.id, session_id=session.id, type=SCAN),
    )
    token = create_session_token(session.id, restaurant.id)
    return SessionStartResponse(
        id=session.id,
        token=token,
        expires_in=settings.session_token_minutes * 60,
    )


@router.post("/sessions/{id}/draft", response_model=SessionDraftResponse)
async def create_draft(
    body: SessionDraftRequest,
    session: DinerSession = Depends(require_session),
    db: Session = Depends(get_db),
) -> SessionDraftResponse:
    menu = menu_items.list_for_restaurant(db, session.restaurant_id)
    bank = tags.list_for_restaurant(db, session.restaurant_id)
    tone, lang, item_names, tag_labels = prepare_draft_input(body, menu, bank)
    blocked = limiter.allow_draft(session.id, session.device_hash)
    if blocked == "RATE_LIMIT_SESSION":
        raise ApiError(429, "RATE_LIMIT_SESSION", "This session has used its 5 draft attempts")
    if blocked == "RATE_LIMIT_DEVICE":
        raise ApiError(429, "RATE_LIMIT_DEVICE", "This device has used its 20 drafts for today")
    recent = session_repo.list_recent_drafts(db, session.restaurant_id)
    draft = await draft_review(
        DraftInput(
            items=item_names,
            ratings=body.ratings,
            tags=tag_labels,
            raw_text=body.raw_text,
            tone=tone,  # type: ignore[arg-type]
            lang=lang,
            menu=[item.name for item in menu if item.active],
        ),
        recent_drafts=recent,
    )
    session_repo.update_draft(
        db,
        session,
        SessionDraftUpdate(
            items=item_names,
            ratings=body.ratings,
            tags=tag_labels,
            raw_text=body.raw_text,
            tone=tone,
            out_lang=lang,
            draft_text=draft.text,
            llm_provider=draft.provider,
            grounding_ok=draft.grounding_ok,
        ),
    )
    events.create(
        db,
        EventCreate(restaurant_id=session.restaurant_id, session_id=session.id, type=GENERATE),
    )
    return SessionDraftResponse(
        id=session.id,
        text=draft.text,
        provider=draft.provider,
        grounding_ok=draft.grounding_ok,
    )


@router.post("/sessions/{id}/complete", response_model=SessionCompleteResponse)
def complete_session(
    body: SessionCompleteRequest,
    session: DinerSession = Depends(require_session),
    db: Session = Depends(get_db),
) -> SessionCompleteResponse:
    session_repo.complete(
        db,
        session,
        SessionCompleteUpdate(final_text=body.final_text, clicked_google=body.clicked_google),
    )
    events.create(
        db,
        EventCreate(restaurant_id=session.restaurant_id, session_id=session.id, type=COMPLETE),
    )
    if body.copied:
        events.create(
            db,
            EventCreate(restaurant_id=session.restaurant_id, session_id=session.id, type=COPY),
        )
    if body.clicked_google:
        events.create(
            db,
            EventCreate(restaurant_id=session.restaurant_id, session_id=session.id, type=OPEN_GOOGLE),
        )
    return SessionCompleteResponse(
        id=session.id,
        final_text=session.final_text or body.final_text,
        clicked_google=session.clicked_google,
    )
