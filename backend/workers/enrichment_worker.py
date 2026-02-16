"""
Background worker for company enrichment
"""

from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

from rq import get_current_job

from ..api.dependencies import get_supabase_client
from ..services.db_factory import get_database_service
from ..llm.provider_factory import get_llm_provider
from ..workers.ai_analyzer import AIAnalyzer
from ..workers.scrapers.puppeteer_scraper import PuppeteerScraper
from ..workers.scrapers.serpapi_scraper import SerpAPIScraper

logger = logging.getLogger(__name__)


def _update_job_progress(job, progress: int) -> None:
    if not job:
        return
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
                   revenue_growth_yoy
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


def enrich_companies_batch(
    orgnrs: List[str],
    force_refresh: bool = False,
    run_id: Optional[str] = None,
    kinds: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Background job to enrich multiple companies end-to-end.
    If run_id is provided (e.g. from POST /api/enrichment/run), uses it; else creates a new run.
    kinds: if set, only write enrichment for these kinds (e.g. ["llm_analysis"]). Worker produces llm_analysis.
    """
    job = get_current_job()

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
    llm_provider = get_llm_provider()
    analyzer = AIAnalyzer(llm_provider=llm_provider)

    total = len(orgnrs)
    enriched = 0
    skipped = 0
    skipped_with_homepage = 0  # Companies that already had homepage (saved SerpAPI call)
    errors: List[Dict[str, Any]] = []

    logger.info("Starting enrichment for %s companies (force_refresh=%s)", total, force_refresh)
    if job:
        job.meta["force_refresh"] = force_refresh
        _update_job_progress(job, 0)

    if not run_id:
        try:
            run_id = db.create_enrichment_run(
                source="enrichment_worker",
                model=os.getenv("OPENAI_MODEL"),
                provider=os.getenv("LLM_PROVIDER", "openai_compat"),
                meta={"batch_size": total},
            )
            if run_id:
                logger.info("Created enrichment run %s", run_id)
        except Exception as run_exc:
            logger.debug("create_enrichment_run failed (tables may not exist): %s", run_exc)

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
        
        else:
            try:
                profiles = db.fetch_ai_profiles(orgnrs)
                for row in profiles:
                    orgnr_val = row.get("org_number")
                    if orgnr_val:
                        existing_profiles.add(orgnr_val)
                        website_val = row.get("website")
                        if website_val:
                            existing_websites[orgnr_val] = website_val
            except Exception as exc:
                logger.debug("fetch_ai_profiles failed: %s", exc)
        # Always check companies table for homepages (persistent cache)
        try:
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

            scraped_timestamp = datetime.utcnow().isoformat()

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
                "business_summary": analysis.get("business_summary"),
                "risk_flags": analysis.get("risk_flags"),
                "upside_potential": analysis.get("upside_potential"),
                "strategic_playbook": analysis.get("strategic_playbook"),
                "next_steps": analysis.get("next_steps"),
                "industry_keywords": analysis.get("industry_keywords"),
                "acquisition_angle": analysis.get("acquisition_angle"),
                "agent_type": analysis.get("agent_type"),
                "scraped_pages": analysis.get("scraped_pages"),
                "fit_rationale": analysis.get("fit_rationale"),
                "enrichment_status": "complete",
                "last_updated": scraped_timestamp,
                "date_scraped": scraped_timestamp,
            }
            
            # Save ai_profile: Supabase when DATABASE_SOURCE=supabase, else DatabaseService
            if supabase:
                try:
                    supabase.table("ai_profiles").upsert(profile, on_conflict="org_number").execute()
                    logger.info("Saved ai_profile to Supabase for %s", orgnr)
                except Exception as supabase_exc:
                    logger.warning("Failed to save to Supabase: %s", supabase_exc)
            else:
                try:
                    db.upsert_ai_profile(profile)
                    logger.info("Saved ai_profile via DatabaseService for %s", orgnr)
                except Exception as db_exc:
                    logger.error("Failed to save ai_profile for %s: %s", orgnr, db_exc)

            if run_id:
                write_kinds = kinds if kinds else ["llm_analysis"]
                if "llm_analysis" in write_kinds:
                    try:
                        db.upsert_company_enrichment(
                            orgnr=orgnr,
                            run_id=run_id,
                            kind="llm_analysis",
                            result=analysis,
                            score=analysis.get("strategic_fit_score"),
                            tags={"agent_type": analysis.get("agent_type")},
                        )
                        logger.debug("Saved company_enrichment for %s (run %s)", orgnr, run_id)
                    except Exception as ce_exc:
                        logger.warning("Failed to save company_enrichment for %s: %s", orgnr, ce_exc)
            
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
