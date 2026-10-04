from fastapi import APIRouter
from sqlalchemy import text

from app.db import engine
from app.schemas import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    db_status = "ok"
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        db_status = "unavailable"
    return HealthResponse(status="ok", database=db_status)
