#!/usr/bin/env python3
"""
Layer 2 AI classifier batch runner for Stage 1 screening CSV.

Reads screening_rank_v1 output (or any CSV with orgnr + company_name).
Fetches a small website evidence pack per row, calls OpenAI once per company,
writes JSONL + CSV with optional blend score.

Usage:
  cd /path/to/nivo && PYTHONPATH=. python3 scripts/screening_layer2_run.py \\
    --input /tmp/screening_top300.csv --out-dir /tmp/layer2 --limit 50

  # Enrich homepage from Postgres when CSV has no homepage column:
  PYTHONPATH=. python3 scripts/screening_layer2_run.py \\
    --input /tmp/screening_top300.csv --out-dir /tmp/layer2 --enrich-homepage-from-db

Requires: OPENAI_API_KEY (environment or `.env` / `backend/.env` via python-dotenv),
optional TAVILY_API_KEY (fallback only), backend deps
(openai, httpx, pandas, pydantic, bs4, python-dotenv, requests).

Run from repo root with: PYTHONPATH=. python3 scripts/screening_layer2_run.py ...
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

REPO_ROOT = Path(__file__).resolve().parents[1]
# Repo root: TavilyClient + settings (`backend.*`). Backend tree: `services.*` imports.
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
if str(REPO_ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(REPO_ROOT / "backend"))

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

import pandas as pd
from openai import OpenAI
from pydantic import ValidationError

from backend.services.screening_layer2.blend import blend_score
from backend.services.screening_layer2.evidence_fetch import build_evidence_pack, log_layer2_tavily_startup
from backend.services.screening_layer2.models import Layer2Classification, openai_json_schema_strict
from backend.services.screening_layer2.prompts import SYSTEM_PROMPT, build_user_prompt

logger = logging.getLogger(__name__)


def _load_dotenv() -> None:
    if load_dotenv:
        load_dotenv(REPO_ROOT / ".env")
        load_dotenv(REPO_ROOT / "backend" / ".env", override=False)


def _openai_api_key_from_env() -> Optional[str]:
    """
    Load repo `.env` files (if python-dotenv is installed), then read OPENAI_API_KEY.
    Export in the shell also works without dotenv.
    """
    _load_dotenv()
    raw = os.getenv("OPENAI_API_KEY")
    if raw is None:
        return None
    key = raw.strip()
    return key or None


def load_homepages_from_db(orgnrs: List[str]) -> Dict[str, str]:
    try:
        import psycopg2
    except ImportError as e:
        raise RuntimeError("psycopg2-binary required for --enrich-homepage-from-db") from e

    url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
    if not url:
        raise RuntimeError("DATABASE_URL not set")
    if not orgnrs:
        return {}
    conn = psycopg2.connect(url, connect_timeout=30)
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT orgnr, homepage FROM companies WHERE orgnr IN %s",
            (tuple(orgnrs),),
        )
        return {str(r[0]): (r[1] or "").strip() for r in cur.fetchall()}
    finally:
        conn.close()


def run_openai_classify(
    client: OpenAI,
    model: str,
    orgnr: str,
    company_name: str,
    stage1_score: float,
    evidence_text: str,
    temperature: float,
) -> Layer2Classification:
    user = build_user_prompt(orgnr, company_name, f"{stage1_score:.2f}", evidence_text)
    schema = openai_json_schema_strict()
    resp = client.chat.completions.create(
        model=model,
        temperature=temperature,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user},
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "Layer2Classification",
                "strict": True,
                "schema": schema,
            },
        },
    )
    raw = resp.choices[0].message.content or "{}"
    if isinstance(raw, list):
        raw = "".join(p.get("text", "") for p in raw if isinstance(p, dict))
    data = json.loads(raw)
    try:
        return Layer2Classification.model_validate(data)
    except ValidationError as e:
        raise RuntimeError(f"Model validation failed: {e}; raw={raw[:500]}") from e


def main() -> None:
    _load_dotenv()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    ap = argparse.ArgumentParser(description="Screening Layer 2 batch classifier")
    ap.add_argument("--input", type=Path, required=True, help="CSV from screening_rank_v1 (orgnr, company_name, …)")
    ap.add_argument("--out-dir", type=Path, required=True, help="Output directory")
    ap.add_argument("--limit", type=int, default=None, help="Max rows to process")
    ap.add_argument("--start", type=int, default=0, help="Skip first N rows after sort")
    ap.add_argument(
        "--enrich-homepage-from-db",
        action="store_true",
        help="Load homepage from companies table (DATABASE_URL)",
    )
    ap.add_argument("--model", type=str, default=os.getenv("SCREENING_LAYER2_MODEL", "gpt-4o-mini"))
    ap.add_argument("--temperature", type=float, default=0.2)
    ap.add_argument("--sleep", type=float, default=0.4, help="Seconds between OpenAI calls")
    ap.add_argument("--w-stage1", type=float, default=0.4, help="Blend weight for Stage 1 (0-1 scale)")
    ap.add_argument("--w-layer2", type=float, default=0.6, help="Blend weight for Layer 2 signal")
    args = ap.parse_args()

    api_key = _openai_api_key_from_env()
    if not api_key:
        print(
            "OPENAI_API_KEY is not set or empty. Set it in the environment or in "
            f"{REPO_ROOT / '.env'} or {REPO_ROOT / 'backend' / '.env'} (OPENAI_API_KEY=...).",
            file=sys.stderr,
        )
        sys.exit(2)

    if not args.input.is_file():
        print(f"Input file not found: {args.input}", file=sys.stderr)
        print(
            "Use a real path, e.g. --input scripts/fixtures/layer2_smoke_batch.csv "
            "--out-dir /tmp/layer2_out (from repo root, PYTHONPATH=.)",
            file=sys.stderr,
        )
        print(
            "If you resolved homepages first, pass that CSV as --input (not /path/to/… placeholders).",
            file=sys.stderr,
        )
        sys.exit(2)

    log_layer2_tavily_startup()

    df = pd.read_csv(args.input)
    if "orgnr" not in df.columns or "company_name" not in df.columns:
        print("CSV must contain orgnr and company_name columns.", file=sys.stderr)
        sys.exit(2)

    score_col = "total_score" if "total_score" in df.columns else None
    if score_col is None and "base_similarity_score" in df.columns:
        score_col = "base_similarity_score"

    # Preserve rank order if present
    if "rank" in df.columns:
        df = df.sort_values("rank", ascending=True, kind="mergesort")

    df = df.iloc[args.start :]
    if args.limit is not None:
        df = df.head(args.limit)

    orgnrs = [str(x).strip() for x in df["orgnr"].tolist()]
    home_map: Dict[str, str] = {}
    if "homepage" in df.columns:
        for _, row in df.iterrows():
            o = str(row["orgnr"]).strip()
            h = row.get("homepage")
            if pd.notna(h) and str(h).strip():
                home_map[o] = str(h).strip()

    if args.enrich_homepage_from_db:
        db_h = load_homepages_from_db(orgnrs)
        for k, v in db_h.items():
            if v and k not in home_map:
                home_map[k] = v

    args.out_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    jsonl_path = args.out_dir / f"layer2_results_{ts}.jsonl"
    csv_path = args.out_dir / f"layer2_results_{ts}.csv"
    manifest_path = args.out_dir / f"layer2_manifest_{ts}.json"

    client = OpenAI(api_key=api_key, timeout=120.0)
    rows_out: List[Dict[str, Any]] = []

    manifest = {
        "created_at_utc": ts,
        "input_csv": str(args.input.resolve()),
        "model": args.model,
        "rows": len(df),
        "blend": {
            "formula": "100 * (w1 * stage1/100 + w2 * fit_confidence * (1 if is_fit else 0.15)) / (w1+w2)",
            "w_stage1": args.w_stage1,
            "w_layer2": args.w_layer2,
        },
        "retrieval": {
            "policy": "homepage-first; link-picked about/product; Tavily only if missing/dead/thin; max 4 pages; max 1 external",
        },
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    with jsonl_path.open("w", encoding="utf-8") as jf:
        for idx, row in df.iterrows():
            orgnr = str(row["orgnr"]).strip()
            name = str(row["company_name"]).strip()
            s1 = float(row[score_col]) if score_col and pd.notna(row.get(score_col)) else 0.0
            hp = home_map.get(orgnr) or None

            logger.info("Layer2 [%s] %s", orgnr, name[:50])
            evidence_text, retr_meta, retr_debug = build_evidence_pack(orgnr, name, hp)
            retr_debug.log_row(orgnr)
            retr = retr_meta.as_dict()
            try:
                obj = run_openai_classify(
                    client,
                    args.model,
                    orgnr,
                    name,
                    s1,
                    evidence_text,
                    args.temperature,
                )
            except Exception as e:
                logger.exception("Failed %s: %s", orgnr, e)
                err_row = {
                    "orgnr": orgnr,
                    "company_name": name,
                    "error": str(e)[:500],
                    "stage1_total_score": s1,
                    **retr,
                }
                jf.write(json.dumps(err_row, ensure_ascii=False) + "\n")
                rows_out.append(err_row)
                time.sleep(args.sleep)
                continue

            b = blend_score(s1, obj.is_fit_for_nivo, obj.fit_confidence, args.w_stage1, args.w_layer2)
            flat = obj.model_dump()
            flat["stage1_total_score"] = s1
            flat["blended_score"] = round(b, 4)
            flat.update(retr)
            jf.write(json.dumps(flat, ensure_ascii=False) + "\n")
            rows_out.append(flat)
            time.sleep(args.sleep)

    if rows_out:
        fieldnames = sorted({k for r in rows_out for k in r.keys()})
        with csv_path.open("w", newline="", encoding="utf-8") as cf:
            w = csv.DictWriter(cf, fieldnames=fieldnames, extrasaction="ignore")
            w.writeheader()
            for r in rows_out:
                row = {k: r.get(k) for k in fieldnames}
                for k, v in list(row.items()):
                    if isinstance(v, list):
                        row[k] = "|".join(str(x) for x in v)
                w.writerow(row)

    print(f"Wrote {jsonl_path}")
    print(f"Wrote {csv_path}")
    print(f"Wrote {manifest_path}")


if __name__ == "__main__":
    main()
