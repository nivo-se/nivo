"""HTTP fetching wrapper for retrieval sources with retry and resilience."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass

import certifi
import requests

from backend.config import AppSettings

from .types import FetchResult

logger = logging.getLogger(__name__)

_BLOCKED_INDICATORS = [
    "captcha", "challenge", "cf-browser-verification",
    "access denied", "403 forbidden", "blocked",
]

_MAX_RETRIES = 2
_RETRY_BACKOFF_SECONDS = 1.0
_DEFAULT_TIMEOUT = 10


@dataclass(slots=True)
class SourceFetcher:
    """Fetches source documents over HTTP with retry, timeout, and block detection."""

    settings: AppSettings

    def _is_blocked(self, html: str) -> bool:
        lower = html[:5000].lower()
        return any(indicator in lower for indicator in _BLOCKED_INDICATORS)

    def fetch(self, url: str) -> FetchResult:
        timeout = min(self.settings.retrieval_http_timeout_seconds, _DEFAULT_TIMEOUT)
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; NivoDeepResearch/1.0; +https://nivogroup.se)"
        }
        last_error: str | None = None

        for attempt in range(_MAX_RETRIES):
            try:
                response = requests.get(
                    url,
                    headers=headers,
                    timeout=timeout,
                    verify=certifi.where(),
                    allow_redirects=True,
                )
                if response.status_code == 403 or (
                    response.status_code < 400 and response.text and self._is_blocked(response.text)
                ):
                    last_error = f"blocked_or_captcha (HTTP {response.status_code})"
                    logger.warning("Fetch blocked for %s (attempt %d): %s", url, attempt + 1, last_error)
                    if attempt < _MAX_RETRIES - 1:
                        time.sleep(_RETRY_BACKOFF_SECONDS)
                    continue

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
            except requests.exceptions.Timeout:
                last_error = f"timeout after {timeout}s"
                logger.warning("Fetch timeout for %s (attempt %d)", url, attempt + 1)
                if attempt < _MAX_RETRIES - 1:
                    time.sleep(_RETRY_BACKOFF_SECONDS)
            except Exception as exc:
                last_error = str(exc)
                logger.warning("Fetch failed for %s (attempt %d): %s", url, attempt + 1, exc)
                if attempt < _MAX_RETRIES - 1:
                    time.sleep(_RETRY_BACKOFF_SECONDS)

        return FetchResult(
            url=url,
            status_code=0,
            final_url=None,
            html=None,
            error=last_error or "fetch_failed_after_retries",
        )
