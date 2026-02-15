"""
Background job endpoints for enrichment and AI analysis
"""
from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from rq import Queue
from rq.job import Job
from .dependencies import get_redis_client
import redis

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


class EnrichmentRequest(BaseModel):
    """Request to trigger enrichment for companies"""
    orgnrs: List[str]


def get_enrichment_queue() -> Queue:
    """Get enrichment job queue"""
    redis_conn = get_redis_client()
    return Queue('enrichment', connection=redis_conn)


def get_ai_analysis_queue() -> Queue:
    """Get AI analysis job queue"""
    redis_conn = get_redis_client()
    return Queue('ai_analysis', connection=redis_conn)


@router.post("/enrich")
async def trigger_enrichment_batch(request: EnrichmentRequest):
    """
    Trigger enrichment job for multiple companies.
    Returns job_id for status tracking.
    """
    try:
        queue = get_enrichment_queue()
        
        # For now, use a mock worker function
        # This will be replaced with actual enrichment logic later
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent.parent))
        from workers.enrichment_worker import enrich_companies_batch
        
        job = queue.enqueue(
            enrich_companies_batch,
            request.orgnrs,
            job_timeout='2h',
            job_id=f"enrich_{len(request.orgnrs)}_{hash(tuple(request.orgnrs)) % 10000}"
        )
        
        return {
            "job_id": job.id,
            "status": "queued",
            "companies_count": len(request.orgnrs),
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error queuing enrichment job: {str(e)}")


@router.get("/{job_id}")
async def get_job_status(job_id: str = Path(..., description="Job ID")):
    """
    Get status of a background job.
    """
    try:
        # Try enrichment queue first
        queue = get_enrichment_queue()
        job = queue.fetch_job(job_id)
        
        # If not found, try AI analysis queue
        if not job:
            queue = get_ai_analysis_queue()
            job = queue.fetch_job(job_id)
        
        if not job:
            raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
        
        status = job.get_status()
        
        response = {
            "job_id": job.id,
            "status": status,
            "progress": job.meta.get("progress", 0) if status in ["started", "queued"] else 100,
        }
        
        if status == "finished":
            response["result"] = job.result
        elif status == "failed":
            response["error"] = str(job.exc_info) if job.exc_info else "Unknown error"
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching job status: {str(e)}")


@router.get("/")
async def list_jobs(
    queue_name: Optional[str] = None,
    limit: int = 10
):
    """
    List recent jobs from queues.
    """
    try:
        jobs = []
        
        if queue_name == "enrichment" or queue_name is None:
            queue = get_enrichment_queue()
            for job in queue.get_jobs(offset=0, length=limit):
                jobs.append({
                    "job_id": job.id,
                    "status": job.get_status(),
                    "created_at": job.created_at.isoformat() if job.created_at else None,
                })
        
        if queue_name == "ai_analysis" or queue_name is None:
            queue = get_ai_analysis_queue()
            for job in queue.get_jobs(offset=0, length=limit):
                jobs.append({
                    "job_id": job.id,
                    "status": job.get_status(),
                    "created_at": job.created_at.isoformat() if job.created_at else None,
                })
        
        return {"jobs": jobs[:limit]}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing jobs: {str(e)}")

