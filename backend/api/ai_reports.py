"""
AI Report generation endpoints
"""
from fastapi import APIRouter, HTTPException, Path, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, Dict, Any
from .dependencies import get_supabase_client
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from agentic_pipeline.ai_reports import AIReportGenerator, AIReport
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai-reports", tags=["ai-reports"])


class GenerateReportRequest(BaseModel):
    """Request to generate AI report"""
    orgnr: str
    force_regenerate: bool = False


async def generate_and_save_report(orgnr: str, supabase, report_generator: AIReportGenerator):
    """Background task to generate and save AI report"""
    try:
        # Fetch company data
        company_response = supabase.table("companies").select(
            "orgnr, company_id, company_name, segment_names, homepage, email"
        ).eq("orgnr", orgnr).maybe_single().execute()
        
        if not company_response.data:
            logger.error(f"Company not found: {orgnr}")
            return
        
        company = company_response.data
        
        # Fetch metrics
        metrics_response = supabase.table("company_metrics").select(
            "orgnr, latest_revenue_sek, revenue_cagr_3y, avg_ebitda_margin, avg_net_margin, "
            "companies!inner(employees_latest)"
        ).eq("orgnr", orgnr).maybe_single().execute()
        
        # Fetch intel (if available)
        intel_response = supabase.table("company_intel").select("*").eq("orgnr", orgnr).maybe_single().execute()
        
        # Build company data dict
        metrics = metrics_response.data if metrics_response.data else {}
        company_data = {
            "orgnr": orgnr,
            "company_id": company.get("company_id"),
            "company_name": company.get("company_name", "Unknown"),
            "segment_name": company.get("segment_names"),
            "revenue": metrics.get("latest_revenue_sek") or 0,
            "revenue_growth": metrics.get("revenue_cagr_3y") or 0,
            "ebit_margin": metrics.get("avg_ebitda_margin") or 0,
            "net_margin": metrics.get("avg_net_margin") or 0,
            "employees": metrics.get("companies", {}).get("employees_latest") or 0,
        }
        
        intel_data = intel_response.data if intel_response.data else None
        
        # Generate report
        report = report_generator.generate_report(orgnr, company_data, intel_data)
        
        # Save to database
        supabase.table("ai_reports").upsert({
            "orgnr": report.orgnr,
            "company_id": report.company_id,
            "business_model": report.business_model,
            "weaknesses_json": report.weaknesses,
            "uplift_ops_json": report.uplift_ops,
            "impact_range": report.impact_range,
            "outreach_angle": report.outreach_angle,
            "model_version": report_generator.model,
        }, on_conflict="orgnr").execute()
        
        logger.info(f"Generated and saved AI report for {orgnr}")
        
    except Exception as e:
        logger.error(f"Error generating report for {orgnr}: {e}", exc_info=True)


@router.post("/generate")
async def generate_report(
    request: GenerateReportRequest,
    background_tasks: BackgroundTasks
):
    """
    Generate AI report for a company.
    Runs in background and saves to database.
    """
    try:
        supabase = get_supabase_client()
        
        # Check if report already exists
        if not request.force_regenerate:
            existing = supabase.table("ai_reports").select("orgnr").eq("orgnr", request.orgnr).maybe_single().execute()
            if existing.data:
                return {
                    "status": "exists",
                    "message": "Report already exists. Use force_regenerate=true to regenerate.",
                    "orgnr": request.orgnr,
                }
        
        # Generate report in background
        report_generator = AIReportGenerator()
        background_tasks.add_task(generate_and_save_report, request.orgnr, supabase, report_generator)
        
        return {
            "status": "generating",
            "message": "AI report generation started in background",
            "orgnr": request.orgnr,
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error starting report generation: {str(e)}")


@router.post("/generate-batch")
async def generate_reports_batch(
    orgnrs: list[str],
    background_tasks: BackgroundTasks
):
    """
    Generate AI reports for multiple companies.
    """
    try:
        supabase = get_supabase_client()
        report_generator = AIReportGenerator()
        
        for orgnr in orgnrs:
            background_tasks.add_task(generate_and_save_report, orgnr, supabase, report_generator)
        
        return {
            "status": "generating",
            "message": f"Started generating reports for {len(orgnrs)} companies",
            "count": len(orgnrs),
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error starting batch generation: {str(e)}")

