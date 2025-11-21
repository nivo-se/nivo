"""
Abstract database service used by the AI sourcing backend.

The goal is to decouple business logic (AI filter, enrichment, exports) from the
physical storage layer so we can start with a local SQLite database and later
switch to Supabase/Postgres without touching the higher level code.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Sequence


class DatabaseService(ABC):
    """Base interface implemented by all database backends."""

    @abstractmethod
    def fetch_companies(
        self,
        where_clause: str = "",
        params: Optional[Sequence[Any]] = None,
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """Return companies matching the provided WHERE clause."""

    @abstractmethod
    def fetch_company_financials(
        self,
        org_number: str,
        limit_years: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """Return flat financial statements for a company ordered by year desc."""

    @abstractmethod
    def fetch_company_metrics(self, org_number: str) -> Optional[Dict[str, Any]]:
        """Return KPI/metric snapshot for a company if available."""

    @abstractmethod
    def run_raw_query(
        self,
        sql: str,
        params: Optional[Sequence[Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Execute a raw SQL query (used for advanced analytics)."""

    def close(self) -> None:
        """Optional hook for backends that hold connections."""
        return None

