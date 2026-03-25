#!/usr/bin/env python3
"""
Export public.screening_website_research_companies for a given run_id to CSV.

Large text columns are quoted as usual. Optional: exclude heavy text columns for a slim sheet.

Usage:
  PYTHONPATH=. python3 scripts/export_website_research_run_csv.py \\
    --run-id <uuid> --out /tmp/website_research_run.csv

  PYTHONPATH=. python3 scripts/export_website_research_run_csv.py \\
    --run-id <uuid> --out /tmp/slim.csv --omit-text-blobs
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Sequence

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
    from psycopg2.extras import RealDictCursor
except ImportError as e:
    raise SystemExit("psycopg2-binary is required.") from e


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


_TEXT_BLOBS = frozenset(
    {
        "about_home_text",
        "about_section_text",
        "about_text_for_llm",
        "pool_snapshot_json",
        "llm_triage_json",
    }
)


def _flatten_row(row: Dict[str, Any], columns: Sequence[str]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for c in columns:
        v = row.get(c)
        if c == "pool_snapshot_json" and v is not None and not isinstance(v, str):
            v = json.dumps(v, ensure_ascii=False)
        elif c == "llm_triage_json" and v is not None and not isinstance(v, str):
            v = json.dumps(v, ensure_ascii=False)
        out[c] = v
    return out


def export_run(
    run_id: str,
    out_path: Path,
    *,
    omit_text_blobs: bool,
) -> None:
    conn = _connect()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT *
                FROM public.screening_website_research_companies
                WHERE run_id = %s::uuid
                ORDER BY rank NULLS LAST, orgnr
                """,
                (run_id,),
            )
            rows: List[Dict[str, Any]] = list(cur.fetchall())
    finally:
        conn.close()

    if not rows:
        raise SystemExit("No rows for run_id.")

    all_cols = list(rows[0].keys())
    columns = [c for c in all_cols if not (omit_text_blobs and c in _TEXT_BLOBS)]

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=columns, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow(_flatten_row(r, columns))

    print(f"wrote {len(rows)} rows to {out_path}")


def main() -> None:
    p = argparse.ArgumentParser(description="Export website research run rows to CSV.")
    p.add_argument("--run-id", type=str, required=True)
    p.add_argument("--out", type=Path, required=True)
    p.add_argument(
        "--omit-text-blobs",
        action="store_true",
        help="Drop pool_snapshot_json and long about_* / llm_triage_json columns",
    )
    args = p.parse_args()
    export_run(args.run_id.strip(), args.out.resolve(), omit_text_blobs=bool(args.omit_text_blobs))


if __name__ == "__main__":
    main()
