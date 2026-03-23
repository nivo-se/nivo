"""
Background worker for company enrichment.

Uses only DB data and direct URL fetch when we already have a URL.
Does not use the scraper service or any external website lookup (no DuckDuckGo/SerpAPI).
Website must come from ai_profiles.website or companies.homepage.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

from rq import get_current_job

from ..services.db_factory import get_database_service
from ..llm.provider_factory import get_llm_provider
from ..workers.ai_analyzer import AIAnalyzer
import certifi
import requests
from bs4 import BeautifulSoup

from ..workers.scrapers.puppeteer_scraper import PuppeteerScraper

logger = logging.getLogger(__name__)


def _fetch_site_text(url: str) -> Optional[str]:
    """Fetch main text from a URL (requests + BeautifulSoup). No 3rd-party search; use only when we already have the URL."""
    try:
        resp = requests.get(url, timeout=30, verify=certifi.where())
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")
        return " ".join(soup.stripped_strings)[:20000]
    except Exception as exc:
        logger.warning("Failed to fetch site content for %s: %s", url, exc)
        return None


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


def _company_profile_kind_result(analysis: Dict[str, Any]) -> Dict[str, Any]:
    """Subset of analyzer output stored as `company_enrichment.kind=company_profile`."""
    keys = (
        "product_description",
        "end_market",
        "customer_types",
        "value_chain_position",
        "business_model_summary",
        "business_summary",
        "industry_sector",
        "industry_subsector",
        "market_regions",
        "industry_keywords",
        "strategic_fit_score",
        "defensibility_score",
        "risk_flags",
        "upside_potential",
        "fit_rationale",
        "acquisition_angle",
        "strategic_playbook",
        "next_steps",
        "ai_notes",
    )
    return {k: analysis[k] for k in keys if k in analysis}


def _website_insights_kind_result(
    website: Optional[str],
    scraped_pages: Dict[str, str],
    analysis: Dict[str, Any],
) -> Dict[str, Any]:
    """Metadata + URL list for `company_enrichment.kind=website_insights`."""
    urls = list((scraped_pages or {}).keys())[:20]
    return {
        "website": website,
        "scraped_page_urls": urls,
        "page_count": len(urls),
        "used_llm": analysis.get("used_llm"),
        "agent_type": analysis.get("agent_type"),
    }


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
    puppeteer = PuppeteerScraper()
    llm_provider = get_llm_provider()
    analyzer = AIAnalyzer(llm_provider=llm_provider)

    total = len(orgnrs)
    enriched = 0
    skipped = 0
    skipped_with_homepage = 0  # Companies that had homepage/website in DB (no external lookup)
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
            # Skip existing ai_profiles only for ad-hoc runs (no run_id). Campaign / API runs
            # pass run_id so we always write company_enrichment rows for that run.
            if not force_refresh and run_id is None and orgnr in existing_profiles:
                skipped += 1
                continue

            company_rows = db.run_raw_query("SELECT * FROM companies WHERE orgnr = ?", [orgnr])
            if not company_rows:
                raise ValueError("Company not found in local DB")
            company = company_rows[0]

            company_name = company.get("company_name", orgnr)
            existing_homepage = company.get("homepage")
            
            # Use only data we have: website from ai_profiles or companies.homepage (no external lookup)
            website = None
            website_source = None
            if orgnr in existing_websites:
                website = existing_websites[orgnr]
                website_source = "ai_profiles"
                skipped_with_homepage += 1
                logger.debug("Using existing website from ai_profiles for %s", company_name)
            elif existing_homepage:
                website = existing_homepage
                website_source = "companies_table"
                skipped_with_homepage += 1
                logger.debug("Using existing homepage from companies table for %s", company_name)
            # If no website in DB, we skip scraping; AI analysis will use only prompt/DB inputs + OpenAI

            scraped_pages: Dict[str, str] = {}
            raw_text: Optional[str] = None
            if website:
                scraped_pages = puppeteer.scrape_multiple_pages(website) or {}
                raw_text = _combine_scraped_pages(scraped_pages)
                if not raw_text:
                    fallback_text = _fetch_site_text(website)
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
            
            try:
                db.upsert_ai_profile(profile)
                logger.info("Saved ai_profile for %s", orgnr)
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
                if "company_profile" in write_kinds:
                    cp_payload = _company_profile_kind_result(analysis)
                    if cp_payload:
                        try:
                            db.upsert_company_enrichment(
                                orgnr=orgnr,
                                run_id=run_id,
                                kind="company_profile",
                                result=cp_payload,
                                score=analysis.get("strategic_fit_score"),
                                tags={"agent_type": analysis.get("agent_type")},
                            )
                        except Exception as ce_exc:
                            logger.warning("Failed to save company_profile enrichment for %s: %s", orgnr, ce_exc)
                if "website_insights" in write_kinds:
                    wi_payload = _website_insights_kind_result(website, scraped_pages, analysis)
                    try:
                        db.upsert_company_enrichment(
                            orgnr=orgnr,
                            run_id=run_id,
                            kind="website_insights",
                            result=wi_payload,
                            score=None,
                            tags={"source": website_source} if website_source else None,
                        )
                    except Exception as ce_exc:
                        logger.warning("Failed to save website_insights enrichment for %s: %s", orgnr, ce_exc)
            
            enriched += 1
            existing_profiles.add(orgnr)
        except Exception as exc:
            logger.exception("Failed to enrich %s", orgnr)
            errors.append({"orgnr": orgnr, "error": str(exc)})

        progress = int(((i + 1) / max(total, 1)) * 100)
        _update_job_progress(job, progress)

    result = {
        "enriched": enriched,
        "total": total,
        "skipped": skipped,
        "skipped_with_homepage": skipped_with_homepage,
        "serpapi_calls": 0,
        "search_calls": 0,
        "serpapi_saved": skipped_with_homepage,
        "errors": errors,
        "success_rate": enriched / total if total > 0 else 0,
        "completed_at": datetime.utcnow().isoformat(),
    }

    logger.info(
        "Enrichment complete: %s/%s companies enriched (skipped=%s, using DB data only, no external lookup)",
        enriched, total, skipped
    )

    if run_id:
        try:
            db.update_enrichment_run_meta(run_id, errors, worker_finished=True)
        except Exception as exc:  # pragma: no cover
            logger.warning("update_enrichment_run_meta failed: %s", exc)

    return result
