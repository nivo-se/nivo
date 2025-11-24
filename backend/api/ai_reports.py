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
        from ..services.db_factory import get_database_service
        db = get_database_service()
        
        # 1. Fetch company data & metrics from Local SQLite
        # We join companies and company_metrics (or company_kpis)
        sql = """
        SELECT 
            c.orgnr, c.company_id, c.company_name, c.segment_names, c.homepage, c.employees_latest,
            k.latest_revenue_sek, k.revenue_cagr_3y, k.avg_ebitda_margin, k.avg_net_margin
        FROM companies c
        LEFT JOIN company_kpis k ON k.orgnr = c.orgnr
        WHERE c.orgnr = ?
        """
        rows = db.run_raw_query(sql, params=[orgnr])
        
        if not rows:
            logger.error(f"Company not found in local DB: {orgnr}")
            return
            
        data = rows[0]
        
        # Build company data dict
        company_data = {
            "orgnr": orgnr,
            "company_id": data.get("company_id"),
            "company_name": data.get("company_name", "Unknown"),
            "segment_name": data.get("segment_names"),
            "revenue": data.get("latest_revenue_sek") or 0,
            "revenue_growth": data.get("revenue_cagr_3y") or 0,
            "ebit_margin": data.get("avg_ebitda_margin") or 0,
            "net_margin": data.get("avg_net_margin") or 0,
            "employees": data.get("employees_latest") or 0,
        }
        
        # 2. Fetch enrichment data from Supabase ai_profiles
        # (User calls it ai_profiles, code was using company_intel)
        intel_response = supabase.table("ai_profiles").select("*").eq("org_number", orgnr).maybe_single().execute()
        intel_data = intel_response.data if intel_response.data else None
        
        # Map ai_profiles fields to what generator expects if needed
        # Generator likely expects 'product_description', 'end_market' etc.
        # ai_profiles has these fields.
        
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

