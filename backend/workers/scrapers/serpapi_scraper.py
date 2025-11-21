from __future__ import annotations

import logging
import os
from typing import Optional

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SERP_API_URL = "https://serpapi.com/search.json"


class SerpAPIScraper:
    def __init__(self, api_key: Optional[str] = None) -> None:
        self.api_key = api_key or os.getenv("SERPAPI_KEY")

    def lookup_website(self, company_name: str, fallback: Optional[str] = None) -> Optional[str]:
        if fallback:
            return fallback
        if not self.api_key:
            logger.info("SERPAPI_KEY not set, unable to enrich website for %s", company_name)
            return None
        params = {
            "engine": "google",
            "q": f"{company_name} official site",
            "num": "5",
            "api_key": self.api_key,
        }
        try:
            response = requests.get(SERP_API_URL, params=params, timeout=20)
            response.raise_for_status()
            data = response.json()
            organic = data.get("organic_results") or []
            for result in organic:
                link = result.get("link")
                if link:
                    return link
        except Exception as exc:
            logger.warning("SerpAPI lookup failed for %s: %s", company_name, exc)
        return None

    def fetch_site_text(self, url: str) -> Optional[str]:
        try:
            resp = requests.get(url, timeout=30)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "lxml")
            return " ".join(soup.stripped_strings)[:20000]
        except Exception as exc:
            logger.warning("Failed to fetch site content for %s: %s", url, exc)
            return None

