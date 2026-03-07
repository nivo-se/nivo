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

    retrieval_provider: str = Field(
        default="auto",
        description="Search provider: auto|serpapi|tavily|none",
    )
    retrieval_max_results_per_query: int = Field(default=5, ge=1, le=20)
    retrieval_max_queries: int = Field(default=3, ge=1, le=10)
    retrieval_http_timeout_seconds: int = Field(default=20, ge=5, le=120)
    retrieval_chunk_size_chars: int = Field(default=1200, ge=200, le=6000)
    retrieval_chunk_overlap_chars: int = Field(default=200, ge=0, le=2000)
    retrieval_embedding_model: str = Field(default="text-embedding-3-small")

    serpapi_key: str | None = Field(default=None)
    tavily_api_key: str | None = Field(default=None)
    openai_api_key: str | None = Field(default=None)

    langgraph_enabled: bool = Field(default=True)


@lru_cache(maxsize=1)
def get_settings() -> AppSettings:
    return AppSettings()

