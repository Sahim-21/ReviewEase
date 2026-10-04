from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.logging import RequestLogMiddleware, configure_logging, cors_origins
from app.routers import admin, auth, feedback, health, owner, restaurants, sessions

configure_logging()

app = FastAPI(title="ReviewEase API", version="0.1.0")
app.add_middleware(RequestLogMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Session-Token", "X-Request-ID"],
)
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(restaurants.router)
app.include_router(sessions.router)
app.include_router(feedback.router)
app.include_router(admin.router)
app.include_router(owner.router)


@app.exception_handler(Exception)
async def unhandled_error_handler(_request: Request, _exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"detail": {"code": "INTERNAL", "message": "Something went wrong"}},
    )
