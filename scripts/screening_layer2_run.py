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

  # Optional CSV column ``layer2_retrieval_mode``: auto | multi_source | homepage_known | homepage_missing
  # (defaults to --layer2-retrieval-mode). Default path is multi-source Tavily domain clustering (not a single homepage).

Requires: OPENAI_API_KEY (environment or `.env` / `backend/.env` via python-dotenv),
TAVILY_API_KEY recommended for multi-source retrieval, backend deps
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
_SCRIPTS_DIR = Path(__file__).resolve().parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))
# Repo root: TavilyClient + settings (`backend.*`). Backend tree: `services.*` imports.
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
if str(REPO_ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(REPO_ROOT / "backend"))

from screening_manifest_utils import git_commit_hash, utc_timestamp_iso, write_json

SCREENING_LAYER2_RUN_VERSION = "1.0.0"

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

import pandas as pd
from openai import OpenAI
from pydantic import ValidationError

from backend.services.screening_layer2.blend import blend_score
from backend.services.screening_layer2.evidence_fetch import (
    LAYER2_RAW_SUBDIR,
    build_evidence_pack,
    log_layer2_tavily_startup,
)
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
    *,
    layer2_retrieval_mode: str = "homepage_known",
    layer2_identity_confidence_low: bool = False,
) -> Layer2Classification:
    user = build_user_prompt(
        orgnr,
        company_name,
        f"{stage1_score:.2f}",
        evidence_text,
        layer2_retrieval_mode=layer2_retrieval_mode,
        layer2_identity_confidence_low=layer2_identity_confidence_low,
    )
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
    ap.add_argument(
        "--layer2-retrieval-mode",
        choices=["auto", "homepage_known", "homepage_missing", "multi_source"],
        default="auto",
        help="Default when CSV has no layer2_retrieval_mode column. "
        "auto/homepage_missing/multi_source → multi-query domain clustering; "
        "homepage_known → legacy single-URL crawl.",
    )
    ap.add_argument(
        "--no-tavily-raw",
        action="store_true",
        help="Do not write full Tavily search JSON under out-dir/layer2_raw/ (default: write)",
    )
    ap.add_argument(
        "--debug-tavily-orgnr",
        type=str,
        default=None,
        metavar="ORGNR",
        help="For this orgnr only: write combined debug JSON and print path; use --debug-tavily-print-json for stdout dump",
    )
    ap.add_argument(
        "--debug-tavily-print-json",
        action="store_true",
        help="With --debug-tavily-orgnr, print full debug Tavily JSON to stdout",
    )
    ap.add_argument(
        "--tavily-low-credit",
        action="store_true",
        help="Optional smoke mode: cap how many rows to process (see --tavily-low-credit-max-rows). "
        "Layer 2 always uses the efficient 1–2 Tavily search path when multi-source is selected.",
    )
    ap.add_argument(
        "--tavily-low-credit-max-rows",
        type=int,
        default=40,
        metavar="N",
        help="With --tavily-low-credit: max rows to process (default 40, hard cap 50)",
    )
    ap.add_argument(
        "--tavily-priority-max-rank",
        type=int,
        default=40,
        metavar="R",
        help="Deprecated: no longer affects Tavily queries (kept for manifest compatibility).",
    )
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
    if args.tavily_low_credit:
        cap = min(max(1, args.tavily_low_credit_max_rows), 50)
        lim = args.limit if args.limit is not None else cap
        lim = min(lim, cap)
        df = df.head(lim)
    elif args.limit is not None:
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

    raw_capture_dir: Optional[Path] = None
    if not args.no_tavily_raw:
        raw_capture_dir = args.out_dir / LAYER2_RAW_SUBDIR
    tavily_debug_output_dir: Optional[Path] = (
        args.out_dir / LAYER2_RAW_SUBDIR if args.debug_tavily_orgnr else None
    )

    tavily_raw_index: List[Dict[str, Any]] = []

    with jsonl_path.open("w", encoding="utf-8") as jf:
        for idx, row in df.iterrows():
            orgnr = str(row["orgnr"]).strip()
            name = str(row["company_name"]).strip()
            s1 = float(row[score_col]) if score_col and pd.notna(row.get(score_col)) else 0.0
            hp = home_map.get(orgnr) or None

            rmode_cell = row.get("layer2_retrieval_mode")
            if rmode_cell is not None and pd.notna(rmode_cell) and str(rmode_cell).strip() in (
                "auto",
                "homepage_known",
                "homepage_missing",
                "multi_source",
            ):
                rmode = str(rmode_cell).strip()
            else:
                rmode = args.layer2_retrieval_mode

            logger.info("Layer2 [%s] %s", orgnr, name[:50])
            row_t0 = time.perf_counter()
            evidence_text, retr_meta, retr_debug = build_evidence_pack(
                orgnr,
                name,
                hp,
                retrieval_mode=rmode,
                stage1_total_score=s1,
                raw_tavily_dir=raw_capture_dir,
                tavily_raw_cache_dir=raw_capture_dir,
                tavily_debug_output_dir=tavily_debug_output_dir,
                tavily_debug_orgnr=args.debug_tavily_orgnr,
                tavily_debug_print_json=args.debug_tavily_print_json,
            )
            retr_debug.log_row(orgnr)
            retr = retr_meta.as_dict()
            tavily_raw_index.append(
                {
                    "orgnr": orgnr,
                    "company_name": name,
                    "layer2_retrieval_mode": retr.get("layer2_retrieval_mode"),
                    "tavily_raw_artifacts": retr.get("tavily_raw_artifacts") or {},
                }
            )
            temp = float(args.temperature)
            if retr_debug.layer2_retrieval_mode == "multi_source":
                temp = min(temp, 0.15)
            if getattr(retr_debug, "layer2_identity_confidence_low", False):
                temp = min(temp, 0.12)
            try:
                oai_t0 = time.perf_counter()
                obj = run_openai_classify(
                    client,
                    args.model,
                    orgnr,
                    name,
                    s1,
                    evidence_text,
                    temp,
                    layer2_retrieval_mode=retr_debug.layer2_retrieval_mode,
                    layer2_identity_confidence_low=getattr(
                        retr_debug, "layer2_identity_confidence_low", False
                    ),
                )
                openai_ms = (time.perf_counter() - oai_t0) * 1000
            except Exception as e:
                logger.exception("Failed %s: %s", orgnr, e)
                total_ms = (time.perf_counter() - row_t0) * 1000
                retr_meta.openai_time_ms = 0.0
                retr_meta.total_row_time_ms = total_ms
                err_row = {
                    "orgnr": orgnr,
                    "company_name": name,
                    "error": str(e)[:500],
                    "stage1_total_score": s1,
                    **retr_meta.as_dict(),
                }
                jf.write(json.dumps(err_row, ensure_ascii=False) + "\n")
                rows_out.append(err_row)
                if tavily_raw_index and tavily_raw_index[-1].get("orgnr") == orgnr:
                    tavily_raw_index[-1]["openai_error"] = True
                time.sleep(args.sleep)
                continue

            b = blend_score(s1, obj.is_fit_for_nivo, obj.fit_confidence, args.w_stage1, args.w_layer2)
            flat = obj.model_dump()
            flat["stage1_total_score"] = s1
            flat["blended_score"] = round(b, 4)
            total_ms = (time.perf_counter() - row_t0) * 1000
            retr_meta.openai_time_ms = openai_ms
            retr_meta.total_row_time_ms = total_ms
            flat.update(retr_meta.as_dict())
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

    def _cli_snapshot() -> Dict[str, Any]:
        snap: Dict[str, Any] = {}
        for k, v in vars(args).items():
            if isinstance(v, Path):
                snap[k] = str(v.resolve())
            else:
                snap[k] = v
        return snap

    manifest = {
        "run_kind": "layer2_screening_layer2_run",
        "created_at_utc": utc_timestamp_iso(),
        "run_timestamp_id": ts,
        "git_commit": git_commit_hash(REPO_ROOT),
        "script": "screening_layer2_run.py",
        "script_version": SCREENING_LAYER2_RUN_VERSION,
        "cli": _cli_snapshot(),
        "input_csv": str(args.input.resolve()),
        "out_dir": str(args.out_dir.resolve()),
        "model": args.model,
        "temperature": args.temperature,
        "rows_input_slice": len(df),
        "blend": {
            "formula": "100 * (w1 * stage1/100 + w2 * fit_confidence * (1 if is_fit else 0.15)) / (w1+w2)",
            "w_stage1": args.w_stage1,
            "w_layer2": args.w_layer2,
        },
        "retrieval": {
            "policy": "Default: multi-source (1–2 Tavily searches, domain clustering, limited same-origin fetches, LinkedIn snippets). "
            "homepage_known: legacy single-URL crawl.",
            "default_layer2_retrieval_mode": args.layer2_retrieval_mode,
        },
        "tavily_raw": {
            "enabled": not args.no_tavily_raw,
            "directory_relative": LAYER2_RAW_SUBDIR,
            "directory_absolute": str((args.out_dir / LAYER2_RAW_SUBDIR).resolve()) if not args.no_tavily_raw else None,
            "rows": tavily_raw_index,
        },
        "tavily_low_credit": {
            "note": "Flag only caps batch size when set; efficient 1–2 Tavily searches are always used for multi-source.",
            "enabled": bool(args.tavily_low_credit),
            "max_rows_cap": min(max(1, args.tavily_low_credit_max_rows), 50) if args.tavily_low_credit else None,
            "priority_max_rank_deprecated": args.tavily_priority_max_rank,
        },
        "artifacts": {
            "jsonl": str(jsonl_path.resolve()),
            "csv": str(csv_path.resolve()),
            "manifest": str(manifest_path.resolve()),
            "layer2_raw_dir": str((args.out_dir / LAYER2_RAW_SUBDIR).resolve()) if not args.no_tavily_raw else None,
        },
    }
    write_json(manifest_path, manifest)

    print(f"Wrote {jsonl_path}")
    print(f"Wrote {csv_path}")
    print(f"Wrote {manifest_path}")


if __name__ == "__main__":
    main()
