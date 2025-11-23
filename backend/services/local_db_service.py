from __future__ import annotations

import logging
import os
import sqlite3
from pathlib import Path
from threading import Lock
from typing import Any, Dict, List, Optional, Sequence

from .database_service import DatabaseService

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = PROJECT_ROOT / "data" / "nivo_optimized.db"


class LocalDBService(DatabaseService):
    """SQLite implementation backed by data/nivo_optimized.db."""

    def __init__(self, db_path: Optional[Path] = None) -> None:
        # Check environment variable first, then parameter, then default
        env_db_path = os.getenv("LOCAL_DB_PATH")
        if env_db_path:
            # If it's a relative path, resolve relative to project root
            db_path = Path(env_db_path)
            if not db_path.is_absolute():
                db_path = PROJECT_ROOT / db_path
        else:
            db_path = db_path or DEFAULT_DB_PATH
        
        self.db_path = Path(db_path)
        if not self.db_path.exists():
            raise FileNotFoundError(
                f"Local SQLite database not found: {self.db_path}. "
                "Run the optimization scripts to generate it."
            )
        self._lock = Lock()
        self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        logger.info("Connected to local DB at %s", self.db_path)

    def _execute(
        self,
        sql: str,
        params: Optional[Sequence[Any]] = None,
    ) -> List[Dict[str, Any]]:
        with self._lock:
            cursor = self._conn.execute(sql, params or [])
            self._conn.commit()  # Commit to persist updates
            rows = cursor.fetchall()
        return [dict(row) for row in rows]

    def fetch_companies(
        self,
        where_clause: str = "",
        params: Optional[Sequence[Any]] = None,
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        sql = "SELECT * FROM companies"
        if where_clause:
            sql += f" WHERE {where_clause}"
        sql += " ORDER BY company_name ASC"
        if limit is not None:
            sql += " LIMIT ?"
            params = list(params or []) + [limit]
            if offset:
                sql += " OFFSET ?"
                params.append(offset)
        elif offset:
            # OFFSET requires LIMIT in SQLite, so we set a large limit
            sql += " LIMIT -1 OFFSET ?"
            params = list(params or []) + [offset]
        return self._execute(sql, params)

    def fetch_company_financials(
        self,
        org_number: str,
        limit_years: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        sql = (
            "SELECT * FROM financials "
            "WHERE orgnr = ? "
            "ORDER BY CAST(year AS INTEGER) DESC, period DESC"
        )
        params: List[Any] = [org_number]
        if limit_years is not None:
            sql += " LIMIT ?"
            params.append(limit_years)
        return self._execute(sql, params)

    def fetch_company_metrics(self, org_number: str) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM company_kpis WHERE orgnr = ? LIMIT 1"
        rows = self._execute(sql, [org_number])
        return rows[0] if rows else None

    def run_raw_query(
        self,
        sql: str,
        params: Optional[Sequence[Any]] = None,
    ) -> List[Dict[str, Any]]:
        return self._execute(sql, params)

    def close(self) -> None:
        with self._lock:
            self._conn.close()

