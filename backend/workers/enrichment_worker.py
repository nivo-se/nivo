"""
Background worker for company enrichment
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

from rq import get_current_job

from ..api.dependencies import get_supabase_client
from ..services.db_factory import get_database_service
from ..workers.ai_analyzer import AIAnalyzer
from ..workers.scrapers.puppeteer_scraper import PuppeteerScraper
from ..workers.scrapers.serpapi_scraper import SerpAPIScraper

logger = logging.getLogger(__name__)


def _update_job_progress(job, progress: int) -> None:
    job.meta["progress"] = progress
    job.save_meta()


def _fetch_financial_snapshot(db, orgnr: str) -> Dict[str, Any]:
    """
    Fetch key KPIs for prompt context (best effort fallback).
    """
    try:
        rows = db.run_raw_query(
            """
            SELECT latest_revenue_sek,
                   avg_ebitda_margin,
                   avg_net_margin,
                   revenue_cagr_3y,
                   revenue_growth_yoy,
                   employee_count
            FROM company_kpis
            WHERE orgnr = ?
            """,
            [orgnr],
        )
        return rows[0] if rows else {}
    except Exception as exc:  # pragma: no cover - best effort
        logger.warning("Failed to fetch KPI snapshot for %s: %s", orgnr, exc)
        return {}


def _combine_scraped_pages(pages: Dict[str, str], limit: int = 12000) -> Optional[str]:
    if not pages:
        return None
    snippets = []
    for idx, text in enumerate(pages.values()):
        if idx >= 5:
            break
        if text:
            snippets.append(text[:2000])
    combined = "\n\n".join(snippets)
    return combined[:limit] if combined else None


def enrich_companies_batch(orgnrs: List[str], force_refresh: bool = False) -> Dict[str, Any]:
    """
    Background job to enrich multiple companies end-to-end.
    """
    job = get_current_job()
    if not job:
        raise RuntimeError("No job context available")

    db = get_database_service()
    
    # Supabase is optional - try to get client, but continue without it
    supabase = None
    try:
        supabase = get_supabase_client()
        logger.info("Supabase client initialized - ai_profiles will be saved to Supabase")
    except (ValueError, Exception) as supabase_exc:
        logger.warning("Supabase not configured (%s) - will save to local SQLite as fallback", supabase_exc)
        # Will save to local SQLite instead
    
    serpapi = SerpAPIScraper()
    puppeteer = PuppeteerScraper()
    analyzer = AIAnalyzer()

    total = len(orgnrs)
    enriched = 0
    skipped = 0
    skipped_with_homepage = 0  # Companies that already had homepage (saved SerpAPI call)
    errors: List[Dict[str, Any]] = []

    logger.info("Starting enrichment for %s companies (force_refresh=%s)", total, force_refresh)
    job.meta["force_refresh"] = force_refresh
    _update_job_progress(job, 0)

    # Check existing profiles and websites to avoid duplicate work
    existing_profiles: Set[str] = set()
    existing_websites: Dict[str, str] = {}  # orgnr -> website
    if not force_refresh and orgnrs:
        # Check Supabase first (if available)
        if supabase:
            try:
                profile_response = (
                    supabase.table("ai_profiles")
                    .select("org_number, website")
                    .in_("org_number", orgnrs)
                    .execute()
                )
                if profile_response.data:
                    for row in profile_response.data:
                        orgnr_val = row.get("org_number")
                        if orgnr_val:
                            existing_profiles.add(orgnr_val)
                            website_val = row.get("website")
                            if website_val:
                                existing_websites[orgnr_val] = website_val
            except Exception as exc:  # pragma: no cover - best effort
                logger.warning("Failed to fetch existing profiles from Supabase: %s", exc)
        
        # Also check local SQLite for ai_profiles (fallback storage)
        try:
            # Check if ai_profiles table exists in local DB
            check_table = db.run_raw_query(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='ai_profiles'"
            )
            if check_table:
                placeholders = ",".join("?" * len(orgnrs))
                local_profiles = db.run_raw_query(
                    f"SELECT org_number, website FROM ai_profiles WHERE org_number IN ({placeholders})",
                    orgnrs
                )
                for row in local_profiles:
                    orgnr_val = row.get("org_number")
                    if orgnr_val and orgnr_val not in existing_profiles:
                        existing_profiles.add(orgnr_val)
                        website_val = row.get("website")
                        if website_val and orgnr_val not in existing_websites:
                            existing_websites[orgnr_val] = website_val
                            logger.debug("Found existing profile in local SQLite for %s", orgnr_val)
        except Exception as exc:  # pragma: no cover - best effort
            logger.debug("Local ai_profiles table not found or error: %s", exc)
            
            # Also check companies table for homepages (persistent cache)
            # This ensures we never search for companies we've already found
            if orgnrs:
                placeholders = ",".join("?" * len(orgnrs))
                companies_with_homepages = db.run_raw_query(
                    f"SELECT orgnr, homepage FROM companies WHERE orgnr IN ({placeholders}) AND homepage IS NOT NULL AND homepage != ''",
                    orgnrs
                )
                for row in companies_with_homepages:
                    orgnr_val = row.get("orgnr")
                    homepage_val = row.get("homepage")
                    if orgnr_val and homepage_val and orgnr_val not in existing_websites:
                        existing_websites[orgnr_val] = homepage_val
                        logger.debug("Found existing homepage in companies table for %s", orgnr_val)
        except Exception as exc:  # pragma: no cover - best effort
            logger.warning("Failed to fetch existing profiles: %s", exc)

    for i, orgnr in enumerate(orgnrs):
        try:
            # Skip if profile already exists (unless force_refresh)
            if not force_refresh and orgnr in existing_profiles:
                skipped += 1
                continue

            company_rows = db.run_raw_query("SELECT * FROM companies WHERE orgnr = ?", [orgnr])
            if not company_rows:
                raise ValueError("Company not found in local DB")
            company = company_rows[0]

            company_name = company.get("company_name", orgnr)
            existing_homepage = company.get("homepage")
            
            # Get website - prioritize existing sources to save SerpAPI calls
            # Priority: 1) existing ai_profiles.website, 2) companies.homepage, 3) SerpAPI lookup
            website = None
            website_source = None  # Track where we got the website from
            if orgnr in existing_websites:
                website = existing_websites[orgnr]
                website_source = "ai_profiles"
                skipped_with_homepage += 1
                logger.debug("Using existing website from ai_profiles for %s", company_name)
            elif existing_homepage:
                website = existing_homepage
                website_source = "companies_table"
                skipped_with_homepage += 1
                logger.debug("Using existing homepage from companies table for %s (saved SerpAPI call)", company_name)
            else:
                # No existing website - lookup via SerpAPI
                website = serpapi.lookup_website(company_name, None)
                if website:
                    website_source = "serpapi"
                    # CRITICAL: Save discovered website to companies table so we never search again
                    try:
                        db.run_raw_query(
                            "UPDATE companies SET homepage = ? WHERE orgnr = ?",
                            [website, orgnr]
                        )
                        logger.info("💾 Saved discovered website to companies table: %s -> %s", company_name, website)
                    except Exception as db_exc:
                        logger.warning("Failed to save website to companies table for %s: %s", orgnr, db_exc)
                        # Continue anyway - we'll still save to ai_profiles
            
            scraped_pages: Dict[str, str] = {}
            raw_text: Optional[str] = None
            if website:
                scraped_pages = puppeteer.scrape_multiple_pages(website) or {}
                raw_text = _combine_scraped_pages(scraped_pages)
                if not raw_text:
                    fallback_text = serpapi.fetch_site_text(website)
                    if fallback_text:
                        scraped_pages = {website: fallback_text}
                        raw_text = fallback_text[:8000]

            financial_metrics = _fetch_financial_snapshot(db, orgnr)

            analysis = analyzer.analyze(
                company_name=company_name,
                website=website,
                raw_text=raw_text,
                scraped_pages=scraped_pages,
                financial_metrics=financial_metrics,
            )

            profile = {
                "org_number": orgnr,
                "website": website,
                "product_description": analysis.get("product_description"),
                "end_market": analysis.get("end_market"),
                "customer_types": analysis.get("customer_types"),
                "strategic_fit_score": analysis.get("strategic_fit_score"),
                "defensibility_score": analysis.get("defensibility_score"),
                "value_chain_position": analysis.get("value_chain_position"),
                "ai_notes": analysis.get("ai_notes"),
                "industry_sector": analysis.get("industry_sector"),
                "industry_subsector": analysis.get("industry_subsector"),
                "market_regions": analysis.get("market_regions"),
                "business_model_summary": analysis.get("business_model_summary"),
                "risk_flags": analysis.get("risk_flags"),
                "upside_potential": analysis.get("upside_potential"),
                "strategic_playbook": analysis.get("strategic_playbook"),
                "next_steps": analysis.get("next_steps"),
                "agent_type": analysis.get("agent_type"),
                "scraped_pages": analysis.get("scraped_pages"),
                "fit_rationale": analysis.get("fit_rationale"),
                "enrichment_status": "complete",
                "last_updated": datetime.utcnow().isoformat(),
            }
            
            # Save to Supabase if available, otherwise save to local SQLite
            saved_to = None
            if supabase:
                try:
                    supabase.table("ai_profiles").upsert(profile, on_conflict="org_number").execute()
                    saved_to = "supabase"
                    logger.info("Saved ai_profile to Supabase for %s", orgnr)
                except Exception as supabase_exc:
                    logger.warning("Failed to save to Supabase, falling back to local DB: %s", supabase_exc)
                    saved_to = None  # Will try local fallback
            
            # Fallback to local SQLite if Supabase not available or failed
            if not saved_to:
                try:
                    # Ensure ai_profiles table exists in local DB
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
                    
                    # Insert or update profile
                    db.run_raw_query("""
                        INSERT OR REPLACE INTO ai_profiles (
                            org_number, website, product_description, end_market, customer_types,
                            strategic_fit_score, defensibility_score, value_chain_position, ai_notes,
                            industry_sector, industry_subsector, market_regions, business_model_summary,
                            risk_flags, upside_potential, strategic_playbook, next_steps,
                            agent_type, scraped_pages, fit_rationale, enrichment_status, last_updated
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, [
                        profile["org_number"],
                        profile.get("website"),
                        profile.get("product_description"),
                        profile.get("end_market"),
                        profile.get("customer_types"),
                        profile.get("strategic_fit_score"),
                        profile.get("defensibility_score"),
                        profile.get("value_chain_position"),
                        profile.get("ai_notes"),
                        profile.get("industry_sector"),
                        profile.get("industry_subsector"),
                        str(profile.get("market_regions")) if profile.get("market_regions") else None,  # JSON as string
                        profile.get("business_model_summary"),
                        str(profile.get("risk_flags")) if profile.get("risk_flags") else None,  # JSON as string
                        profile.get("upside_potential"),
                        profile.get("strategic_playbook"),
                        str(profile.get("next_steps")) if profile.get("next_steps") else None,  # JSON as string
                        profile.get("agent_type"),
                        str(profile.get("scraped_pages")) if profile.get("scraped_pages") else None,  # JSON as string
                        profile.get("fit_rationale"),
                        profile.get("enrichment_status", "complete"),
                        profile.get("last_updated"),
                    ])
                    saved_to = "local_sqlite"
                    logger.info("💾 Saved ai_profile to local SQLite for %s (Supabase not available)", orgnr)
                except Exception as local_exc:
                    logger.error("Failed to save ai_profile to local SQLite for %s: %s", orgnr, local_exc)
                    # Continue anyway - at least website is saved
            
            # Also ensure website is saved to companies table (in case it wasn't saved earlier)
            if website and not existing_homepage:
                try:
                    db.run_raw_query(
                        "UPDATE companies SET homepage = ? WHERE orgnr = ? AND (homepage IS NULL OR homepage = '')",
                        [website, orgnr]
                    )
                except Exception as db_exc:
                    logger.debug("Website already saved or update failed for %s: %s", orgnr, db_exc)
            
            enriched += 1
            existing_profiles.add(orgnr)
        except Exception as exc:
            logger.exception("Failed to enrich %s", orgnr)
            errors.append({"orgnr": orgnr, "error": str(exc)})

        progress = int(((i + 1) / max(total, 1)) * 100)
        _update_job_progress(job, progress)

    # Get SerpAPI usage stats
    serpapi_calls = serpapi.get_api_call_count()
    
    result = {
        "enriched": enriched,
        "total": total,
        "skipped": skipped,
        "skipped_with_homepage": skipped_with_homepage,
        "serpapi_calls": serpapi_calls,
        "serpapi_saved": skipped_with_homepage,  # Number of API calls saved by using existing homepages
        "errors": errors,
        "success_rate": enriched / total if total > 0 else 0,
        "completed_at": datetime.utcnow().isoformat(),
    }

    logger.info(
        "Enrichment complete: %s/%s companies enriched (skipped=%s, SerpAPI calls=%s, saved=%s)",
        enriched, total, skipped, serpapi_calls, skipped_with_homepage
    )
    
    # Warn if approaching SerpAPI free tier limit
    if serpapi_calls > 200:
        logger.warning(
            "⚠️  SerpAPI usage: %d calls in this batch. Free tier limit is 250/month. "
            "Consider upgrading or using smaller batches.",
            serpapi_calls
        )
    elif serpapi_calls > 100:
        logger.info(
            "ℹ️  SerpAPI usage: %d calls in this batch. Free tier: 250/month remaining.",
            serpapi_calls
        )
    
    return result
