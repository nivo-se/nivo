from __future__ import annotations

import logging
from typing import Dict, List, Optional

from urllib.parse import urljoin

import os
import requests

logger = logging.getLogger(__name__)

DEFAULT_PATH_GROUPS: List[List[str]] = [
    ["/about", "/about-us", "/om-oss", "/omoss"],
    ["/products", "/product", "/solutions", "/losningar"],
    ["/services", "/tjanster", "/offerings"],
    ["/clients", "/customers", "/kunder", "/cases", "/referenser"],
    ["/industries", "/segments", "/marknader"],
    ["/career", "/karriar", "/jobs"],
]
HOMEPAGE_PATH = "/"
MAX_COMBINED_CHARS = 50000


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

    def scrape_multiple_pages(
        self,
        website: str,
        pages: Optional[List[str]] = None,
        max_chars: int = MAX_COMBINED_CHARS,
    ) -> Dict[str, str]:
        """
        Scrape multiple high-signal pages from a company's website.

        Args:
            website: Base website URL (with or without scheme)
            pages: Optional custom list of relative paths to prioritize
            max_chars: Safety cap for combined text payload

        Returns:
            Ordered dict mapping fully qualified URLs -> extracted text
        """

        base_url = self._normalize_base_url(website)
        if not base_url:
            return {}

        ordered_paths: List[str] = []
        if pages:
            ordered_paths.extend(pages)
        else:
            for group in DEFAULT_PATH_GROUPS:
                ordered_paths.extend(group)
        ordered_paths.append(HOMEPAGE_PATH)

        scraped: Dict[str, str] = {}
        total_chars = 0
        seen_paths = set()

        for rel_path in ordered_paths:
            normalized = self._normalize_path(rel_path)
            if normalized in seen_paths:
                continue
            seen_paths.add(normalized)

            full_url = self._build_url(base_url, normalized)
            content = self.scrape_site_text(full_url)
            if not content:
                continue

            scraped[full_url] = content
            total_chars += len(content)

            if total_chars >= max_chars:
                break

        return scraped

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

    @staticmethod
    def _normalize_path(path: Optional[str]) -> str:
        if not path:
            return HOMEPAGE_PATH
        if not path.startswith("/"):
            path = f"/{path}"
        if path != HOMEPAGE_PATH and path.endswith("/"):
            path = path[:-1]
        return path or HOMEPAGE_PATH

    @staticmethod
    def _build_url(base_url: str, path: str) -> str:
        if path in (HOMEPAGE_PATH, ""):
            return base_url
        return urljoin(f"{base_url}/", path.lstrip("/"))

