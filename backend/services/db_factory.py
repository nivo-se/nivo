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
    return os.getenv("DATABASE_SOURCE", "local").lower()  # type: ignore[return-value]


@lru_cache(maxsize=1)
def get_database_service() -> DatabaseService:
    """Return a singleton database service instance based on env var."""
    source = _get_source()

    if source == "local":
        from .local_db_service import LocalDBService

        return LocalDBService()

    if source == "supabase":
        raise ValueError(
            "Supabase backend (DATABASE_SOURCE=supabase) is not implemented. "
            "Use DATABASE_SOURCE=postgres with a Supabase connection string, or DATABASE_SOURCE=local."
        )

    if source == "postgres":
        from .postgres_db_service import PostgresDBService

        return PostgresDBService()

    raise ValueError(f"Unsupported DATABASE_SOURCE '{source}'")


def reset_database_service_cache() -> None:
    """Clear cached instance (useful for tests)."""
    get_database_service.cache_clear()  # type: ignore[attr-defined]

