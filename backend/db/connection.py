"""PostgreSQL connection scaffolding for Deep Research."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import psycopg2

from backend.config.settings import AppSettings
from backend.db.session import _build_dsn


@dataclass(slots=True)
class DatabaseConnectionManager:
    """Simple PostgreSQL connection manager for startup checks."""

    settings: AppSettings

    def connect(self):
        return psycopg2.connect(_build_dsn(), connect_timeout=5)

    def ping(self) -> tuple[bool, Optional[str]]:
        try:
            with self.connect() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("SELECT 1")
                    cursor.fetchone()
            return True, None
        except Exception as exc:  # pragma: no cover - defensive runtime check
            return False, str(exc)

