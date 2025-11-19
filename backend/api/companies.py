"""
Company intelligence endpoints
"""
from fastapi import APIRouter, HTTPException, Path
from typing import Optional
from .dependencies import get_supabase_client
from supabase import Client

router = APIRouter(prefix="/api/companies", tags=["companies"])


@router.get("/{orgnr}/intel")
async def get_company_intel(orgnr: str = Path(..., description="Organization number")):
    """
    Get all intelligence data for a company.
    Returns company_intel, artifacts, and related data.
    """
    try:
        supabase = get_supabase_client()
        
        # Get company intel
        intel_response = supabase.table("company_intel").select("*").eq("orgnr", orgnr).maybe_single().execute()
        
        # Get artifacts
        artifacts_response = supabase.table("intel_artifacts").select("*").eq("orgnr", orgnr).order("created_at", desc=True).limit(50).execute()
        
        intel_data = intel_response.data if intel_response.data else None
        artifacts = artifacts_response.data if artifacts_response.data else []
        
        # Parse tech stack from JSONB
        tech_stack = []
        if intel_data and intel_data.get("tech_stack_json"):
            tech_stack_json = intel_data["tech_stack_json"]
            if isinstance(tech_stack_json, dict):
                tech_stack = list(tech_stack_json.keys())
            elif isinstance(tech_stack_json, list):
                tech_stack = tech_stack_json
        
        return {
            "orgnr": orgnr,
            "company_id": intel_data.get("company_id") if intel_data else None,
            "domain": intel_data.get("domain") if intel_data else None,
            "industry": intel_data.get("industry") if intel_data else None,
            "tech_stack": tech_stack,
            "digital_maturity_score": intel_data.get("digital_maturity_score") if intel_data else None,
            "artifacts": artifacts,
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching company intel: {str(e)}")


@router.get("/{orgnr}/ai-report")
async def get_ai_report(orgnr: str = Path(..., description="Organization number")):
    """
    Get latest AI analysis report for a company.
    """
    try:
        supabase = get_supabase_client()
        
        response = supabase.table("ai_reports").select("*").eq("orgnr", orgnr).order("generated_at", desc=True).limit(1).execute()
        
        # Get first result if exists
        if not response.data or len(response.data) == 0:
            return {
                "orgnr": orgnr,
                "business_model": None,
                "weaknesses": [],
                "uplift_ops": [],
                "impact_range": None,
                "outreach_angle": None,
            }
        
        data = response.data[0]
        
        # Parse JSONB fields
        weaknesses = data.get("weaknesses_json", [])
        if isinstance(weaknesses, dict):
            weaknesses = list(weaknesses.values()) if isinstance(weaknesses, dict) else []
        elif not isinstance(weaknesses, list):
            weaknesses = []
        
        uplift_ops = data.get("uplift_ops_json", [])
        if not isinstance(uplift_ops, list):
            uplift_ops = []
        
        return {
            "orgnr": orgnr,
            "business_model": data.get("business_model"),
            "weaknesses": weaknesses,
            "uplift_ops": uplift_ops,
            "impact_range": data.get("impact_range"),
            "outreach_angle": data.get("outreach_angle"),
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching AI report: {str(e)}")


@router.post("/{orgnr}/enrich")
async def trigger_enrichment(orgnr: str = Path(..., description="Organization number")):
    """
    Trigger enrichment job for a single company.
    """
    try:
        from .jobs import get_enrichment_queue
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent.parent))
        from workers.enrichment_worker import enrich_companies_batch
        
        queue = get_enrichment_queue()
        
        job = queue.enqueue(
            enrich_companies_batch,
            [orgnr],
            job_timeout='30m',
            job_id=f"enrich_{orgnr}"
        )
        
        return {
            "job_id": job.id,
            "status": "queued",
            "orgnr": orgnr,
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error triggering enrichment: {str(e)}")

