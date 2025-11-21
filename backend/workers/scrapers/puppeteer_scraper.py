from __future__ import annotations

import logging
from typing import Optional

import os
import requests

logger = logging.getLogger(__name__)


class PuppeteerScraper:
    """
    Lightweight HTTP client that talks to a headless scraping worker (Puppeteer/Playwright)
    deployed on Railway. The worker is expected to expose a POST endpoint that accepts a URL
    and returns extracted text.
    """

    def __init__(self, service_url: Optional[str] = None, api_key: Optional[str] = None) -> None:
        base_url = service_url or os.getenv("PUPPETEER_SERVICE_URL", "")
        self.service_url = base_url.rstrip("/") if base_url else ""
        self.api_key = api_key or os.getenv("PUPPETEER_SERVICE_TOKEN")

    def scrape_site_text(self, url: str) -> Optional[str]:
        if not self.service_url:
            logger.info("PUPPETEER_SERVICE_URL not configured, skipping deep scrape for %s", url)
            return None

        payload = {
            "url": url,
            "selectors": ["main", "article", "body"],
            "max_length": 20000,
        }
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"  # simple bearer auth

        try:
            response = requests.post(self.service_url, json=payload, headers=headers, timeout=90)
            response.raise_for_status()
            data = response.json()
            text = data.get("text") or data.get("content") or ""
            cleaned = text.strip()
            if not cleaned:
                return None
            return cleaned[:20000]
        except Exception as exc:  # pragma: no cover - network failure path
            logger.warning("Puppeteer scrape failed for %s: %s", url, exc)
            return None

