#!/usr/bin/env python3
"""
Ingest merged GPT website-research CSV into screening_runs + screening_website_research_companies.

Requires migration 046_screening_website_research_companies.sql applied.

Usage (from repo root):
  PYTHONPATH=. python3 scripts/ingest_gpt500_website_research.py \\
    --csv-path scripts/fixtures/gpt_website_retrieval_runs/gpt500_urls_chat_search/gpt500_pool_plus_urls.csv

  # Dry run (parse + counts only):
  PYTHONPATH=. python3 scripts/ingest_gpt500_website_research.py --csv-path ... --dry-run

  # Reuse an existing run UUID (re-upsert companies):
  PYTHONPATH=. python3 scripts/ingest_gpt500_website_research.py --csv-path ... --run-id <uuid>

Environment: DATABASE_URL or SUPABASE_DB_URL or POSTGRES_* (see screening_rank_v1.py).
"""

from __future__ import annotations

import argparse
import json
import numbers
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

REPO_ROOT = Path(__file__).resolve().parents[1]
_SCRIPTS_DIR = Path(__file__).resolve().parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None  # type: ignore[misc, assignment]

try:
    import psycopg2
    from psycopg2.extras import Json
except ImportError as e:
    raise SystemExit("psycopg2-binary is required.") from e

import pandas as pd

from screening_manifest_utils import git_commit_hash, sha256_file, utc_timestamp_iso, write_json

SCRIPT_NAME = "ingest_gpt500_website_research.py"
SCRIPT_VERSION = "1.0.0"
RUN_KIND = "website_research_gpt500"


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


def _normalize_orgnr(raw: str) -> str:
    s = (raw or "").strip().replace(" ", "").replace("-", "")
    if len(s) == 10 and s.isdigit():
        return f"{s[:6]}-{s[6:]}"
    return (raw or "").strip()


def _json_safe_value(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, str):
        return v
    try:
        if pd.isna(v):
            return None
    except TypeError:
        pass
    if isinstance(v, (bool,)):
        return v
    if isinstance(v, numbers.Integral):
        return int(v)
    if isinstance(v, numbers.Real):
        return float(v)
    return str(v)


def _row_to_snapshot(row: Dict[str, Any]) -> Dict[str, Any]:
    """Full CSV row as JSON-serializable dict (NaN -> None)."""
    return {str(k): _json_safe_value(v) for k, v in row.items()}


def _initial_about_status(row: pd.Series) -> tuple[str, Optional[str]]:
    """
    Returns (about_fetch_status, gpt_url_for_column).

    Rows with registry-only URL and no GPT URL: still pending if registry_homepage_url present.
    """
    gpt_url = (row.get("gpt_official_website_url") or "")
    if isinstance(gpt_url, float) and pd.isna(gpt_url):
        gpt_url = ""
    gpt_url = str(gpt_url).strip()

    res = (row.get("website_resolution") or "").strip()
    reg = (row.get("registry_homepage_url") or "")
    if isinstance(reg, float) and pd.isna(reg):
        reg = ""
    reg = str(reg).strip()

    if gpt_url:
        return "pending", gpt_url
    if res == "no_gpt_url" and reg:
        return "pending", ""
    return "no_url", ""


def ingest(
    csv_path: Path,
    *,
    run_id: Optional[str],
    dry_run: bool,
    notes: Optional[str],
) -> None:
    if not csv_path.is_file():
        raise SystemExit(f"CSV not found: {csv_path}")

    df = pd.read_csv(csv_path)
    expected_cols = {"orgnr", "company_name", "website_resolution"}
    missing = expected_cols - set(df.columns)
    if missing:
        raise SystemExit(f"CSV missing columns: {sorted(missing)}")

    sha = sha256_file(csv_path)
    git_sha = git_commit_hash(REPO_ROOT)
    created_at = datetime.now(timezone.utc)
    rid = run_id.strip() if run_id else str(uuid.uuid4())
    try:
        uuid.UUID(rid)
    except ValueError as e:
        raise SystemExit(f"Invalid --run-id (must be UUID): {rid}") from e

    try:
        input_rel = str(csv_path.resolve().relative_to(REPO_ROOT.resolve()))
    except ValueError:
        input_rel = str(csv_path.resolve())
    settings: Dict[str, Any] = {
        "input_csv": input_rel,
        "input_csv_sha256": sha,
        "script_version": SCRIPT_VERSION,
        "row_count": len(df),
    }
    manifest: Dict[str, Any] = {
        "schema_version": 1,
        "run_id": rid,
        "run_kind": RUN_KIND,
        "created_at": utc_timestamp_iso(),
        "git_commit": git_sha,
        "settings": settings,
        "notes": notes or "",
    }
    if dry_run:
        pending = sum(1 for _, r in df.iterrows() if _initial_about_status(r)[0] == "pending")
        no_url = sum(1 for _, r in df.iterrows() if _initial_about_status(r)[0] == "no_url")
        print(f"dry_run run_id={rid} rows={len(df)} pending_fetch={pending} no_url={no_url}")
        return

    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO public.screening_runs (
                    id, run_kind, parent_run_id, created_at, git_commit,
                    script_name, script_version, config_path, config_hash_sha256,
                    top_n, status, settings_json, manifest_json, notes
                ) VALUES (
                    %s::uuid, %s, NULL, %s, %s,
                    %s, %s, NULL, NULL,
                    %s, %s, %s::jsonb, %s::jsonb, %s
                )
                ON CONFLICT (id) DO UPDATE SET
                    git_commit = EXCLUDED.git_commit,
                    manifest_json = EXCLUDED.manifest_json,
                    settings_json = EXCLUDED.settings_json,
                    notes = EXCLUDED.notes,
                    status = EXCLUDED.status
                """,
                (
                    rid,
                    RUN_KIND,
                    created_at,
                    git_sha,
                    SCRIPT_NAME,
                    SCRIPT_VERSION,
                    len(df),
                    "ingested",
                    json.dumps(settings),
                    json.dumps(manifest),
                    notes or "",
                ),
            )

            insert_sql = """
                INSERT INTO public.screening_website_research_companies (
                    run_id, orgnr, rank, company_name, pool_snapshot_json,
                    gpt_official_website_url, gpt_url_confidence, gpt_url_source_note,
                    gpt_url_batch_index, website_resolution, about_fetch_status,
                    about_fetch_url_source, updated_at
                ) VALUES (
                    %s::uuid, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    NULL, now()
                )
                ON CONFLICT (run_id, orgnr) DO UPDATE SET
                    rank = EXCLUDED.rank,
                    company_name = EXCLUDED.company_name,
                    pool_snapshot_json = EXCLUDED.pool_snapshot_json,
                    gpt_official_website_url = EXCLUDED.gpt_official_website_url,
                    gpt_url_confidence = EXCLUDED.gpt_url_confidence,
                    gpt_url_source_note = EXCLUDED.gpt_url_source_note,
                    gpt_url_batch_index = EXCLUDED.gpt_url_batch_index,
                    website_resolution = EXCLUDED.website_resolution,
                    about_fetch_status = CASE
                        WHEN screening_website_research_companies.about_fetched_at IS NOT NULL
                        THEN screening_website_research_companies.about_fetch_status
                        ELSE EXCLUDED.about_fetch_status
                    END,
                    updated_at = now()
                """

            for _, row in df.iterrows():
                snap = _row_to_snapshot(row.to_dict())
                orgnr = _normalize_orgnr(str(row.get("orgnr") or ""))
                if not orgnr:
                    continue

                st, gpt_col = _initial_about_status(row)
                rank_val = row.get("rank")
                rank_i: Optional[int] = int(rank_val) if pd.notna(rank_val) else None

                gpt_conf = row.get("gpt_url_confidence")
                gpt_conf_f: Optional[float] = float(gpt_conf) if pd.notna(gpt_conf) else None

                gpt_note = row.get("gpt_url_source_note")
                gpt_note_s: Optional[str] = None if pd.isna(gpt_note) else str(gpt_note)

                gpt_bi = row.get("gpt_url_batch_index")
                gpt_bi_i: Optional[int] = int(gpt_bi) if pd.notna(gpt_bi) else None

                gpt_url_db: Optional[str] = gpt_col if gpt_col else None

                cur.execute(
                    insert_sql,
                    (
                        rid,
                        orgnr,
                        rank_i,
                        None if pd.isna(row.get("company_name")) else str(row.get("company_name")),
                        Json(snap),
                        gpt_url_db,
                        gpt_conf_f,
                        gpt_note_s,
                        gpt_bi_i,
                        None if pd.isna(row.get("website_resolution")) else str(row.get("website_resolution")),
                        st,
                    ),
                )

        conn.commit()
    finally:
        conn.close()

    manifest["ingested_rows"] = len(df)
    manifest_path = csv_path.parent / f"ingest_{rid[:8]}_manifest.json"
    write_json(manifest_path, manifest)
    print(f"ingested run_id={rid} rows={len(df)} manifest={manifest_path}")


def main() -> None:
    p = argparse.ArgumentParser(description="Ingest merged GPT-500 CSV into website research tables.")
    p.add_argument("--csv-path", type=Path, required=True)
    p.add_argument("--run-id", type=str, default="", help="Existing screening_runs UUID to attach rows to")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--notes", type=str, default="")
    args = p.parse_args()
    ingest(
        args.csv_path.resolve(),
        run_id=args.run_id or None,
        dry_run=args.dry_run,
        notes=args.notes or None,
    )


if __name__ == "__main__":
    main()
