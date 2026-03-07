"""HTTP fetching wrapper for retrieval sources."""

from __future__ import annotations

import logging
from dataclasses import dataclass

import certifi
import requests

from backend.config import AppSettings

from .types import FetchResult

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class SourceFetcher:
    """Fetches source documents over HTTP."""

    settings: AppSettings

    def fetch(self, url: str) -> FetchResult:
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; NivoDeepResearch/1.0; +https://nivogroup.se)"
        }
        try:
            response = requests.get(
                url,
                headers=headers,
                timeout=self.settings.retrieval_http_timeout_seconds,
                verify=certifi.where(),
                allow_redirects=True,
            )
            if response.status_code >= 400:
                return FetchResult(
                    url=url,
                    status_code=response.status_code,
                    final_url=str(response.url),
                    html=None,
                    error=f"HTTP {response.status_code}",
                )
            return FetchResult(
                url=url,
                status_code=response.status_code,
                final_url=str(response.url),
                html=response.text,
                error=None,
            )
        except Exception as exc:  # pragma: no cover - network dependent
            logger.warning("Fetch failed for %s: %s", url, exc)
            return FetchResult(
                url=url,
                status_code=0,
                final_url=None,
                html=None,
                error=str(exc),
            )

