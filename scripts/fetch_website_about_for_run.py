#!/usr/bin/env python3
"""
Fetch homepage + About/Om oss text for rows in screening_website_research_companies.

Reads pending rows for a screening_runs.id, updates about_* columns in Postgres.

Usage:
  PYTHONPATH=. python3 scripts/fetch_website_about_for_run.py --run-id <uuid>

  # Use registry homepage when GPT URL is empty (same rows marked pending at ingest):
  PYTHONPATH=. python3 scripts/fetch_website_about_for_run.py --run-id <uuid> \\
    --fallback-registry-homepage

  # Smoke test (first 10 pending):
  PYTHONPATH=. python3 scripts/fetch_website_about_for_run.py --run-id <uuid> --limit 10

  # Retry prior failures:
  PYTHONPATH=. python3 scripts/fetch_website_about_for_run.py --run-id <uuid> --re-fetch-failed

Concurrency defaults low to reduce rate limits / blocking.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

REPO_ROOT = Path(__file__).resolve().parents[1]
_SCRIPTS_DIR = Path(__file__).resolve().parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
if str(REPO_ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(REPO_ROOT / "backend"))

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None  # type: ignore[misc, assignment]

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError as e:
    raise SystemExit("psycopg2-binary is required.") from e

from screening_manifest_utils import utc_timestamp_iso, write_json

from backend.services.web_intel.site_about_fetch import (
    SiteAboutFetchResult,
    fetch_home_and_about,
    normalize_homepage,
)

SCRIPT_NAME = "fetch_website_about_for_run.py"
SCRIPT_VERSION = "1.0.0"


def _load_dotenv() -> None:
    if load_dotenv:
        load_dotenv(REPO_ROOT / ".env")
        load_dotenv(REPO_ROOT / "backend" / ".env", override=False)


def _connect():
    _load_dotenv()
    url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
    if url:
        return psycopg2.connect(url, connect_timeout=30)
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5433")),
        dbname=os.getenv("POSTGRES_DB", "nivo"),
        user=os.getenv("POSTGRES_USER", "nivo"),
        password=os.getenv("POSTGRES_PASSWORD", "nivo"),
        connect_timeout=30,
    )


def _resolve_fetch_url(
    gpt_url: Optional[str],
    pool: Dict[str, Any],
    *,
    fallback_registry: bool,
) -> Tuple[Optional[str], str]:
    g = (gpt_url or "").strip()
    if g:
        u = normalize_homepage(g)
        return u, "gpt" if u else "none"
    if not fallback_registry:
        return None, "none"
    reg = (pool.get("registry_homepage_url") or "") if isinstance(pool, dict) else ""
    if not isinstance(reg, str):
        reg = str(reg or "")
    reg = reg.strip()
    u = normalize_homepage(reg)
    return u, "registry_fallback" if u else "none"


def _apply_fetch_result(
    res: SiteAboutFetchResult,
    *,
    url_source: str,
) -> Dict[str, Any]:
    """DB column dict for UPDATE (about_* only)."""
    return {
        "about_fetch_url_source": url_source if res.status != "no_url" else "none",
        "about_fetch_status": res.status,
        "about_fetch_final_home_url": res.final_home_url or None,
        "about_page_chosen_url": res.about_page_chosen_url or None,
        "about_home_text": res.home_text or None,
        "about_section_text": res.section_text or None,
        "about_text_for_llm": res.text_for_llm or None,
        "about_pages_fetched": res.pages_fetched,
        "about_fetched_at": datetime.now(timezone.utc),
        "about_fetch_error": (res.error_detail or None) if res.status not in ("ok", "home_only") else None,
    }


def _fetch_one_worker(
    payload: Tuple[int, str, Optional[str], Dict[str, Any], bool],
) -> Tuple[int, Optional[Dict[str, Any]]]:
    row_id, _orgnr, gpt_url_raw, pool, fallback_registry = payload
    gpt_s = (gpt_url_raw or "").strip() if gpt_url_raw else ""
    reg_raw = pool.get("registry_homepage_url") if isinstance(pool, dict) else None
    reg_s = (str(reg_raw).strip() if reg_raw is not None else "")

    url, src = _resolve_fetch_url(gpt_url_raw, pool, fallback_registry=fallback_registry)
    if not url:
        if not gpt_s and reg_s and not fallback_registry:
            return row_id, None
        return row_id, {
            "about_fetch_url_source": "none",
            "about_fetch_status": "no_url",
            "about_fetch_final_home_url": None,
            "about_page_chosen_url": None,
            "about_home_text": None,
            "about_section_text": None,
            "about_text_for_llm": None,
            "about_pages_fetched": 0,
            "about_fetched_at": datetime.now(timezone.utc),
            "about_fetch_error": None,
        }
    res = fetch_home_and_about(url)
    return row_id, _apply_fetch_result(res, url_source=src)


def _as_pool_dict(raw: Any) -> Dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str) and raw.strip():
        try:
            return dict(json.loads(raw))
        except Exception:
            return {}
    return {}


def run_fetch(
    run_id: str,
    *,
    fallback_registry: bool,
    concurrency: int,
    limit: Optional[int],
    re_fetch_failed: bool,
    sleep_between: float,
    manifest_path: Optional[Path],
) -> None:
    rows: List[Dict[str, Any]] = []
    conn = _connect()
    try:
        statuses = ("pending",)
        if re_fetch_failed:
            statuses = (
                "pending",
                "http_error",
                "non_html",
                "timeout",
                "empty_text",
            )

        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            q = """
                SELECT id, orgnr, gpt_official_website_url, pool_snapshot_json
                FROM public.screening_website_research_companies
                WHERE run_id = %s::uuid
                  AND about_fetch_status IN %s
                ORDER BY rank NULLS LAST, orgnr
            """
            cur.execute(q, (run_id, tuple(statuses)))
            rows = list(cur.fetchall())
    finally:
        conn.close()

    if limit is not None:
        rows = rows[: max(0, limit)]

    pool_by_id = {
        r["id"]: (
            r["id"],
            r["orgnr"],
            r.get("gpt_official_website_url"),
            _as_pool_dict(r.get("pool_snapshot_json")),
            fallback_registry,
        )
        for r in rows
    }

    if not rows:
        print("No rows to fetch.")
        return

    updates: Dict[int, Dict[str, Any]] = {}
    with ThreadPoolExecutor(max_workers=max(1, concurrency)) as ex:
        futs = [ex.submit(_fetch_one_worker, pool_by_id[r["id"]]) for r in rows]
        for fut in as_completed(futs):
            row_id, cols = fut.result()
            if cols is not None:
                updates[row_id] = cols
            if sleep_between > 0:
                time.sleep(sleep_between)

    conn = _connect()
    try:
        with conn.cursor() as cur:
            sql = """
                UPDATE public.screening_website_research_companies SET
                    about_fetch_url_source = %s,
                    about_fetch_status = %s,
                    about_fetch_final_home_url = %s,
                    about_page_chosen_url = %s,
                    about_home_text = %s,
                    about_section_text = %s,
                    about_text_for_llm = %s,
                    about_pages_fetched = %s,
                    about_fetched_at = %s,
                    about_fetch_error = %s,
                    updated_at = now()
                WHERE id = %s
            """
            for row_id, c in updates.items():
                cur.execute(
                    sql,
                    (
                        c["about_fetch_url_source"],
                        c["about_fetch_status"],
                        c["about_fetch_final_home_url"],
                        c["about_page_chosen_url"],
                        c["about_home_text"],
                        c["about_section_text"],
                        c["about_text_for_llm"],
                        c["about_pages_fetched"],
                        c["about_fetched_at"],
                        c["about_fetch_error"],
                        row_id,
                    ),
                )
        conn.commit()
    finally:
        conn.close()

    breakdown: Dict[str, int] = {}
    for c in updates.values():
        breakdown[c["about_fetch_status"]] = breakdown.get(c["about_fetch_status"], 0) + 1

    print(f"updated {len(updates)} rows status_breakdown={breakdown}")

    if manifest_path:
        write_json(
            manifest_path,
            {
                "schema_version": 1,
                "script": SCRIPT_NAME,
                "script_version": SCRIPT_VERSION,
                "run_id": run_id,
                "completed_at": utc_timestamp_iso(),
                "row_count": len(updates),
                "status_breakdown": breakdown,
                "fallback_registry": fallback_registry,
                "re_fetch_failed": re_fetch_failed,
            },
        )
        print(f"wrote manifest {manifest_path}")


def main() -> None:
    p = argparse.ArgumentParser(description="Fetch website about text for a website-research run.")
    p.add_argument("--run-id", type=str, required=True)
    p.add_argument("--fallback-registry-homepage", action="store_true")
    p.add_argument("--concurrency", type=int, default=4)
    p.add_argument("--limit", type=int, default=None)
    p.add_argument("--re-fetch-failed", action="store_true")
    p.add_argument("--sleep-between", type=float, default=0.0, help="Seconds after each completed fetch")
    p.add_argument(
        "--manifest",
        type=Path,
        default=None,
        help="Optional path to write JSON manifest",
    )
    args = p.parse_args()
    mp = args.manifest.resolve() if args.manifest else None
    run_fetch(
        args.run_id.strip(),
        fallback_registry=bool(args.fallback_registry_homepage),
        concurrency=args.concurrency,
        limit=args.limit,
        re_fetch_failed=bool(args.re_fetch_failed),
        sleep_between=max(0.0, args.sleep_between),
        manifest_path=mp,
    )


if __name__ == "__main__":
    main()
