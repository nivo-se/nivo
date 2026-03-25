#!/usr/bin/env python3
"""
Build the ranked CSV pool used by ``gpt_batch_website_retrieval_test.py``.

Runs the same Layer 1 pipeline as ``screening_rank_v1.py`` against
``public.screening_features_v1`` and the default calibration YAML.

Requires: backend Python deps (pandas, numpy, psycopg2, pyyaml, python-dotenv)
and Postgres reachable via DATABASE_URL / SUPABASE_DB_URL or POSTGRES_*.

Usage:
  cd /path/to/nivo && PYTHONPATH=. python3 scripts/export_gpt_website_retrieval_pool_csv.py
  PYTHONPATH=. python3 scripts/export_gpt_website_retrieval_pool_csv.py --top 800 --out /tmp/pool.csv

Next (OpenAI URL batches): ``gpt_batch_website_urls_500.py --out-dir …`` (expects a CSV with at least
as many rows as ``--total``, default 500).
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = REPO_ROOT / "scripts" / "fixtures" / "gpt_website_retrieval_shortlist_pool.csv"
DEFAULT_CONFIG = REPO_ROOT / "scripts" / "fixtures" / "screening_v1_calibration.yaml"


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Export ranked shortlist CSV for GPT batch website retrieval test."
    )
    ap.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help=f"Output CSV (default: {DEFAULT_OUT})",
    )
    ap.add_argument("--top", type=int, default=500, help="Keep top N ranked rows")
    ap.add_argument("--config", type=Path, default=DEFAULT_CONFIG, help="screening_rank_v1 YAML")
    ap.add_argument(
        "--legacy-scores",
        action="store_true",
        help="Forward to screening_rank_v1 --legacy-scores",
    )
    args = ap.parse_args()

    cmd = [
        sys.executable,
        str(REPO_ROOT / "scripts" / "screening_rank_v1.py"),
        "--out",
        str(args.out.resolve()),
        "--top",
        str(int(args.top)),
        "--config",
        str(args.config.resolve()),
    ]
    if args.legacy_scores:
        cmd.append("--legacy-scores")

    r = subprocess.run(cmd, cwd=str(REPO_ROOT))
    raise SystemExit(r.returncode)


if __name__ == "__main__":
    main()
