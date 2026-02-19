"""
Factory returning the configured DatabaseService implementation.

Usage:
    from backend.services.db_factory import get_database_service
    db = get_database_service()
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Literal

from .database_service import DatabaseService


DatabaseSource = Literal["local", "supabase", "postgres"]


def _get_source() -> DatabaseSource:
    return os.getenv("DATABASE_SOURCE", "postgres").lower()  # type: ignore[return-value]


@lru_cache(maxsize=1)
def get_database_service() -> DatabaseService:
    """Return a singleton database service instance based on env var."""
    source = _get_source()

    if source == "local":
        raise ValueError(
            "SQLite (DATABASE_SOURCE=local) is disabled. Use Postgres for local development.\n"
            "  1. Set DATABASE_SOURCE=postgres in .env\n"
            "  2. Run: docker compose up -d\n"
            "  3. Run: python scripts/bootstrap_postgres_schema.py && ./scripts/run_postgres_migrations.sh\n"
            "See docs/LOCAL_POSTGRES_SETUP.md"
        )

    if source == "supabase":
        raise ValueError(
            "Supabase backend (DATABASE_SOURCE=supabase) is not implemented. "
            "Use DATABASE_SOURCE=postgres with POSTGRES_* vars or SUPABASE_DB_URL."
        )

    if source == "postgres":
        from .postgres_db_service import PostgresDBService

        return PostgresDBService()

    raise ValueError(f"Unsupported DATABASE_SOURCE '{source}'")


def reset_database_service_cache() -> None:
    """Clear cached instance (useful for tests)."""
    get_database_service.cache_clear()  # type: ignore[attr-defined]
