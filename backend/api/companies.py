"""
Company intelligence endpoints
"""
import json
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Path, Query
from pydantic import BaseModel

from ..services.db_factory import get_database_service
from ..services.ai_summary_service import build_ai_summary
from .dependencies import get_supabase_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/companies", tags=["companies"])

AI_INTEL_KINDS = ["company_profile", "website_insights", "about_summary", "llm_analysis"]


def _to_list(value: Any) -> List[str]:
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


class BatchCompanyRequest(BaseModel):
    orgnrs: List[str]


@router.get("/{orgnr}/intel")
async def get_company_intel(orgnr: str = Path(..., description="Organization number")):
    """
    Get all intelligence data for a company.
    Uses DatabaseService (ai_profiles + company_enrichment) when DATABASE_SOURCE=postgres.
    Falls back to Supabase (company_intel, intel_artifacts) when DATABASE_SOURCE=supabase.
    """
    supabase = get_supabase_client()
    if supabase:
        try:
            intel_response = supabase.table("company_intel").select("*").eq("orgnr", orgnr).maybe_single().execute()
            artifacts_response = supabase.table("intel_artifacts").select("*").eq("orgnr", orgnr).order("created_at", desc=True).limit(50).execute()
            intel_data = intel_response.data if intel_response.data else None
            artifacts = artifacts_response.data if artifacts_response.data else []
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

    try:
        db = get_database_service()
        profiles = db.fetch_ai_profiles([orgnr])
        profile = profiles[0] if profiles else None
        enrichment_by_kind = db.fetch_company_enrichment_single(
            orgnr, kinds=AI_INTEL_KINDS, latest_run_only=True
        )

        enrichment = {k: v.get("result") for k, v in enrichment_by_kind.items() if v.get("result")}
        for k in AI_INTEL_KINDS:
            if k not in enrichment:
                enrichment[k] = None

        # Map to CompanyIntel shape for frontend compatibility (intelligenceService.getCompanyIntel)
        tech_stack = []
        if profile and profile.get("scraped_pages"):
            sp = profile["scraped_pages"]
            if isinstance(sp, (list, dict)):
                tech_stack = list(sp) if isinstance(sp, list) else list(sp.keys())
        artifacts = []
        for kind, res in enrichment.items():
            if res and isinstance(res, dict):
                content = json.dumps(res) if res else ""
                meta = enrichment_by_kind.get(kind, {})
                artifacts.append({
                    "id": f"{orgnr}-{kind}",
                    "source": kind,
                    "artifact_type": kind,
                    "url": None,
                    "content": content[:5000] if len(content) > 5000 else content,
                    "created_at": str(meta.get("created_at", "")),
                })
        ai_summary = build_ai_summary(orgnr, profile, enrichment)
        run_id_by_kind = {
            k: str(v.get("run_id")) for k, v in enrichment_by_kind.items()
            if v.get("run_id")
        }
        return {
            "orgnr": orgnr,
            "company_id": None,
            "domain": profile.get("website") if profile else None,
            "industry": profile.get("industry_sector") if profile else None,
            "tech_stack": tech_stack,
            "digital_maturity_score": profile.get("strategic_fit_score") if profile else None,
            "artifacts": artifacts,
            "ai_profile": profile,
            "enrichment": {
                "company_profile": enrichment.get("company_profile"),
                "website_insights": enrichment.get("website_insights"),
                "about_summary": enrichment.get("about_summary"),
                "llm_analysis": enrichment.get("llm_analysis"),
            },
            "ai_summary": ai_summary,
            "run_id_by_kind": run_id_by_kind,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching company intel: {str(e)}")


@router.get("/{orgnr}/ai-report")
async def get_ai_report(orgnr: str = Path(..., description="Organization number")):
    """
    Get latest AI analysis report for a company.

    Uses shared ai_report_service.build_ai_report_from_db (same as POST /generate).
    Falls back to Supabase ai_reports when build returns None and Supabase is configured.
    """
    db = get_database_service()
    if db:
        try:
            from ..services import ai_report_service
            report = ai_report_service.build_ai_report_from_db(orgnr, db, include_extras=True)
            if report is not None:
                return report
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error fetching AI report: {str(e)}")

    # Fallback: Supabase ai_reports when configured
    supabase = get_supabase_client()
    if supabase:
        try:
            response = supabase.table("ai_reports").select("*").eq("orgnr", orgnr).order("generated_at", desc=True).limit(1).execute()
            if response.data and len(response.data) > 0:
                data = response.data[0]
                weaknesses = data.get("weaknesses_json", [])
                if isinstance(weaknesses, dict):
                    weaknesses = list(weaknesses.values())
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

    return {
        "orgnr": orgnr,
        "business_model": None,
        "weaknesses": [],
        "uplift_ops": [],
        "impact_range": None,
        "outreach_angle": None,
    }


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
async def get_companies_batch(
    request: BatchCompanyRequest,
    auto_enrich: bool = True,
    include_ai: bool = False,
):
    """
    Get company details and financial metrics for multiple companies by org numbers.
    Returns company name, revenue, margins, growth, etc.
    
    auto_enrich: Create lightweight profiles for companies without profiles (default True).
    include_ai: Also fetch company_enrichment summary per company (default False, for speed).
    """
    if not request.orgnrs:
        return {"companies": [], "count": 0}
    try:
        db = get_database_service()
        
        # Auto-enrich companies without profiles (lightweight, no scraping)
        if auto_enrich and len(request.orgnrs) <= 50:  # Only for reasonable batch sizes
            try:
                from ..workers.lightweight_enrichment import auto_enrich_search_results
                enrich_result = auto_enrich_search_results(request.orgnrs, max_enrich=50)
                logger.info("Auto-enriched %s companies (lightweight profiles)", enrich_result.get("enriched", 0))
            except Exception as enrich_exc:
                logger.warning("Auto-enrichment failed: %s", enrich_exc)
                # Continue anyway - will just show companies without profiles
        
        placeholders = ",".join("?" for _ in request.orgnrs)
        sql = f"""
            SELECT 
                c.orgnr,
                c.company_name,
                c.homepage,
                c.employees_latest,
                c.segment_names,
                c.nace_categories,
                COALESCE(f.latest_revenue_sek, k.latest_revenue_sek) as latest_revenue_sek,
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
                SELECT f1.orgnr, 
                       COALESCE(f1.si_sek, f1.sdi_sek) as latest_revenue_sek
                FROM financials f1
                INNER JOIN (
                    SELECT orgnr, MAX(year) as latest_year
                    FROM financials
                    WHERE currency = 'SEK' 
                      AND (period = '12' OR period LIKE '%-12')
                      AND year >= 2020
                      AND (si_sek IS NOT NULL OR sdi_sek IS NOT NULL)
                    GROUP BY orgnr
                ) f2 ON f1.orgnr = f2.orgnr AND f1.year = f2.latest_year
                WHERE f1.currency = 'SEK' 
                  AND (f1.period = '12' OR f1.period LIKE '%-12')
            ) f ON f.orgnr = c.orgnr
            WHERE c.orgnr IN ({placeholders})
            ORDER BY COALESCE(f.latest_revenue_sek, k.latest_revenue_sek, 0) DESC, c.company_name ASC
        """
        
        rows = db.run_raw_query(sql, params=request.orgnrs)
        
        ai_profiles_map: Dict[str, Dict[str, Any]] = {}
        enrichment_map: Dict[str, Dict[str, Any]] = {}
        try:
            profiles = db.fetch_ai_profiles(request.orgnrs)
            for profile in profiles:
                orgnr = profile.get("org_number")
                if orgnr:
                    ai_profiles_map[orgnr] = profile
        except Exception as profile_exc:  # pragma: no cover - best-effort
            logger.debug("fetch_ai_profiles failed: %s", profile_exc)
        if include_ai and len(request.orgnrs) <= 50:
            try:
                enrichment_map = db.fetch_company_enrichment(
                    request.orgnrs, kinds=AI_INTEL_KINDS, latest_run_only=True
                )
            except Exception as enrich_exc:  # pragma: no cover - best-effort
                logger.debug("fetch_company_enrichment failed: %s", enrich_exc)
        
        companies = []
        for row in rows:
            profile = ai_profiles_map.get(row.get("orgnr", ""))
            segment_names = _to_list(row.get("segment_names"))
            profile_market_regions = _to_list(profile.get("market_regions")) if profile else []
            profile_risk_flags = _to_list(profile.get("risk_flags")) if profile else []
            profile_next_steps = _to_list(profile.get("next_steps")) if profile else []
            profile_keywords = _to_list(profile.get("industry_keywords")) if profile else []
            scraped_pages = _to_list(profile.get("scraped_pages")) if profile else []

            company_context = None
            if profile:
                company_context = (
                    profile.get("business_summary")
                    or profile.get("product_description")
                    or profile.get("business_model_summary")
                    or profile.get("ai_notes")
                )
            elif segment_names:
                company_context = ", ".join(segment_names[:3])

            ai_fit = profile.get("strategic_fit_score") if profile else None
            ai_fit_status = None
            if isinstance(ai_fit, (int, float)):
                if ai_fit >= 7:
                    ai_fit_status = "YES"
                elif ai_fit <= 4:
                    ai_fit_status = "NO"
                else:
                    ai_fit_status = "UNCLEAR"

            companies.append({
                "orgnr": row.get("orgnr"),
                "company_name": row.get("company_name"),
                "homepage": row.get("homepage"),
                "employees_latest": row.get("employees_latest"),
                "segment_names": segment_names,
                "company_context": company_context,
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
                "ai_strategic_score": profile.get("strategic_fit_score") if profile else None,
                "ai_defensibility_score": profile.get("defensibility_score") if profile else None,
                "ai_product_description": profile.get("product_description") if profile else None,
                "ai_business_model_summary": profile.get("business_model_summary") if profile else None,
                "ai_end_market": profile.get("end_market") if profile else None,
                "ai_customer_types": profile.get("customer_types") if profile else None,
                "ai_value_chain_position": profile.get("value_chain_position") if profile else None,
                "ai_industry_sector": profile.get("industry_sector") if profile else None,
                "ai_industry_subsector": profile.get("industry_subsector") if profile else None,
                "ai_notes": profile.get("ai_notes") if profile else None,
                "ai_profile_last_updated": profile.get("last_updated") if profile else None,
                "ai_profile_website": profile.get("website") if profile else None,
                "ai_business_summary": profile.get("business_summary") if profile else None,
                "ai_market_regions": profile_market_regions,
                "ai_risk_flags": profile_risk_flags,
                "ai_next_steps": profile_next_steps,
                "ai_industry_keywords": profile_keywords,
                "ai_acquisition_angle": profile.get("acquisition_angle") if profile else None,
                "ai_fit_status": ai_fit_status,
                "ai_scraped_pages": scraped_pages,
                "ai_upside_potential": profile.get("upside_potential") if profile else None,
                "ai_fit_rationale": profile.get("fit_rationale") if profile else None,
                "ai_strategic_playbook": profile.get("strategic_playbook") if profile else None,
                "ai_agent_type": profile.get("agent_type") if profile else None,
                "ai_date_scraped": profile.get("date_scraped") if profile else None,
                "has_ai_profile": profile is not None,
                "enrichment_summary": (
                    {k: (v.get("result") if isinstance(v, dict) else None)
                     for k, v in enrichment_map.get(row.get("orgnr", ""), {}).items()}
                    if include_ai else None
                ),
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

