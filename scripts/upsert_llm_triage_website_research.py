#!/usr/bin/env python3
"""
Upsert ``llm_triage_json`` (+ ``llm_triage_at``) on ``screening_website_research_companies`` from
``screening_layer2_from_gpt_about_json.py`` JSONL (one object per line).

Match rows by ``run_id`` + ``orgnr`` (normalized XXXXXX-XXXX).

Usage:
  PYTHONPATH=. python3 scripts/upsert_llm_triage_website_research.py \\
    --run-id dd15199e-e342-4977-b639-9be1d72acb56 \\
    --jsonl scripts/fixtures/gpt_website_retrieval_runs/layer2_from_gpt_about_dd15199e/layer2_from_gpt_about_*.jsonl

  # Dry run (count only):
  PYTHONPATH=. python3 scripts/upsert_llm_triage_website_research.py --run-id ... --jsonl ... --dry-run
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

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


def _triage_payload(line_obj: Dict[str, Any]) -> Dict[str, Any]:
    """Strip to JSON-serializable triage blob (exclude nothing critical)."""
    keys = (
        "is_fit_for_nivo",
        "fit_confidence",
        "business_type",
        "operating_model",
        "is_subsidiary_or_group_company",
        "is_service_heavy",
        "is_construction_or_installation",
        "is_generic_distributor",
        "is_hospitality_or_property_company",
        "niche_indicator",
        "differentiation_indicator",
        "repeat_purchase_indicator",
        "scalable_business_indicator",
        "reason_summary",
        "red_flags",
        "evidence",
        "stage1_total_score",
        "blended_score",
        "fit_rank",
        "gpt_about_source_url",
        "official_website_url",
    )
    out: Dict[str, Any] = {"source": "screening_layer2_from_gpt_about_json"}
    for k in keys:
        if k in line_obj:
            out[k] = line_obj[k]
    return out


def load_jsonl(path: Path) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def main() -> None:
    ap = argparse.ArgumentParser(description="Upsert llm_triage_json for website research companies.")
    ap.add_argument("--run-id", type=str, required=True)
    ap.add_argument("--jsonl", type=Path, required=True, help="JSONL from layer2_from_gpt_about")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    jl = args.jsonl.resolve()
    if not jl.is_file():
        raise SystemExit(f"Not found: {jl}")

    records = load_jsonl(jl)
    run_id = args.run_id.strip()
    now = datetime.now(timezone.utc)

    if args.dry_run:
        print(f"Would upsert {len(records)} rows for run_id={run_id}")
        return

    conn = _connect()
    updated = 0
    missing = 0
    try:
        with conn.cursor() as cur:
            for rec in records:
                org = _normalize_orgnr(str(rec.get("orgnr") or ""))
                if not org:
                    continue
                payload = _triage_payload(rec)
                cur.execute(
                    """
                    UPDATE public.screening_website_research_companies
                    SET llm_triage_json = %s,
                        llm_triage_at = %s,
                        updated_at = now()
                    WHERE run_id = %s::uuid AND orgnr = %s
                    """,
                    (Json(payload), now, run_id, org),
                )
                if cur.rowcount:
                    updated += 1
                else:
                    missing += 1
        conn.commit()
    finally:
        conn.close()

    print(f"Upserted llm_triage_json for {updated} rows; {missing} orgnrs not found in run")


if __name__ == "__main__":
    main()
