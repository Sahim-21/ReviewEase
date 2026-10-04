from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.repositories import feedback as feedback_repo, restaurants, sessions as session_repo
from app.schemas import FeedbackCreate, FeedbackRequest, FeedbackResponse
from app.tokens import TokenError, decode_session_token

router = APIRouter(prefix="/api")


def _optional_bearer(authorization: str | None) -> str | None:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    return None


@router.post("/feedback", response_model=FeedbackResponse)
def submit_feedback(
    body: FeedbackRequest,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
    x_session_token: str | None = Header(default=None, alias="X-Session-Token"),
) -> FeedbackResponse:
    restaurant = restaurants.get_by_slug(db, body.slug)
    if restaurant is None:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    session_id = body.session_id
    if session_id is not None:
        token = _optional_bearer(authorization) or (x_session_token.strip() if x_session_token else None)
        if not token:
            raise HTTPException(status_code=401, detail="Session token required")
        try:
            payload = decode_session_token(token)
        except TokenError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc
        if payload["sid"] != session_id or payload["rid"] != restaurant.id:
            raise HTTPException(status_code=403, detail="Token does not match session")
        session = session_repo.get_by_id(db, session_id)
        if session is None or session.restaurant_id != restaurant.id:
            raise HTTPException(status_code=404, detail="Session not found")

    row = feedback_repo.create(
        db,
        FeedbackCreate(
            restaurant_id=restaurant.id,
            session_id=session_id,
            message=body.message,
            rating=body.rating,
            contact=body.contact,
        ),
    )
    return FeedbackResponse(id=row.id, submitted=True)
