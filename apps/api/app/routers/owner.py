from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth_deps import CurrentUser, require_user, scoped_restaurant_id
from app.db import get_db
from app.errors import ApiError
from app.repositories.metrics import owner_metrics
from app.schemas import OwnerMetrics

router = APIRouter(prefix="/api/owner")


@router.get("/metrics", response_model=OwnerMetrics)
def metrics(
    restaurant_id: int | None = Query(default=None),
    user: CurrentUser = Depends(require_user),
    db: Session = Depends(get_db),
) -> OwnerMetrics:
    scoped = scoped_restaurant_id(user, restaurant_id)
    try:
        return owner_metrics(db, scoped)
    except ValueError:
        raise ApiError(404, "RESTAURANT_NOT_FOUND", "Restaurant not found") from None
