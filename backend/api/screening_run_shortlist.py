"""
Read-only shortlist for persisted screening runs: good Layer 2 fits from public.screening_run_companies.

No screening logic — queries DB only.
"""
from __future__ import annotations

import csv
import io
import logging
import os
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field

from ..services.db_factory import get_database_service
from .dependencies import get_current_user_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/screening-runs", tags=["screening-runs"])


def _require_user(request: Request) -> str:
    uid = get_current_user_id(request)
    if uid:
        return uid
    if os.getenv("REQUIRE_AUTH", "false").lower() not in ("true", "1", "yes"):
        return "00000000-0000-0000-0000-000000000001"
    raise HTTPException(401, "Authentication required")


def _require_postgres() -> None:
    if os.getenv("DATABASE_SOURCE", "postgres").lower() != "postgres":
        raise HTTPException(503, "DATABASE_SOURCE must be postgres for screening run shortlist")


# Confidence: stored in raw_row_json (layer2_jsonl / layer2_csv), same paths as scripts/screening_run_review_html.py.
# Many persisted runs omit `confidence_bucket` unless layer2_confidence_buckets enrich ran before persist.
# Inference when stored bucket is empty (aligns with layer2_confidence_buckets.py where possible):
# - high_confidence: pages_fetched_count > 0 (numeric in JSON or text), OR fit_confidence >= 0.75 on the row
# - tavily_triage: zero pages, tavily_used truthy, non-empty reason_summary (zero-page triage case)
_EXTRACTED_CTE = """
WITH raw AS (
  SELECT
    c.company_name,
    c.orgnr,
    c.rank,
    c.layer1_total_score,
    c.layer2_fit_confidence,
    c.raw_row_json,
    c.layer2_classification_json,
    COALESCE(
      NULLIF(TRIM(COALESCE(
        c.raw_row_json->'layer2_jsonl'->>'confidence_bucket',
        c.raw_row_json->'layer2_csv'->>'confidence_bucket',
        ''
      )), ''),
      ''
    ) AS stored_bucket,
    GREATEST(
      COALESCE(
        CASE
          WHEN jsonb_typeof(c.raw_row_json->'layer2_jsonl'->'pages_fetched_count') = 'number'
          THEN (c.raw_row_json->'layer2_jsonl'->'pages_fetched_count')::text::double precision
          ELSE 0::double precision
        END,
        0::double precision
      ),
      COALESCE(
        CASE
          WHEN jsonb_typeof(c.raw_row_json->'layer2_csv'->'pages_fetched_count') = 'number'
          THEN (c.raw_row_json->'layer2_csv'->'pages_fetched_count')::text::double precision
          ELSE 0::double precision
        END,
        0::double precision
      ),
      COALESCE(
        CASE
          WHEN COALESCE(
            NULLIF(TRIM(COALESCE(
              c.raw_row_json->'layer2_jsonl'->>'pages_fetched_count',
              c.raw_row_json->'layer2_csv'->>'pages_fetched_count',
              ''
            )), ''),
            '0'
          ) ~ '^[0-9]+(\\.[0-9]+)?$'
          THEN COALESCE(
            NULLIF(TRIM(COALESCE(
              c.raw_row_json->'layer2_jsonl'->>'pages_fetched_count',
              c.raw_row_json->'layer2_csv'->>'pages_fetched_count',
              ''
            )), ''),
            '0'
          )::double precision
          ELSE 0::double precision
        END,
        0::double precision
      )
    ) AS pages_num
  FROM public.screening_run_companies c
  WHERE c.run_id = %s::uuid
    AND c.layer2_is_fit_for_nivo IS TRUE
),
extracted AS (
  SELECT
    r.company_name,
    r.orgnr,
    r.rank AS layer1_rank,
    r.layer1_total_score AS layer1_score,
    r.layer2_fit_confidence,
    COALESCE(
      NULLIF(r.stored_bucket, ''),
      CASE
        WHEN r.pages_num > 0::double precision THEN 'high_confidence'
        WHEN (
          lower(COALESCE(
            r.raw_row_json->'layer2_jsonl'->>'tavily_used',
            r.raw_row_json->'layer2_csv'->>'tavily_used',
            ''
          )) IN ('true', '1', 't')
          AND length(trim(COALESCE(
            NULLIF(r.layer2_classification_json->>'reason_summary', ''),
            r.raw_row_json->'layer2_jsonl'->>'reason_summary',
            r.raw_row_json->'layer2_csv'->>'reason_summary',
            ''
          ))) > 0
          AND r.pages_num <= 0::double precision
        ) THEN 'tavily_triage'
        WHEN r.layer2_fit_confidence IS NOT NULL AND r.layer2_fit_confidence >= 0.75
        THEN 'high_confidence'
        WHEN length(trim(COALESCE(
          NULLIF(r.layer2_classification_json->>'reason_summary', ''),
          r.raw_row_json->'layer2_jsonl'->>'reason_summary',
          r.raw_row_json->'layer2_csv'->>'reason_summary',
          ''
        ))) > 0
        THEN 'high_confidence'
        ELSE ''
      END
    ) AS confidence_bucket,
    COALESCE(
      NULLIF(r.raw_row_json->'layer2_jsonl'->>'homepage_used', ''),
      NULLIF(r.raw_row_json->'layer2_csv'->>'homepage_used', ''),
      ''
    ) AS homepage_used,
    COALESCE(
      NULLIF(r.raw_row_json->'layer2_jsonl'->'likely_first_party_domains'->>0, ''),
      NULLIF(r.raw_row_json->'layer2_csv'->'likely_first_party_domains'->>0, ''),
      ''
    ) AS top_domain,
    LEFT(
      COALESCE(
        NULLIF(r.layer2_classification_json->>'reason_summary', ''),
        NULLIF(r.raw_row_json->'layer2_jsonl'->>'reason_summary', ''),
        NULLIF(r.raw_row_json->'layer2_csv'->>'reason_summary', ''),
        ''
      ),
      240
    ) AS layer2_reason_summary
  FROM raw r
)
"""


class ShortlistRow(BaseModel):
    company_name: Optional[str] = None
    orgnr: str
    layer1_rank: Optional[int] = None
    layer1_score: Optional[float] = None
    layer2_fit_confidence: Optional[float] = None
    confidence_bucket: str = ""
    homepage_used: str = ""
    top_domain: str = ""
    layer2_reason_summary: str = ""


class RunMeta(BaseModel):
    """Row from public.screening_runs for context in the UI."""

    run_id: str
    created_at: Optional[str] = None
    run_kind: Optional[str] = None


class ShortlistStats(BaseModel):
    """Counts for empty-state messaging (read-only aggregates)."""

    fit_true_count_in_run: int = Field(
        0,
        description="Companies in this run with layer2_is_fit_for_nivo = true (before bucket filter).",
    )


class ShortlistResponse(BaseModel):
    run_id: str
    run: Optional[RunMeta] = None
    is_latest_persisted_run: bool = False
    stats: ShortlistStats
    count: int
    rows: List[ShortlistRow]


class LatestRunResponse(BaseModel):
    id: str
    created_at: Optional[str] = None


def _rows_to_models(rows: List[Dict[str, Any]]) -> List[ShortlistRow]:
    out: List[ShortlistRow] = []
    for r in rows:
        out.append(
            ShortlistRow(
                company_name=r.get("company_name"),
                orgnr=str(r.get("orgnr") or ""),
                layer1_rank=r.get("layer1_rank"),
                layer1_score=float(r["layer1_score"]) if r.get("layer1_score") is not None else None,
                layer2_fit_confidence=float(r["layer2_fit_confidence"])
                if r.get("layer2_fit_confidence") is not None
                else None,
                confidence_bucket=str(r.get("confidence_bucket") or ""),
                homepage_used=str(r.get("homepage_used") or ""),
                top_domain=str(r.get("top_domain") or ""),
                layer2_reason_summary=str(r.get("layer2_reason_summary") or ""),
            )
        )
    return out


def _fetch_run_meta(db: Any, run_id: UUID) -> Optional[RunMeta]:
    rows = db.run_raw_query(
        """
        SELECT id, created_at, run_kind
        FROM public.screening_runs
        WHERE id = %s::uuid
        LIMIT 1
        """,
        [str(run_id)],
    )
    if not rows:
        return None
    r = rows[0]
    cid = r.get("id")
    ca = r.get("created_at")
    return RunMeta(
        run_id=str(cid),
        created_at=ca.isoformat() if hasattr(ca, "isoformat") else (str(ca) if ca else None),
        run_kind=str(r["run_kind"]) if r.get("run_kind") is not None else None,
    )


def _count_fit_true_in_run(db: Any, run_id: UUID) -> int:
    rows = db.run_raw_query(
        """
        SELECT COUNT(*)::int AS n
        FROM public.screening_run_companies
        WHERE run_id = %s::uuid
          AND layer2_is_fit_for_nivo IS TRUE
        """,
        [str(run_id)],
    )
    if not rows:
        return 0
    return int(rows[0].get("n") or 0)


def _is_latest_persisted_run(db: Any, run_id: UUID) -> bool:
    rows = db.run_raw_query(
        """
        SELECT id
        FROM public.screening_runs
        ORDER BY created_at DESC NULLS LAST
        LIMIT 1
        """
    )
    if not rows:
        return False
    return str(rows[0].get("id")) == str(run_id)


def _list_sql_and_params(
    run_id: UUID,
    confidence_bucket: Optional[str],
    min_fit_confidence: Optional[float],
    q: Optional[str],
) -> tuple[str, List[Any]]:
    extra: List[str] = []
    params: List[Any] = [str(run_id)]

    if confidence_bucket and confidence_bucket.strip():
        extra.append("confidence_bucket = %s")
        params.append(confidence_bucket.strip())
    if min_fit_confidence is not None:
        extra.append("layer2_fit_confidence >= %s")
        params.append(min_fit_confidence)
    if q and q.strip():
        extra.append("company_name ILIKE %s")
        params.append(f"%{q.strip()}%")

    where_rest = " AND ".join(extra) if extra else "TRUE"
    sql = (
        _EXTRACTED_CTE
        + f"""
SELECT * FROM extracted
WHERE confidence_bucket IN ('high_confidence', 'tavily_triage')
  AND ({where_rest})
ORDER BY
  CASE WHEN confidence_bucket = 'high_confidence' THEN 0 ELSE 1 END,
  layer2_fit_confidence DESC NULLS LAST,
  layer1_score DESC NULLS LAST
"""
    )
    return sql, params


@router.get("/latest", response_model=LatestRunResponse)
async def get_latest_screening_run(request: Request):
    """Most recent row in public.screening_runs (for convenience when opening the shortlist UI)."""
    _require_postgres()
    _require_user(request)
    db = get_database_service()
    rows = db.run_raw_query(
        """
        SELECT id, created_at
        FROM public.screening_runs
        ORDER BY created_at DESC NULLS LAST
        LIMIT 1
        """
    )
    if not rows:
        raise HTTPException(404, "No screening runs found")
    r = rows[0]
    cid = r.get("id")
    ca = r.get("created_at")
    return LatestRunResponse(
        id=str(cid),
        created_at=ca.isoformat() if hasattr(ca, "isoformat") else (str(ca) if ca else None),
    )


@router.get("/{run_id}/shortlist", response_model=ShortlistResponse)
async def get_screening_run_shortlist(
    request: Request,
    run_id: UUID,
    confidence_bucket: Optional[str] = Query(
        None,
        description="Filter by bucket (subset of high_confidence / tavily_triage).",
    ),
    min_fit_confidence: Optional[float] = Query(
        None,
        ge=0.0,
        le=1.0,
        description="Minimum layer2_fit_confidence (0–1).",
    ),
    q: Optional[str] = Query(None, description="Case-insensitive substring match on company_name."),
):
    """
    Good-fit companies for a run: layer2_is_fit_for_nivo = true and effective confidence_bucket in
    ('high_confidence', 'tavily_triage'). Empty stored bucket is inferred as high_confidence when
    pages_fetched_count > 0 (aligns with layer2_confidence_buckets.py). Optional filters on top.
    """
    _require_postgres()
    _require_user(request)
    db = get_database_service()
    sql, params = _list_sql_and_params(run_id, confidence_bucket, min_fit_confidence, q)
    try:
        rows = db.run_raw_query(sql, params)
    except Exception as e:
        logger.warning("shortlist query failed: %s", e)
        raise HTTPException(400, f"Invalid query or run id: {e}") from e

    fit_n = _count_fit_true_in_run(db, run_id)
    return ShortlistResponse(
        run_id=str(run_id),
        run=_fetch_run_meta(db, run_id),
        is_latest_persisted_run=_is_latest_persisted_run(db, run_id),
        stats=ShortlistStats(fit_true_count_in_run=fit_n),
        count=len(rows),
        rows=_rows_to_models(rows),
    )


@router.get("/{run_id}/shortlist/export")
async def export_screening_run_shortlist_csv(
    request: Request,
    run_id: UUID,
    confidence_bucket: Optional[str] = Query(None),
    min_fit_confidence: Optional[float] = Query(None, ge=0.0, le=1.0),
    q: Optional[str] = Query(None),
):
    """Same rows and filters as GET .../shortlist, as CSV."""
    _require_postgres()
    _require_user(request)
    db = get_database_service()
    sql, params = _list_sql_and_params(run_id, confidence_bucket, min_fit_confidence, q)
    try:
        rows = db.run_raw_query(sql, params)
    except Exception as e:
        logger.warning("shortlist export failed: %s", e)
        raise HTTPException(400, f"Invalid query or run id: {e}") from e

    fieldnames = [
        "company_name",
        "orgnr",
        "layer1_rank",
        "layer1_score",
        "layer2_fit_confidence",
        "confidence_bucket",
        "homepage_used",
        "top_domain",
        "layer2_reason_summary",
    ]
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=fieldnames, extrasaction="ignore")
    w.writeheader()
    for r in rows:
        w.writerow({k: r.get(k) for k in fieldnames})

    filename = f"screening_shortlist_{run_id}.csv"
    return Response(
        content=buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
