"""
Company intelligence endpoints
"""
from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel
from typing import Optional, List
from .dependencies import get_supabase_client
from ..services.db_factory import get_database_service
from supabase import Client

router = APIRouter(prefix="/api/companies", tags=["companies"])


class BatchCompanyRequest(BaseModel):
    orgnrs: List[str]


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


@router.post("/batch")
async def get_companies_batch(request: BatchCompanyRequest):
    """
    Get company details and financial metrics for multiple companies by org numbers.
    Returns company name, revenue, margins, growth, etc.
    """
    try:
        db = get_database_service()
        
        # Build query to get companies with their KPIs and actual revenue from financials
        # Use financials table for revenue (more accurate than KPI table which uses incomplete 2024 data)
        placeholders = ",".join("?" for _ in request.orgnrs)
        sql = f"""
            SELECT 
                c.orgnr,
                c.company_name,
                c.homepage,
                c.employees_latest,
                COALESCE(f.max_revenue_sek, k.latest_revenue_sek) as latest_revenue_sek,
                k.latest_profit_sek,
                k.latest_ebitda_sek,
                k.avg_ebitda_margin,
                k.avg_net_margin,
                k.revenue_cagr_3y,
                k.revenue_growth_yoy,
                k.company_size_bucket,
                k.growth_bucket,
                k.profitability_bucket
            FROM companies c
            LEFT JOIN company_kpis k ON k.orgnr = c.orgnr
            LEFT JOIN (
                SELECT orgnr, MAX(sdi_sek) as max_revenue_sek
                FROM financials
                WHERE currency = 'SEK' 
                  AND (period = '12' OR period LIKE '%-12')
                  AND year >= 2020
                  AND sdi_sek IS NOT NULL
                GROUP BY orgnr
            ) f ON f.orgnr = c.orgnr
            WHERE c.orgnr IN ({placeholders})
            ORDER BY COALESCE(f.max_revenue_sek, k.latest_revenue_sek, 0) DESC, c.company_name ASC
        """
        
        rows = db.run_raw_query(sql, params=request.orgnrs)
        
        # Convert to list of dicts
        companies = []
        for row in rows:
            companies.append({
                "orgnr": row.get("orgnr"),
                "company_name": row.get("company_name"),
                "homepage": row.get("homepage"),
                "employees_latest": row.get("employees_latest"),
                "latest_revenue_sek": row.get("latest_revenue_sek"),
                "latest_profit_sek": row.get("latest_profit_sek"),
                "latest_ebitda_sek": row.get("latest_ebitda_sek"),
                "avg_ebitda_margin": row.get("avg_ebitda_margin"),
                "avg_net_margin": row.get("avg_net_margin"),
                "revenue_cagr_3y": row.get("revenue_cagr_3y"),
                "revenue_growth_yoy": row.get("revenue_growth_yoy"),
                "company_size_bucket": row.get("company_size_bucket"),
                "growth_bucket": row.get("growth_bucket"),
                "profitability_bucket": row.get("profitability_bucket"),
            })
        
        return {"companies": companies, "count": len(companies)}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching companies: {str(e)}")


@router.get("/{orgnr}/financials")
async def get_company_financials(orgnr: str = Path(..., description="Organization number")):
    """
    Get historical financial data for a company (multiple years).
    Returns revenue, profit, EBIT, EBITDA, and margins for each year.
    """
    try:
        db = get_database_service()
        
        # Get historical financial data from financials table
        # IMPORTANT: Use correct account codes per allabolag_account_code_mapping.json
        # - Revenue: SI (Nettoomsättning) preferred, SDI fallback
        # - EBIT: resultat_e_avskrivningar (Rörelseresultat efter avskrivningar) - DO NOT use RG!
        # - EBITDA: EBITDA preferred, ORS fallback
        sql = """
            SELECT 
                year,
                COALESCE(si_sek, sdi_sek) as revenue_sek,
                dr_sek as profit_sek,
                resultat_e_avskrivningar_sek as ebit_sek,  -- DO NOT fallback to RG (it's working capital!)
                COALESCE(ebitda_sek, ors_sek) as ebitda_sek,
                period
            FROM financials
            WHERE orgnr = ?
              AND currency = 'SEK'
              AND (period = '12' OR period LIKE '%-12')
              AND year >= 2020
            ORDER BY year DESC
            LIMIT 5
        """
        
        rows = db.run_raw_query(sql, params=[orgnr])
        
        # Calculate margins for each year
        financials = []
        for row in rows:
            revenue = row.get("revenue_sek")
            profit = row.get("profit_sek")
            ebit = row.get("ebit_sek")
            ebitda = row.get("ebitda_sek")
            
            # Calculate margins
            net_margin = (profit / revenue * 100) if revenue and revenue > 0 and profit is not None else None
            ebit_margin = (ebit / revenue * 100) if revenue and revenue > 0 and ebit is not None else None
            ebitda_margin = (ebitda / revenue * 100) if revenue and revenue > 0 and ebitda is not None else None
            
            financials.append({
                "year": row.get("year"),
                "revenue_sek": revenue,
                "profit_sek": profit,
                "ebit_sek": ebit,
                "ebitda_sek": ebitda,
                "net_margin": net_margin,
                "ebit_margin": ebit_margin,
                "ebitda_margin": ebitda_margin,
            })
        
        return {"financials": financials, "count": len(financials)}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching financials: {str(e)}")

