"""
Postgres implementation of the DatabaseService.

Uses local Postgres (e.g. Docker via docker-compose). Connection from env:
  POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD
"""

from __future__ import annotations

import json
import logging
import os
import re
from threading import Lock
from typing import Any, Dict, List, Optional, Sequence

import psycopg2
from psycopg2 import extras

from .database_service import DatabaseService

logger = logging.getLogger(__name__)


def _make_conn():
    """Use DATABASE_URL or SUPABASE_DB_URL if set; otherwise POSTGRES_* vars."""
    url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
    if url:
        return psycopg2.connect(url, connect_timeout=5)
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5433")),
        dbname=os.getenv("POSTGRES_DB", "nivo"),
        user=os.getenv("POSTGRES_USER", "nivo"),
        password=os.getenv("POSTGRES_PASSWORD", "nivo"),
        connect_timeout=5,
    )


def _sqlite_to_psycopg(sql: str) -> str:
    """Replace SQLite ? placeholders with %s for psycopg2."""
    # Avoid replacing ? inside string literals; for our queries, simple replace is safe
    return sql.replace("?", "%s")


def _fix_limit_for_postgres(sql: str) -> str:
    """SQLite uses LIMIT -1 for 'all rows'; Postgres needs LIMIT ALL."""
    return re.sub(r"\bLIMIT\s+-1\b", "LIMIT ALL", sql, flags=re.IGNORECASE)


class PostgresDBService(DatabaseService):
    """Postgres implementation for local Docker Postgres."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._conn = _make_conn()
        self._conn.autocommit = False
        conn_display = "DATABASE_URL/SUPABASE_DB_URL" if (os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")) else f"{os.getenv('POSTGRES_HOST', 'localhost')}:{os.getenv('POSTGRES_PORT', '5433')}/{os.getenv('POSTGRES_DB', 'nivo')}"
        logger.info("Connected to Postgres (%s)", conn_display)

    def _execute(
        self,
        sql: str,
        params: Optional[Sequence[Any]] = None,
    ) -> List[Dict[str, Any]]:
        sql = _sqlite_to_psycopg(sql)
        sql = _fix_limit_for_postgres(sql)
        with self._lock:
            with self._conn.cursor(cursor_factory=extras.RealDictCursor) as cur:
                cur.execute(sql, params or [])
                self._conn.commit()
                rows = cur.fetchall() if cur.description else []
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
            sql += " LIMIT %s"
            params = list(params or []) + [limit]
            if offset:
                sql += " OFFSET %s"
                params = list(params) + [offset]
        elif offset:
            sql += " LIMIT ALL OFFSET %s"
            params = list(params or []) + [offset]
        return self._execute(sql, params)

    def fetch_company_financials(
        self,
        org_number: str,
        limit_years: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        sql = (
            "SELECT * FROM financials "
            "WHERE orgnr = %s "
            "ORDER BY year DESC, period DESC"
        )
        params: List[Any] = [org_number]
        if limit_years is not None:
            sql += " LIMIT %s"
            params.append(limit_years)
        return self._execute(sql, params)

    def fetch_company_metrics(self, org_number: str) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM company_kpis WHERE orgnr = %s LIMIT 1"
        rows = self._execute(sql, [org_number])
        return rows[0] if rows else None

    def run_raw_query(
        self,
        sql: str,
        params: Optional[Sequence[Any]] = None,
    ) -> List[Dict[str, Any]]:
        return self._execute(sql, params)

    def run_execute_values(self, sql: str, values: List[tuple]) -> int:
        """Bulk insert using psycopg2.extras.execute_values. Returns rowcount."""
        from psycopg2.extras import execute_values

        sql = _sqlite_to_psycopg(sql)
        with self._lock:
            with self._conn.cursor() as cur:
                execute_values(cur, sql, values, page_size=2000)
                rowcount = cur.rowcount
            self._conn.commit()
        return rowcount

    def table_exists(self, table_name: str) -> bool:
        rows = self._execute(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = %s",
            [table_name],
        )
        return len(rows) > 0

    def fetch_ai_profiles(self, orgnrs: List[str]) -> List[Dict[str, Any]]:
        if not orgnrs:
            return []
        if not self.table_exists("ai_profiles"):
            return []
        placeholders = ",".join("%s" for _ in orgnrs)
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
        sql = """
            INSERT INTO ai_profiles (
                org_number, website, product_description, end_market, customer_types,
                strategic_fit_score, defensibility_score, value_chain_position, ai_notes,
                industry_sector, industry_subsector, market_regions, business_model_summary,
                business_summary, risk_flags, industry_keywords, upside_potential, strategic_playbook,
                next_steps, acquisition_angle, agent_type, scraped_pages, fit_rationale,
                enrichment_status, last_updated, date_scraped
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s
            )
            ON CONFLICT (org_number) DO UPDATE SET
                website = EXCLUDED.website,
                product_description = EXCLUDED.product_description,
                end_market = EXCLUDED.end_market,
                customer_types = EXCLUDED.customer_types,
                strategic_fit_score = EXCLUDED.strategic_fit_score,
                defensibility_score = EXCLUDED.defensibility_score,
                value_chain_position = EXCLUDED.value_chain_position,
                ai_notes = EXCLUDED.ai_notes,
                industry_sector = EXCLUDED.industry_sector,
                industry_subsector = EXCLUDED.industry_subsector,
                market_regions = EXCLUDED.market_regions,
                business_model_summary = EXCLUDED.business_model_summary,
                business_summary = EXCLUDED.business_summary,
                risk_flags = EXCLUDED.risk_flags,
                industry_keywords = EXCLUDED.industry_keywords,
                upside_potential = EXCLUDED.upside_potential,
                strategic_playbook = EXCLUDED.strategic_playbook,
                next_steps = EXCLUDED.next_steps,
                acquisition_angle = EXCLUDED.acquisition_angle,
                agent_type = EXCLUDED.agent_type,
                scraped_pages = EXCLUDED.scraped_pages,
                fit_rationale = EXCLUDED.fit_rationale,
                enrichment_status = EXCLUDED.enrichment_status,
                last_updated = EXCLUDED.last_updated,
                date_scraped = EXCLUDED.date_scraped
            """
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
            profile.get("market_regions"),
            profile.get("business_model_summary"),
            profile.get("business_summary"),
            profile.get("risk_flags"),
            profile.get("industry_keywords"),
            profile.get("upside_potential"),
            profile.get("strategic_playbook"),
            profile.get("next_steps"),
            profile.get("acquisition_angle"),
            profile.get("agent_type"),
            profile.get("scraped_pages"),
            profile.get("fit_rationale"),
            profile.get("enrichment_status", "complete"),
            profile.get("last_updated"),
            profile.get("date_scraped"),
        ]
        self._execute(sql, vals)

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
        placeholders = ",".join("%s" for _ in orgnrs)
        params: List[Any] = list(orgnrs)
        kind_filter = ""
        if kinds:
            kind_placeholders = ",".join("%s" for _ in kinds)
            kind_filter = f" AND kind IN ({kind_placeholders})"
            params.extend(kinds)
        if latest_run_only:
            sql = f"""
                SELECT DISTINCT ON (orgnr, kind) orgnr, run_id, kind, result, score, tags, created_at
                FROM company_enrichment
                WHERE orgnr IN ({placeholders}){kind_filter}
                ORDER BY orgnr, kind, created_at DESC
            """
        else:
            sql = f"""
                SELECT orgnr, run_id, kind, result, score, tags, created_at
                FROM company_enrichment
                WHERE orgnr IN ({placeholders}){kind_filter}
                ORDER BY created_at DESC
            """
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
        meta_json = json.dumps(meta) if meta else None
        rows = self._execute(
            """
            INSERT INTO enrichment_runs (source, model, provider, prompt_version, meta)
            VALUES (%s, %s, %s, %s, %s::jsonb)
            RETURNING id
            """,
            [source, model, provider, prompt_version, meta_json],
        )
        return str(rows[0]["id"]) if rows else None

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
            INSERT INTO company_enrichment (orgnr, run_id, kind, result, score, tags)
            VALUES (%s, %s, %s, %s::jsonb, %s, %s::jsonb)
            ON CONFLICT (orgnr, run_id, kind) DO UPDATE SET
                result = EXCLUDED.result,
                score = EXCLUDED.score,
                tags = EXCLUDED.tags
            """,
            [orgnr, run_id, kind, result_json, score, tags_json],
        )

    def update_enrichment_run_meta(
        self,
        run_id: str,
        failures: List[Dict[str, Any]],
    ) -> None:
        if not self.table_exists("enrichment_runs"):
            return
        patch = json.dumps({"failures": failures})
        self._execute(
            "UPDATE enrichment_runs SET meta = COALESCE(meta, '{}'::jsonb) || %s::jsonb WHERE id = %s",
            [patch, run_id],
        )

    def close(self) -> None:
        with self._lock:
            self._conn.close()
