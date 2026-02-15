"""
Supabase implementation of the DatabaseService.

NOTE: This is currently a stub and will be fully implemented once we migrate the
optimized SQLite dataset to Supabase. It keeps the structure in place so other
parts of the application can already rely on the abstraction.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence

from .database_service import DatabaseService


class SupabaseDBService(DatabaseService):
    """Placeholder implementation for future Supabase migration."""

    def __init__(self) -> None:
        raise NotImplementedError(
            "SupabaseDBService is not implemented yet. "
            "Set DATABASE_SOURCE=local until the migration is complete."
        )

    def fetch_companies(
        self,
        where_clause: str = "",
        params: Optional[Sequence[Any]] = None,
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        raise NotImplementedError

    def fetch_company_financials(
        self,
        org_number: str,
        limit_years: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        raise NotImplementedError

    def fetch_company_metrics(self, org_number: str) -> Optional[Dict[str, Any]]:
        raise NotImplementedError

    def run_raw_query(
        self,
        sql: str,
        params: Optional[Sequence[Any]] = None,
    ) -> List[Dict[str, Any]]:
        raise NotImplementedError

