from __future__ import annotations

import json
import logging
import uuid
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

    def table_exists(self, table_name: str) -> bool:
        rows = self._execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            [table_name],
        )
        return len(rows) > 0

    def fetch_ai_profiles(self, orgnrs: List[str]) -> List[Dict[str, Any]]:
        if not orgnrs:
            return []
        if not self.table_exists("ai_profiles"):
            return []
        placeholders = ",".join("?" * len(orgnrs))
        sql = f"""
            SELECT org_number, website, product_description, end_market, customer_types,
                   strategic_fit_score, defensibility_score, value_chain_position, ai_notes,
                   business_model_summary, business_summary, industry_sector, industry_subsector,
                   market_regions, risk_flags, next_steps, industry_keywords, acquisition_angle,
                   upside_potential, fit_rationale, strategic_playbook, agent_type, scraped_pages,
                   last_updated, date_scraped
            FROM ai_profiles
            WHERE org_number IN ({placeholders})
        """
        return self._execute(sql, orgnrs)

    def upsert_ai_profile(self, profile: Dict[str, Any]) -> None:
        if not self.table_exists("ai_profiles"):
            self._execute("""
                CREATE TABLE IF NOT EXISTS ai_profiles (
                    org_number TEXT PRIMARY KEY, website TEXT, product_description TEXT,
                    end_market TEXT, customer_types TEXT, strategic_fit_score INTEGER,
                    defensibility_score INTEGER, value_chain_position TEXT, ai_notes TEXT,
                    industry_sector TEXT, industry_subsector TEXT, market_regions TEXT,
                    business_model_summary TEXT, business_summary TEXT, risk_flags TEXT,
                    industry_keywords TEXT, upside_potential TEXT, strategic_playbook TEXT,
                    next_steps TEXT, acquisition_angle TEXT, agent_type TEXT, scraped_pages TEXT,
                    fit_rationale TEXT, enrichment_status TEXT DEFAULT 'complete',
                    last_updated TEXT, date_scraped TEXT
                )
            """)
        vals = [
            profile["org_number"],
            profile.get("website"),
            profile.get("product_description"),
            profile.get("end_market"),
            profile.get("customer_types"),
            profile.get("strategic_fit_score"),
            profile.get("defensibility_score"),
            profile.get("value_chain_position"),
            profile.get("ai_notes"),
            profile.get("industry_sector"),
            profile.get("industry_subsector"),
            str(profile.get("market_regions")) if profile.get("market_regions") else None,
            profile.get("business_model_summary"),
            profile.get("business_summary"),
            str(profile.get("risk_flags")) if profile.get("risk_flags") else None,
            str(profile.get("industry_keywords")) if profile.get("industry_keywords") else None,
            profile.get("upside_potential"),
            profile.get("strategic_playbook"),
            str(profile.get("next_steps")) if profile.get("next_steps") else None,
            profile.get("acquisition_angle"),
            profile.get("agent_type"),
            str(profile.get("scraped_pages")) if profile.get("scraped_pages") else None,
            profile.get("fit_rationale"),
            profile.get("enrichment_status", "complete"),
            profile.get("last_updated"),
            profile.get("date_scraped"),
        ]
        self._execute("""
            INSERT OR REPLACE INTO ai_profiles (
                org_number, website, product_description, end_market, customer_types,
                strategic_fit_score, defensibility_score, value_chain_position, ai_notes,
                industry_sector, industry_subsector, market_regions, business_model_summary,
                business_summary, risk_flags, industry_keywords, upside_potential, strategic_playbook,
                next_steps, acquisition_angle, agent_type, scraped_pages, fit_rationale,
                enrichment_status, last_updated, date_scraped
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, vals)

    def fetch_company_enrichment(
        self,
        orgnrs: List[str],
        kinds: Optional[List[str]] = None,
        latest_run_only: bool = True,
    ) -> Dict[str, Dict[str, Dict[str, Any]]]:
        if not orgnrs:
            return {}
        if not self.table_exists("company_enrichment"):
            return {}
        placeholders = ",".join("?" for _ in orgnrs)
        params: List[Any] = list(orgnrs)
        kind_filter = ""
        if kinds:
            kind_filter = " AND kind IN (" + ",".join("?" for _ in kinds) + ")"
            params.extend(kinds)
        sql = f"""
            SELECT ce.orgnr, ce.run_id, ce.kind, ce.result, ce.score, ce.tags, ce.created_at
            FROM company_enrichment ce
            INNER JOIN (
                SELECT orgnr, kind, MAX(created_at) as max_created
                FROM company_enrichment
                WHERE orgnr IN ({placeholders}){kind_filter}
                GROUP BY orgnr, kind
            ) latest ON ce.orgnr = latest.orgnr AND ce.kind = latest.kind AND ce.created_at = latest.max_created
            WHERE ce.orgnr IN ({placeholders}){kind_filter}
        """
        params.extend(orgnrs)
        if kinds:
            params.extend(kinds)
        rows = self._execute(sql, params)
        out: Dict[str, Dict[str, Dict[str, Any]]] = {}
        for r in rows:
            o = str(r.get("orgnr", ""))
            k = str(r.get("kind", ""))
            if o not in out:
                out[o] = {}
            res = r.get("result")
            if isinstance(res, str):
                try:
                    import json
                    res = json.loads(res)
                except Exception:
                    res = {"raw": res}
            out[o][k] = {
                "run_id": str(r["run_id"]) if r.get("run_id") else None,
                "created_at": r.get("created_at"),
                "result": res if isinstance(res, dict) else {"raw": res},
                "score": float(r["score"]) if r.get("score") is not None else None,
                "tags": r.get("tags"),
            }
        return out

    def fetch_latest_enrichment_run(self) -> Optional[Dict[str, Any]]:
        if not self.table_exists("enrichment_runs"):
            return None
        rows = self._execute(
            "SELECT id, created_at, source, model, provider, prompt_version, meta "
            "FROM enrichment_runs ORDER BY created_at DESC LIMIT 1"
        )
        return rows[0] if rows else None

    def create_enrichment_run(
        self,
        source: str,
        model: Optional[str] = None,
        provider: Optional[str] = None,
        prompt_version: Optional[str] = None,
        meta: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        if not self.table_exists("enrichment_runs"):
            return None
        run_id = str(uuid.uuid4())
        meta_json = json.dumps(meta) if meta else None
        self._execute(
            """
            INSERT INTO enrichment_runs (id, source, model, provider, prompt_version, meta)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            [run_id, source, model, provider, prompt_version, meta_json],
        )
        return run_id

    def update_enrichment_run_meta(
        self,
        run_id: str,
        failures: List[Dict[str, Any]],
    ) -> None:
        if not self.table_exists("enrichment_runs"):
            return
        try:
            rows = self._execute("SELECT meta FROM enrichment_runs WHERE id = ? LIMIT 1", [run_id])
            meta = json.loads(rows[0]["meta"]) if rows and rows[0].get("meta") else {}
            meta["failures"] = failures
            self._execute("UPDATE enrichment_runs SET meta = ? WHERE id = ?", [json.dumps(meta), run_id])
        except Exception:
            pass

    def upsert_company_enrichment(
        self,
        orgnr: str,
        run_id: str,
        kind: str,
        result: Dict[str, Any],
        score: Optional[float] = None,
        tags: Optional[Dict[str, Any]] = None,
    ) -> None:
        if not self.table_exists("company_enrichment"):
            return
        result_json = json.dumps(result)
        tags_json = json.dumps(tags) if tags else None
        self._execute(
            """
            INSERT OR REPLACE INTO company_enrichment (orgnr, run_id, kind, result, score, tags)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            [orgnr, run_id, kind, result_json, score, tags_json],
        )

    def close(self) -> None:
        with self._lock:
            self._conn.close()

