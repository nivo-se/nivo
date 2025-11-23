"""
Lightweight auto-enrichment for companies in search results.
This creates basic AI profiles without full website scraping - just using company name and available data.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from ..services.db_factory import get_database_service
from ..api.dependencies import get_supabase_client
from .ai_analyzer import AIAnalyzer

logger = logging.getLogger(__name__)


def create_lightweight_profile(
    orgnr: str,
    company_name: str,
    segment_names: Optional[List[str]] = None,
    homepage: Optional[str] = None,
    employees_latest: Optional[int] = None,
    financial_metrics: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Create a lightweight AI profile using only available company data (no scraping).
    This is much faster than full enrichment and provides basic context for search results.
    """
    analyzer = AIAnalyzer()
    
    # Build context from available data
    context_parts = []
    if company_name:
        context_parts.append(f"Company: {company_name}")
    if segment_names:
        context_parts.append(f"Industry segments: {', '.join(segment_names)}")
    if employees_latest:
        context_parts.append(f"Employees: {employees_latest}")
    if financial_metrics:
        revenue = financial_metrics.get("latest_revenue_sek", 0)
        if revenue:
            context_parts.append(f"Revenue: {revenue/1_000_000:.1f} mSEK")
        margin = financial_metrics.get("avg_ebitda_margin")
        if margin:
            context_parts.append(f"EBITDA margin: {margin*100:.1f}%")
    
    context_text = "\n".join(context_parts)
    
    # Use AI to generate basic profile from limited context
    try:
        # Just do content summarization - skip full multi-step analysis
        from .prompt_config import PromptConfig
        prompt_config = PromptConfig(agent_type="default")
        
        summary = analyzer.analyze_content_summary(
            prompt_config,
            {
                "company_name": company_name,
                "website": homepage or "",
                "scraped_pages_excerpt": context_text,
                "financial_overview": json.dumps(financial_metrics or {}, indent=2),
            }
        )
        
        # Also do industry classification
        industry = analyzer.classify_industry(
            prompt_config,
            {
                "company_name": company_name,
                "summary_json": json.dumps(summary.data, indent=2),
                "scraped_pages_excerpt": context_text,
            }
        )
        
        profile = {
            "org_number": orgnr,
            "website": homepage,
            "product_description": summary.data.get("product_description", ""),
            "end_market": summary.data.get("end_market", ""),
            "customer_types": summary.data.get("customer_types", ""),
            "value_chain_position": summary.data.get("value_chain_position", ""),
            "business_model_summary": summary.data.get("business_model_summary", ""),
            "ai_notes": summary.data.get("ai_notes", ""),
            "industry_sector": industry.data.get("industry_sector", ""),
            "industry_subsector": industry.data.get("industry_subsector", ""),
            "market_regions": industry.data.get("market_regions", []),
            "enrichment_status": "lightweight",  # Mark as lightweight (not full enrichment)
            "last_updated": datetime.utcnow().isoformat(),
        }
        
        return profile
        
    except Exception as exc:
        logger.warning("Failed to create lightweight profile for %s: %s", orgnr, exc)
        # Return minimal profile
        return {
            "org_number": orgnr,
            "website": homepage,
            "product_description": None,
            "enrichment_status": "failed",
            "last_updated": datetime.utcnow().isoformat(),
        }


def auto_enrich_search_results(
    org_numbers: List[str],
    max_enrich: int = 50,
) -> Dict[str, Any]:
    """
    Automatically create lightweight profiles for companies in search results.
    Only enriches companies that don't already have profiles.
    
    Args:
        org_numbers: List of company org numbers from search results
        max_enrich: Maximum number of companies to enrich (to avoid too many API calls)
    
    Returns:
        Dict with enrichment stats
    """
    db = get_database_service()
    
    # Supabase is optional
    supabase = None
    try:
        supabase = get_supabase_client()
    except Exception:
        pass  # Will use local SQLite
    
    # Check which companies already have profiles
    existing_profiles: set = set()
    
    # Check Supabase
    if supabase:
        try:
            response = (
                supabase.table("ai_profiles")
                .select("org_number")
                .in_("org_number", org_numbers[:max_enrich])
                .execute()
            )
            if response.data:
                existing_profiles = {p["org_number"] for p in response.data}
        except Exception:
            pass
    
    # Check local SQLite
    try:
        check_table = db.run_raw_query(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='ai_profiles'"
        )
        if check_table:
            placeholders = ",".join("?" * min(len(org_numbers), max_enrich))
            local_profiles = db.run_raw_query(
                f"SELECT org_number FROM ai_profiles WHERE org_number IN ({placeholders})",
                org_numbers[:max_enrich]
            )
            for profile in local_profiles:
                orgnr = profile.get("org_number")
                if orgnr:
                    existing_profiles.add(orgnr)
    except Exception:
        pass
    
    # Get company data for companies that need enrichment
    to_enrich = [org for org in org_numbers[:max_enrich] if org not in existing_profiles]
    
    if not to_enrich:
        return {
            "enriched": 0,
            "skipped": len(org_numbers),
            "reason": "all_already_enriched"
        }
    
    # Fetch company data
    placeholders = ",".join("?" * len(to_enrich))
    companies_data = db.run_raw_query(
        f"""
        SELECT c.orgnr, c.company_name, c.homepage, c.employees_latest, c.segment_names,
               k.latest_revenue_sek, k.avg_ebitda_margin
        FROM companies c
        LEFT JOIN company_kpis k ON k.orgnr = c.orgnr
        WHERE c.orgnr IN ({placeholders})
        """,
        to_enrich
    )
    
    enriched_count = 0
    for company_data in companies_data:
        orgnr = company_data.get("orgnr")
        if not orgnr:
            continue
        
        # Parse segment_names
        segment_names = []
        try:
            seg_raw = company_data.get("segment_names")
            if seg_raw:
                if isinstance(seg_raw, str):
                    segment_names = json.loads(seg_raw) if seg_raw else []
                elif isinstance(seg_raw, list):
                    segment_names = seg_raw
        except Exception:
            pass
        
        financial_metrics = {
            "latest_revenue_sek": company_data.get("latest_revenue_sek"),
            "avg_ebitda_margin": company_data.get("avg_ebitda_margin"),
        }
        
        # Create lightweight profile
        profile = create_lightweight_profile(
            orgnr=orgnr,
            company_name=company_data.get("company_name", orgnr),
            segment_names=segment_names if segment_names else None,
            homepage=company_data.get("homepage"),
            employees_latest=company_data.get("employees_latest"),
            financial_metrics=financial_metrics,
        )
        
        # Save profile (same logic as enrichment_worker)
        saved_to = None
        if supabase:
            try:
                supabase.table("ai_profiles").upsert(profile, on_conflict="org_number").execute()
                saved_to = "supabase"
            except Exception:
                pass
        
        if not saved_to:
            # Save to local SQLite
            try:
                db.run_raw_query("""
                    CREATE TABLE IF NOT EXISTS ai_profiles (
                        org_number TEXT PRIMARY KEY,
                        website TEXT,
                        product_description TEXT,
                        end_market TEXT,
                        customer_types TEXT,
                        strategic_fit_score INTEGER,
                        defensibility_score INTEGER,
                        value_chain_position TEXT,
                        ai_notes TEXT,
                        industry_sector TEXT,
                        industry_subsector TEXT,
                        market_regions TEXT,
                        business_model_summary TEXT,
                        risk_flags TEXT,
                        upside_potential TEXT,
                        strategic_playbook TEXT,
                        next_steps TEXT,
                        agent_type TEXT,
                        scraped_pages TEXT,
                        fit_rationale TEXT,
                        enrichment_status TEXT DEFAULT 'complete',
                        last_updated TEXT
                    )
                """)
                
                db.run_raw_query("""
                    INSERT OR REPLACE INTO ai_profiles (
                        org_number, website, product_description, end_market, customer_types,
                        value_chain_position, ai_notes, industry_sector, industry_subsector,
                        market_regions, business_model_summary, enrichment_status, last_updated
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, [
                    profile["org_number"],
                    profile.get("website"),
                    profile.get("product_description"),
                    profile.get("end_market"),
                    profile.get("customer_types"),
                    profile.get("value_chain_position"),
                    profile.get("ai_notes"),
                    profile.get("industry_sector"),
                    profile.get("industry_subsector"),
                    str(profile.get("market_regions")) if profile.get("market_regions") else None,
                    profile.get("business_model_summary"),
                    profile.get("enrichment_status", "lightweight"),
                    profile.get("last_updated"),
                ])
                saved_to = "local_sqlite"
            except Exception as exc:
                logger.warning("Failed to save lightweight profile to local DB for %s: %s", orgnr, exc)
                continue
        
        enriched_count += 1
    
    return {
        "enriched": enriched_count,
        "skipped": len(org_numbers) - enriched_count,
        "total_checked": len(org_numbers),
    }

