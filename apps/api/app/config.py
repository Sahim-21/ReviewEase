from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg2://reviewease:reviewease@localhost:5432/reviewease"
    jwt_secret: str = "change-me"
    device_hash_salt: str = ""
    session_token_minutes: int = 120
    allowed_origin: str = "http://localhost:3000"
    llm_chain: str = "groq,gemini"
    groq_api_key: str = ""
    groq_model: str = "qwen/qwen3.8-27b"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash-lite"
    app_public_url: str = "http://localhost:3000"
    auth_token_minutes: int = 1440
    admin_email: str = ""
    admin_password: str = ""

    model_config = SettingsConfigDict(
        # Later files win. Prefer apps/api/.env over the repo-root .env so JWT_SECRET
        # does not silently switch when uvicorn is started from apps/api.
        env_file=("../../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
