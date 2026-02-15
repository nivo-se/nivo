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

    def table_exists(self, table_name: str) -> bool:
        """Check if a table exists. Implement in backend."""
        raise NotImplementedError("table_exists must be implemented")

    def fetch_ai_profiles(self, orgnrs: List[str]) -> List[Dict[str, Any]]:
        """Fetch ai_profiles for given orgnrs. Returns list of profile dicts."""
        raise NotImplementedError("fetch_ai_profiles must be implemented")

    def upsert_ai_profile(self, profile: Dict[str, Any]) -> None:
        """Insert or update an ai_profile row."""
        raise NotImplementedError("upsert_ai_profile must be implemented")

    def fetch_company_enrichment(
        self,
        orgnrs: List[str],
        kinds: Optional[List[str]] = None,
        latest_run_only: bool = True,
    ) -> Dict[str, Dict[str, Dict[str, Any]]]:
        """
        Fetch company_enrichment rows for given orgnrs.
        Returns dict: { orgnr: { kind: { run_id, created_at, result, score, tags } } }
        result is parsed JSONB as dict.
        """
        raise NotImplementedError("fetch_company_enrichment must be implemented")

    def fetch_company_enrichment_single(
        self,
        orgnr: str,
        kinds: Optional[List[str]] = None,
        latest_run_only: bool = True,
    ) -> Dict[str, Dict[str, Any]]:
        """
        Fetch company_enrichment for a single orgnr.
        Returns dict: { kind: { run_id, created_at, result, score, tags } }
        """
        out = self.fetch_company_enrichment([orgnr], kinds=kinds, latest_run_only=latest_run_only)
        return out.get(orgnr, {})

    def fetch_latest_enrichment_run(self) -> Optional[Dict[str, Any]]:
        """Fetch the most recent enrichment_runs row, or None."""
        raise NotImplementedError("fetch_latest_enrichment_run must be implemented")

    def create_enrichment_run(
        self,
        source: str,
        model: Optional[str] = None,
        provider: Optional[str] = None,
        prompt_version: Optional[str] = None,
        meta: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        """
        Create an enrichment_runs row. Returns run_id (UUID string) or None if tables don't exist.
        """
        raise NotImplementedError("create_enrichment_run must be implemented")

    def upsert_company_enrichment(
        self,
        orgnr: str,
        run_id: str,
        kind: str,
        result: Dict[str, Any],
        score: Optional[float] = None,
        tags: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Insert or update company_enrichment row. Requires run_id (never overwrite without run context).
        """
        raise NotImplementedError("upsert_company_enrichment must be implemented")

    def update_enrichment_run_meta(
        self,
        run_id: str,
        failures: List[Dict[str, Any]],
    ) -> None:
        """
        Merge failures into enrichment_runs.meta for run_id. No-op if table doesn't exist.
        """
        pass  # optional; postgres + local implement

    def close(self) -> None:
        """Optional hook for backends that hold connections."""
        return None

