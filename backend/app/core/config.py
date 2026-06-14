"""Application configuration via environment variables."""

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Placeholder shipped in .env.example — must never be used outside local debug.
_DEFAULT_SECRET_KEY = "change-me-to-a-random-secret"


class Settings(BaseSettings):
    """Settings loaded from environment variables / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── Database ────────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://sirius:changeme@db:5432/sirius27"

    # ── Redis ───────────────────────────────────────────────
    redis_url: str = "redis://redis:6379/0"

    # ── Redis Streams ───────────────────────────────────────
    stream_name: str = "jobs:stream"
    consumer_group: str = "worker-group"

    # ── App ─────────────────────────────────────────────────
    secret_key: str = _DEFAULT_SECRET_KEY
    debug: bool = False

    @model_validator(mode="after")
    def _forbid_default_secret_in_prod(self) -> "Settings":
        """Fail fast: never run with the placeholder secret outside debug."""
        if not self.debug and self.secret_key == _DEFAULT_SECRET_KEY:
            raise ValueError(
                "SECRET_KEY is set to the default placeholder. Set a strong "
                "SECRET_KEY in the environment (or enable DEBUG for local dev)."
            )
        return self

    # ── Auth / JWT ──────────────────────────────────────────
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24h

    # ── Bootstrap admin (created on startup if both are set) ─
    bootstrap_admin_email: str | None = None
    bootstrap_admin_password: str | None = None


settings = Settings()
