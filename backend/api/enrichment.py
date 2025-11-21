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
    supabase = get_supabase_client()

    if not request.org_numbers:
        raise HTTPException(status_code=400, detail="org_numbers cannot be empty")

    existing_profiles: Set[str] = set()
    if not request.force_refresh:
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
            logger.warning("Failed to read existing AI profiles: %s", exc)

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
        response["result"] = job.result
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

