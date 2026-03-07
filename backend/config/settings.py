"""Application settings for Deep Research backend scaffold."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppSettings(BaseSettings):
    """Centralized environment-backed settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "Nivo Deep Research Backend"
    environment: str = Field(default="development")
    log_level: str = Field(default="INFO")

    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8000)
    reload: bool = Field(default=False)

    postgres_dsn: str = Field(
        default="postgresql://nivo:nivo@localhost:5433/nivo",
        description="Primary PostgreSQL DSN",
    )
    redis_url: str = Field(
        default="redis://localhost:6379/0",
        description="Primary Redis URL",
    )

    langgraph_enabled: bool = Field(default=True)


@lru_cache(maxsize=1)
def get_settings() -> AppSettings:
    return AppSettings()

