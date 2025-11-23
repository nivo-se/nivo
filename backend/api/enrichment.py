from __future__ import annotations

import hashlib
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel, Field
from rq.job import Job

from .dependencies import get_supabase_client
from .jobs import get_enrichment_queue
from ..workers.enrichment_worker import enrich_companies_batch

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/enrichment", tags=["enrichment"])


class EnrichmentStartRequest(BaseModel):
    org_numbers: List[str] = Field(..., min_length=1, max_length=500)
    force_refresh: bool = False


class EnrichmentStartResponse(BaseModel):
    job_id: Optional[str]
    status: str
    count: int
    skipped: int = 0
    queued_org_numbers: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


@router.post("/start", response_model=EnrichmentStartResponse)
async def start_enrichment(request: EnrichmentStartRequest) -> EnrichmentStartResponse:
    queue = get_enrichment_queue()
    
    # Supabase is optional - try to get client, but continue without it
    supabase = None
    try:
        supabase = get_supabase_client()
    except (ValueError, Exception) as supabase_exc:
        logger.info("Supabase not configured (%s) - enrichment will use local SQLite fallback", supabase_exc)

    if not request.org_numbers:
        raise HTTPException(status_code=400, detail="org_numbers cannot be empty")

    existing_profiles: Set[str] = set()
    if not request.force_refresh:
        # Check Supabase first (if available)
        if supabase:
            try:
                response = (
                    supabase.table("ai_profiles")
                    .select("org_number")
                    .in_("org_number", request.org_numbers)
                    .execute()
                )
                if response.data:
                    existing_profiles = {
                        row["org_number"] for row in response.data if row.get("org_number")
                    }
            except Exception as exc:  # pragma: no cover - best effort
                logger.warning("Failed to read existing AI profiles from Supabase: %s", exc)
        
        # Also check local SQLite (fallback)
        try:
            from ..services.db_factory import get_database_service
            db = get_database_service()
            # Check if ai_profiles table exists
            check_table = db.run_raw_query(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='ai_profiles'"
            )
            if check_table:
                placeholders = ",".join("?" * len(request.org_numbers))
                local_profiles = db.run_raw_query(
                    f"SELECT org_number FROM ai_profiles WHERE org_number IN ({placeholders})",
                    request.org_numbers
                )
                for row in local_profiles:
                    org_val = row.get("org_number")
                    if org_val and org_val not in existing_profiles:
                        existing_profiles.add(org_val)
        except Exception as exc:  # pragma: no cover - best effort
            logger.debug("Local ai_profiles check failed (table may not exist yet): %s", exc)

    orgs_to_process = (
        request.org_numbers
        if request.force_refresh
        else [org for org in request.org_numbers if org not in existing_profiles]
    )
    skipped = len(request.org_numbers) - len(orgs_to_process)

    if not orgs_to_process:
        return EnrichmentStartResponse(
            job_id=None,
            status="skipped",
            count=0,
            skipped=skipped,
            queued_org_numbers=[],
            metadata={
                "force_refresh": request.force_refresh,
                "queued_at": datetime.utcnow().isoformat(),
                "reason": "already_enriched",
            },
        )

    job_id = f"enrich_{len(orgs_to_process)}_{hashlib.md5('-'.join(orgs_to_process).encode()).hexdigest()[:8]}"
    try:
        job = queue.enqueue(
            enrich_companies_batch,
            orgs_to_process,
            request.force_refresh,
            job_timeout="2h",
            job_id=job_id,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to enqueue enrichment job: {exc}")

    return EnrichmentStartResponse(
        job_id=job.id,
        status=job.get_status(),
        count=len(orgs_to_process),
        skipped=skipped,
        queued_org_numbers=orgs_to_process,
        metadata={
            "force_refresh": request.force_refresh,
            "queued_at": datetime.utcnow().isoformat(),
        },
    )


@router.get("/status/{job_id}")
async def enrichment_status(job_id: str = Path(..., description="Enrichment job ID")):
    queue = get_enrichment_queue()
    job: Optional[Job] = queue.fetch_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    status = job.get_status()
    response = {
        "job_id": job.id,
        "status": status,
        "progress": job.meta.get("progress", 0),
    }
    if status == "finished":
        result = job.result
        response["result"] = result
        # Include SerpAPI usage stats if available
        if isinstance(result, dict):
            response["serpapi_usage"] = {
                "calls_made": result.get("serpapi_calls", 0),
                "calls_saved": result.get("serpapi_saved", 0),
                "skipped_with_homepage": result.get("skipped_with_homepage", 0),
            }
            # Add quota warning if approaching limit
            calls_made = result.get("serpapi_calls", 0)
            if calls_made > 200:
                response["serpapi_usage"]["quota_warning"] = (
                    f"⚠️  {calls_made} SerpAPI calls used. Free tier: 250/month. "
                    "Consider upgrading or using smaller batches."
                )
            elif calls_made > 0:
                remaining = 250 - calls_made
                response["serpapi_usage"]["quota_info"] = (
                    f"ℹ️  {calls_made} calls used. ~{remaining} remaining this month (free tier)."
                )
    elif status == "failed":
        response["error"] = str(job.exc_info) if job.exc_info else "Unknown error"
    return response


@router.get("/recent")
async def list_recent_jobs(limit: int = 10):
    queue = get_enrichment_queue()
    jobs = queue.get_jobs(offset=0, length=limit)
    return {
        "jobs": [
            {
                "job_id": job.id,
                "status": job.get_status(),
                "created_at": job.created_at.isoformat() if job.created_at else None,
            }
            for job in jobs
        ]
    }

