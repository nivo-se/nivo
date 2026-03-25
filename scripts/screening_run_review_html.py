#!/usr/bin/env python3
"""
Emit a minimal HTML table to review companies for a persisted screening run.

Reads public.screening_run_companies for a given screening_run_id (UUID).

Example:
  PYTHONPATH=. python3 scripts/screening_run_review_html.py \\
    --screening-run-id 2e6135e8-3f22-49ca-9e77-cb97b7fa5290 \\
    --out /tmp/screening_review.html
"""

from __future__ import annotations

import argparse
import html
import os
import sys
import uuid
from pathlib import Path
from typing import Any, List, Optional, Tuple

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None  # type: ignore[misc, assignment]


def _load_dotenv() -> None:
    if load_dotenv:
        load_dotenv(REPO_ROOT / ".env")
        load_dotenv(REPO_ROOT / "backend" / ".env", override=False)


def connect_pg():
    import psycopg2

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


def esc(s: Any) -> str:
    if s is None:
        return ""
    return html.escape(str(s), quote=True)


def homepage_cell(url: Optional[str]) -> str:
    u = (url or "").strip()
    if not u:
        return ""
    if u.lower().startswith(("http://", "https://")):
        return f'<a href="{esc(u)}">{esc(u)}</a>'
    return esc(u)


def fit_cell(fit: Any, conf: Any) -> str:
    parts = []
    if fit is not None:
        parts.append("fit" if fit else "no fit")
    else:
        parts.append("—")
    if conf is not None:
        try:
            parts.append(f"({float(conf):.2f})")
        except (TypeError, ValueError):
            parts.append(f"({conf!s})")
    return " ".join(parts) if parts else "—"


SQL_FETCH = """
SELECT
  c.orgnr,
  c.company_name,
  COALESCE(
    NULLIF(c.raw_row_json->'layer2_jsonl'->>'homepage_used', ''),
    NULLIF(c.raw_row_json->'layer2_csv'->>'homepage_used', ''),
    ''
  ) AS homepage_used,
  COALESCE(
    NULLIF(c.raw_row_json->'layer2_jsonl'->>'confidence_bucket', ''),
    NULLIF(c.raw_row_json->'layer2_csv'->>'confidence_bucket', ''),
    ''
  ) AS confidence_bucket,
  c.layer1_total_score,
  c.layer2_is_fit_for_nivo,
  c.layer2_fit_confidence,
  COALESCE(
    NULLIF(c.layer2_classification_json->>'reason_summary', ''),
    NULLIF(c.raw_row_json->'layer2_jsonl'->>'reason_summary', ''),
    ''
  ) AS reason_summary
FROM public.screening_run_companies c
WHERE c.run_id = %s::uuid
ORDER BY c.rank ASC NULLS LAST, c.layer1_total_score DESC NULLS LAST
LIMIT 100
"""


def main() -> int:
    _load_dotenv()
    ap = argparse.ArgumentParser(description="HTML review table for a screening run")
    ap.add_argument("--screening-run-id", type=str, required=True, help="UUID of screening_runs.id")
    ap.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Output HTML path (default: screening_run_<id>_review.html in cwd)",
    )
    args = ap.parse_args()

    try:
        uuid.UUID(args.screening_run_id)
    except ValueError:
        print(f"Invalid UUID: {args.screening_run_id}", file=sys.stderr)
        return 2

    try:
        import psycopg2
    except ImportError:
        print("psycopg2-binary is required.", file=sys.stderr)
        return 1

    out_path = args.out
    if out_path is None:
        safe = args.screening_run_id.replace("-", "")[:12]
        out_path = Path.cwd() / f"screening_run_{safe}_review.html"

    conn = connect_pg()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM public.screening_runs WHERE id = %s::uuid",
                (args.screening_run_id,),
            )
            if cur.fetchone() is None:
                print(f"No screening_runs row for id={args.screening_run_id}", file=sys.stderr)
                return 2
            cur.execute(SQL_FETCH, (args.screening_run_id,))
            rows: List[Tuple[Any, ...]] = list(cur.fetchall())
    finally:
        conn.close()

    thead = (
        "<thead><tr>"
        "<th>company_name</th>"
        "<th>homepage_used</th>"
        "<th>confidence_bucket</th>"
        "<th>layer1_score</th>"
        "<th>layer2_fit / confidence</th>"
        "<th>reason_summary</th>"
        "<th>review</th>"
        "</tr></thead>"
    )

    body_rows: List[str] = []
    for (
        orgnr,
        company_name,
        homepage_used,
        confidence_bucket,
        layer1_score,
        l2_fit,
        l2_conf,
        reason_summary,
    ) in rows:
        org_esc = esc(orgnr)
        body_rows.append(
            "<tr>"
            f'<td>{esc(company_name)}</td>'
            f"<td>{homepage_cell(homepage_used)}</td>"
            f'<td>{esc(confidence_bucket) if confidence_bucket else "—"}</td>'
            f"<td>{esc(layer1_score) if layer1_score is not None else '—'}</td>"
            f"<td>{esc(fit_cell(l2_fit, l2_conf))}</td>"
            f'<td>{esc(reason_summary)}</td>'
            f'<td><select name="review_{org_esc}" data-orgnr="{org_esc}">'
            '<option value="">—</option>'
            "<option>GOOD</option>"
            "<option>MAYBE</option>"
            "<option>BAD</option>"
            "</select></td>"
            "</tr>"
        )

    html_doc = (
        "<!DOCTYPE html>\n<html><head><meta charset=\"utf-8\"/>"
        f"<title>Screening run {esc(args.screening_run_id)}</title></head><body>\n"
        f"<h1>Screening run <code>{esc(args.screening_run_id)}</code></h1>\n"
        f"<p>Rows: {len(rows)} (max 100)</p>\n"
        "<table border=\"1\" cellpadding=\"4\" cellspacing=\"0\">\n"
        f"{thead}\n<tbody>\n"
        + "\n".join(body_rows)
        + "\n</tbody></table>\n</body></html>\n"
    )

    out_path.write_text(html_doc, encoding="utf-8")
    print(str(out_path.resolve()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
