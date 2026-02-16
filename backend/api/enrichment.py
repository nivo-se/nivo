from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel, Field

from ..services.db_factory import get_database_service
from ..workers.enrichment_worker import enrich_companies_batch
from .dependencies import get_supabase_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/enrichment", tags=["enrichment"])

DEFAULT_ENRICHMENT_KINDS = ["llm_analysis", "company_profile", "website_insights"]


class EnrichmentStartRequest(BaseModel):
    org_numbers: List[str] = Field(..., min_items=1, alias="orgnrs")
    force_refresh: bool = False

    class Config:
        populate_by_name = True


class EnrichmentStartResponse(BaseModel):
    total: int
    enriched: int
    skipped: int
    skipped_with_homepage: int
    serpapi_calls: int
    message: str


class StrategicEvaluationResponse(BaseModel):
    orgnr: str
    strategic_fit_score: Optional[int] = None
    defensibility_score: Optional[int] = None
    business_summary: Optional[str] = None
    acquisition_angle: Optional[str] = None
    risk_flags: List[str] = []
    upside_potential: Optional[str] = None
    fit_rationale: Optional[str] = None
    strategic_playbook: Optional[str] = None
    next_steps: List[str] = []
    notes: Optional[str] = None


def _load_ai_profile(orgnr: str) -> Optional[Dict[str, Any]]:
    supabase = None
    try:
        supabase = get_supabase_client()
    except Exception:
        supabase = None

    if supabase:
        try:
            response = (
                supabase.table("ai_profiles")
                .select("*")
                .eq("org_number", orgnr)
                .maybe_single()
                .execute()
            )
            if response.data:
                return response.data
        except Exception as exc:
            logger.debug("Supabase ai_profile lookup failed: %s", exc)

    db = get_database_service()
    try:
        rows = db.run_raw_query(
            """
            SELECT *
            FROM ai_profiles
            WHERE org_number = ?
            LIMIT 1
            """,
            [orgnr],
        )
        if rows:
            return rows[0]
    except Exception as exc:
        logger.debug("Local ai_profile lookup failed: %s", exc)
    return None


def _as_list(value: Any) -> List[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [str(item) for item in value if item]
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return []
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return [str(item) for item in parsed if item]
        except json.JSONDecodeError:
            pass
        return [item.strip() for item in value.split(",") if item.strip()]
    return [str(value)]


@router.post("/start", response_model=EnrichmentStartResponse)
async def start_enrichment(request: EnrichmentStartRequest) -> EnrichmentStartResponse:
    org_numbers = request.org_numbers
    if not org_numbers:
        raise HTTPException(status_code=400, detail="No organization numbers provided.")

    try:
        result = enrich_companies_batch(org_numbers, force_refresh=request.force_refresh)
    except Exception as exc:
        logger.exception("Enrichment failed")
        raise HTTPException(status_code=500, detail=f"Failed to start enrichment: {exc}") from exc

    message = (
        f"Enrichment complete for {result.get('enriched', 0)} of {result.get('total', len(org_numbers))} companies."
    )
    return EnrichmentStartResponse(
        total=result.get("total", len(org_numbers)),
        enriched=result.get("enriched", 0),
        skipped=result.get("skipped", 0),
        skipped_with_homepage=result.get("skipped_with_homepage", 0),
        serpapi_calls=result.get("serpapi_calls", 0),
        message=message,
    )


class EnrichmentRunRequest(BaseModel):
    """Request to run batch enrichment"""
    orgnrs: Optional[List[str]] = None
    list_id: Optional[str] = None
    kinds: Optional[List[str]] = Field(default=None, description="Enrichment kinds to produce (default: llm_analysis, company_profile, website_insights)")


class EnrichmentRunResponse(BaseModel):
    """Response from batch enrichment run"""
    run_id: str
    queued_count: int
    job_id: Optional[str] = None


class EnrichmentRunStatusResponse(BaseModel):
    """Status of an enrichment run"""
    run_id: str
    counts_by_kind: Dict[str, int]
    completed: int
    failed: int
    failures: List[Dict[str, Any]] = []


def _resolve_orgnrs(db, orgnrs: Optional[List[str]], list_id: Optional[str]) -> List[str]:
    """Resolve orgnrs from explicit list or saved_company_lists by list_id."""
    if orgnrs and len(orgnrs) > 0:
        return [str(o).strip() for o in orgnrs if str(o).strip()]
    if list_id:
        try:
            if db.table_exists("saved_company_lists"):
                rows = db.run_raw_query(
                    "SELECT companies FROM saved_company_lists WHERE id = ? LIMIT 1",
                    [list_id],
                )
                if rows and rows[0].get("companies"):
                    raw = rows[0]["companies"]
                    if isinstance(raw, list):
                        out = []
                        for item in raw:
                            if isinstance(item, dict) and item.get("orgnr"):
                                out.append(str(item["orgnr"]))
                            elif isinstance(item, str):
                                out.append(item.strip())
                        return out
        except Exception as exc:
            logger.warning("Failed to resolve list_id %s: %s", list_id, exc)
    return []


@router.post("/run", response_model=EnrichmentRunResponse)
async def run_enrichment(request: EnrichmentRunRequest) -> EnrichmentRunResponse:
    """
    Create enrichment run and enqueue batch to RQ. Returns immediately with run_id and job_id.
    Poll GET /run/{run_id}/status for progress.
    """
    db = get_database_service()
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")

    orgnrs = _resolve_orgnrs(db, request.orgnrs, request.list_id)
    if not orgnrs:
        raise HTTPException(status_code=400, detail="Provide orgnrs or list_id with companies")

    kinds = request.kinds or DEFAULT_ENRICHMENT_KINDS
    batch = orgnrs[:500]

    run_id = db.create_enrichment_run(
        source="enrichment-run-api",
        provider="openai_compat",
        meta={"orgnrs": batch, "kinds": kinds},
    )
    if not run_id:
        raise HTTPException(status_code=500, detail="Failed to create enrichment run")

    try:
        from .jobs import get_enrichment_queue

        queue = get_enrichment_queue()
        job = queue.enqueue(
            enrich_companies_batch,
            batch,
            force_refresh=False,
            run_id=run_id,
            kinds=kinds,
            job_timeout="2h",
            job_id=f"enrich_{run_id[:8]}_{hash(tuple(batch)) % 10000}",
        )
        logger.info("Enrichment run %s enqueued (job %s): %d companies, kinds=%s", run_id, job.id, len(batch), kinds)
        return EnrichmentRunResponse(run_id=run_id, queued_count=len(batch), job_id=job.id)
    except (ConnectionError, OSError) as exc:
        logger.warning("Job queue unavailable, falling back to synchronous run: %s", exc)
    except Exception as exc:
        logger.warning("Failed to enqueue enrichment job, falling back to sync: %s", exc)

    # Fallback: run synchronously when queue unavailable
    try:
        result = enrich_companies_batch(batch, force_refresh=False, run_id=run_id, kinds=kinds)
        errors = result.get("errors", [])
        if errors:
            db.update_enrichment_run_meta(run_id, errors)
        logger.info(
            "Enrichment run %s complete (sync): enriched=%d, errors=%d",
            run_id, result.get("enriched", 0), len(errors),
        )
    except Exception as exc:
        logger.exception("Enrichment run %s failed", run_id)
        raise HTTPException(status_code=500, detail=f"Enrichment failed: {exc}") from exc

    return EnrichmentRunResponse(run_id=run_id, queued_count=len(batch))


@router.get("/run/{run_id}/status", response_model=EnrichmentRunStatusResponse)
async def get_enrichment_run_status(run_id: str) -> EnrichmentRunStatusResponse:
    """Get status of an enrichment run: counts by kind, completed, failed."""
    db = get_database_service()
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")

    if not db.table_exists("company_enrichment"):
        failures = []
        if db.table_exists("enrichment_runs"):
            run_rows = db.run_raw_query("SELECT meta FROM enrichment_runs WHERE id = ? LIMIT 1", [run_id])
            if run_rows and run_rows[0].get("meta"):
                meta = run_rows[0]["meta"]
                failures = meta.get("failures", []) if isinstance(meta, dict) else []
        return EnrichmentRunStatusResponse(run_id=run_id, counts_by_kind={}, completed=0, failed=len(failures), failures=failures or [])

    # Count by kind for this run
    rows = db.run_raw_query(
        "SELECT kind, COUNT(*) as cnt FROM company_enrichment WHERE run_id = ? GROUP BY kind",
        [run_id],
    )
    counts_by_kind = {str(r["kind"]): int(r["cnt"]) for r in rows}

    # Completed = distinct orgnrs with at least one row
    completed_rows = db.run_raw_query(
        "SELECT COUNT(DISTINCT orgnr) as cnt FROM company_enrichment WHERE run_id = ?",
        [run_id],
    )
    completed = int(completed_rows[0]["cnt"]) if completed_rows else 0

    # Failed + failures from meta
    failed = 0
    failures: List[Dict[str, Any]] = []
    run_rows = db.run_raw_query(
        "SELECT meta FROM enrichment_runs WHERE id = ? LIMIT 1",
        [run_id],
    )
    if run_rows and run_rows[0].get("meta"):
        meta = run_rows[0]["meta"]
        if isinstance(meta, dict):
            failures = meta.get("failures") or []
            failed = len(failures)
            if not failures and meta.get("orgnrs"):
                total_in_batch = len(meta["orgnrs"])
                failed = max(0, total_in_batch - completed)

    return EnrichmentRunStatusResponse(
        run_id=run_id,
        counts_by_kind=counts_by_kind,
        completed=completed,
        failed=failed,
        failures=failures or [],
    )


@router.post("/evaluate/{orgnr}", response_model=StrategicEvaluationResponse)
async def evaluate_company(orgnr: str = Path(..., description="Organization number")) -> StrategicEvaluationResponse:
    try:
        enrich_companies_batch([orgnr], force_refresh=True)
    except Exception as exc:
        logger.exception("Strategic evaluation failed for %s", orgnr)
        raise HTTPException(status_code=500, detail=f"Failed to evaluate company: {exc}") from exc

    profile = _load_ai_profile(orgnr)
    if not profile:
        raise HTTPException(status_code=404, detail="AI profile not found after evaluation.")

    return StrategicEvaluationResponse(
        orgnr=orgnr,
        strategic_fit_score=profile.get("strategic_fit_score"),
        defensibility_score=profile.get("defensibility_score"),
        business_summary=profile.get("business_summary") or profile.get("business_model_summary"),
        acquisition_angle=profile.get("acquisition_angle"),
        risk_flags=_as_list(profile.get("risk_flags")),
        upside_potential=profile.get("upside_potential"),
        fit_rationale=profile.get("fit_rationale"),
        strategic_playbook=profile.get("strategic_playbook"),
        next_steps=_as_list(profile.get("next_steps")),
        notes=profile.get("ai_notes"),
    )

