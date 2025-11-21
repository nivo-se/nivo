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


def enrich_companies_batch(orgnrs: List[str], force_refresh: bool = False) -> Dict[str, Any]:
    """
    Background job to enrich multiple companies end-to-end.
    """
    job = get_current_job()
    if not job:
        raise RuntimeError("No job context available")

    db = get_database_service()
    supabase = get_supabase_client()
    serpapi = SerpAPIScraper()
    puppeteer = PuppeteerScraper()
    analyzer = AIAnalyzer()

    total = len(orgnrs)
    enriched = 0
    skipped = 0
    errors: List[Dict[str, Any]] = []

    logger.info("Starting enrichment for %s companies (force_refresh=%s)", total, force_refresh)
    job.meta["force_refresh"] = force_refresh
    _update_job_progress(job, 0)

    existing_profiles: Set[str] = set()
    if not force_refresh and orgnrs:
        try:
            response = (
                supabase.table("ai_profiles")
                .select("org_number")
                .in_("org_number", orgnrs)
                .execute()
            )
            if response.data:
                existing_profiles = {
                    row["org_number"] for row in response.data if row.get("org_number")
                }
        except Exception as exc:  # pragma: no cover - best effort
            logger.warning("Failed to fetch existing profiles: %s", exc)

    for i, orgnr in enumerate(orgnrs):
        try:
            if not force_refresh and orgnr in existing_profiles:
                skipped += 1
                continue

            company_rows = db.run_raw_query("SELECT * FROM companies WHERE orgnr = ?", [orgnr])
            if not company_rows:
                raise ValueError("Company not found in local DB")
            company = company_rows[0]

            company_name = company.get("company_name", orgnr)
            website = serpapi.lookup_website(company_name, company.get("homepage"))
            raw_text: Optional[str] = None
            if website:
                raw_text = serpapi.fetch_site_text(website)
                if not raw_text:
                    raw_text = puppeteer.scrape_site_text(website)

            analysis = analyzer.analyze(
                company_name=company_name,
                website=website,
                raw_text=raw_text,
            )

            profile = {
                "org_number": orgnr,
                "website": website,
                **analysis,
                "enrichment_status": "complete",
                "last_updated": datetime.utcnow().isoformat(),
            }
            supabase.table("ai_profiles").upsert(profile, on_conflict="org_number").execute()
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
        "errors": errors,
        "success_rate": enriched / total if total > 0 else 0,
        "completed_at": datetime.utcnow().isoformat(),
    }

    logger.info("Enrichment complete: %s/%s companies enriched (skipped=%s)", enriched, total, skipped)
    return result
