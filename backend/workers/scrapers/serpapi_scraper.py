from __future__ import annotations

import logging
import os
from typing import Dict, List, Optional

from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SERP_API_URL = "https://serpapi.com/search.json"


class SerpAPIScraper:
    def __init__(self, api_key: Optional[str] = None) -> None:
        self.api_key = api_key or os.getenv("SERPAPI_KEY")
        self.api_call_count = 0  # Track API usage
        self._cache: Dict[str, Optional[str]] = {}  # In-memory cache for this instance

    def lookup_website(self, company_name: str, fallback: Optional[str] = None) -> Optional[str]:
        """
        Look up company website using SerpAPI.
        
        Optimization:
        - Returns fallback immediately if provided (saves API call)
        - Uses in-memory cache to avoid duplicate lookups
        - Tracks API call count for quota monitoring
        """
        # If we already have a homepage, skip SerpAPI entirely
        if fallback:
            logger.debug("Using existing homepage for %s (skipping SerpAPI)", company_name)
            return fallback
        
        # Check cache first
        cache_key = company_name.lower().strip()
        if cache_key in self._cache:
            logger.debug("Using cached website lookup for %s", company_name)
            return self._cache[cache_key]
        
        # If no API key, can't lookup
        if not self.api_key:
            logger.info("SERPAPI_KEY not set, unable to enrich website for %s", company_name)
            self._cache[cache_key] = None
            return None
        
        # Make SerpAPI call
        params = {
            "engine": "google",
            "q": f"{company_name} official site",
            "num": "5",
            "api_key": self.api_key,
        }
        try:
            self.api_call_count += 1
            logger.info("SerpAPI lookup #%d: %s", self.api_call_count, company_name)
            response = requests.get(SERP_API_URL, params=params, timeout=20)
            response.raise_for_status()
            data = response.json()
            organic = data.get("organic_results") or []
            for result in organic:
                link = result.get("link")
                if link:
                    self._cache[cache_key] = link
                    return link
            # No results found
            self._cache[cache_key] = None
            return None
        except Exception as exc:
            logger.warning("SerpAPI lookup failed for %s: %s", company_name, exc)
            self._cache[cache_key] = None
            return None
    
    def get_api_call_count(self) -> int:
        """Get the number of SerpAPI calls made by this instance."""
        return self.api_call_count

    def fetch_site_text(self, url: str) -> Optional[str]:
        try:
            resp = requests.get(url, timeout=30)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "lxml")
            return " ".join(soup.stripped_strings)[:20000]
        except Exception as exc:
            logger.warning("Failed to fetch site content for %s: %s", url, exc)
            return None

    def extract_sitemap_urls(self, website: str, limit: int = 15) -> List[str]:
        """
        Attempt to fetch sitemap URLs for a company website to seed the scraping pipeline.
        Returns up to `limit` URLs discovered via sitemap.xml or sitemap_index.xml.
        """
        base_url = self._normalize_base_url(website)
        if not base_url:
            return []

        candidate_paths = ["sitemap.xml", "sitemap_index.xml"]
        discovered: List[str] = []

        for path in candidate_paths:
            sitemap_url = urljoin(f"{base_url}/", path)
            try:
                resp = requests.get(sitemap_url, timeout=20)
                if resp.status_code >= 400:
                    continue
                soup = BeautifulSoup(resp.text, "xml")
                for node in soup.find_all("loc"):
                    loc_text = (node.text or "").strip()
                    if not loc_text:
                        continue
                    discovered.append(loc_text)
                    if len(discovered) >= limit:
                        return discovered
            except Exception as exc:  # pragma: no cover - network dependent
                logger.debug("Sitemap lookup failed for %s (%s): %s", website, path, exc)
                continue
        return discovered

    @staticmethod
    def _normalize_base_url(website: Optional[str]) -> Optional[str]:
        if not website:
            return None
        website = website.strip()
        if not website:
            return None
        if not website.startswith(("http://", "https://")):
            website = f"https://{website}"
        return website.rstrip("/")

