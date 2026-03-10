"""Tavily API client wrapper for web intelligence layer.

Encapsulates Search and Extract; retries, timeouts, result normalization.
Agents must not call Tavily directly.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any

import certifi
import requests

from backend.config import get_settings

logger = logging.getLogger(__name__)

TAVILY_SEARCH_URL = "https://api.tavily.com/search"
TAVILY_EXTRACT_URL = "https://api.tavily.com/extract"

DEFAULT_MAX_RETRIES = 2


@dataclass(slots=True)
class TavilySearchResult:
    """Normalized search result from Tavily."""

    url: str
    title: str
    content: str | None
    score: float | None
    metadata: dict = field(default_factory=dict)


@dataclass(slots=True)
class TavilyExtractResult:
    """Normalized extract result from Tavily."""

    url: str
    raw_content: str
    failed: bool = False
    metadata: dict = field(default_factory=dict)


class TavilyClient:
    """Tavily API client with retries, timeout, and normalized results."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        timeout_seconds: int | None = None,
    ) -> None:
        settings = get_settings()
        self.api_key = api_key or settings.tavily_api_key
        self.timeout_seconds = timeout_seconds or settings.retrieval_http_timeout_seconds

    def search(
        self,
        query: str,
        max_results: int = 5,
        topic: str = "general",
        search_depth: str = "basic",
    ) -> list[TavilySearchResult]:
        """Search Tavily; return normalized results. Empty list if no API key."""
        if not self.api_key:
            logger.debug("Tavily API key not configured, skipping search")
            return []

        payload = {
            "api_key": self.api_key,
            "query": query,
            "max_results": max_results,
            "search_depth": search_depth,
            "include_raw_content": False,
        }
        if topic:
            payload["topic"] = topic

        t0 = time.monotonic()
        for attempt in range(DEFAULT_MAX_RETRIES + 1):
            try:
                response = requests.post(
                    TAVILY_SEARCH_URL,
                    json=payload,
                    timeout=self.timeout_seconds,
                    verify=certifi.where(),
                )
                if response.status_code in (429, 500, 502, 503):
                    if attempt < DEFAULT_MAX_RETRIES:
                        backoff = 2**attempt
                        logger.warning(
                            "Tavily search %s (attempt %d), retrying in %ds",
                            response.status_code,
                            attempt + 1,
                            backoff,
                        )
                        time.sleep(backoff)
                        continue
                response.raise_for_status()
                data = response.json()
                results = data.get("results") or []
                elapsed = time.monotonic() - t0
                logger.info(
                    "Tavily search query=%r results=%d latency_ms=%d",
                    query[:60],
                    len(results),
                    int(elapsed * 1000),
                )
                return [
                    TavilySearchResult(
                        url=(r.get("url") or "").strip(),
                        title=(r.get("title") or "Untitled").strip(),
                        content=r.get("content"),
                        score=r.get("score"),
                        metadata={"raw": r},
                    )
                    for r in results
                    if (r.get("url") or "").strip()
                ][:max_results]
            except requests.RequestException as e:
                logger.warning("Tavily search failed: %s", e)
                if attempt < DEFAULT_MAX_RETRIES:
                    time.sleep(2**attempt)
                    continue
                return []
        return []

    def extract(
        self,
        urls: str | list[str],
        query: str | None = None,
        chunks_per_source: int = 3,
        extract_depth: str = "basic",
    ) -> list[TavilyExtractResult]:
        """Extract content from URLs. Empty list if no API key or invalid input."""
        if not self.api_key:
            logger.debug("Tavily API key not configured, skipping extract")
            return []

        url_list = [urls] if isinstance(urls, str) else list(urls)
        if not url_list:
            return []

        payload: dict[str, Any] = {
            "api_key": self.api_key,
            "urls": url_list[:20],
            "extract_depth": extract_depth,
        }
        if query:
            payload["query"] = query
            payload["chunks_per_source"] = min(5, max(1, chunks_per_source))

        t0 = time.monotonic()
        for attempt in range(DEFAULT_MAX_RETRIES + 1):
            try:
                response = requests.post(
                    TAVILY_EXTRACT_URL,
                    json=payload,
                    timeout=min(60, self.timeout_seconds * 2),
                    verify=certifi.where(),
                )
                if response.status_code in (429, 500, 502, 503):
                    if attempt < DEFAULT_MAX_RETRIES:
                        time.sleep(2**attempt)
                        continue
                response.raise_for_status()
                data = response.json()
                results = data.get("results") or []
                failed_list = data.get("failed_results") or []
                failed_urls = {f.get("url") for f in failed_list if f.get("url")}
                elapsed = time.monotonic() - t0
                logger.info(
                    "Tavily extract urls=%d success=%d failed=%d latency_ms=%d",
                    len(url_list),
                    len(results),
                    len(failed_urls),
                    int(elapsed * 1000),
                )
                out: list[TavilyExtractResult] = []
                for r in results:
                    url = r.get("url") or ""
                    out.append(
                        TavilyExtractResult(
                            url=url,
                            raw_content=r.get("raw_content") or "",
                            failed=url in failed_urls,
                            metadata={"response": r},
                        )
                    )
                for furl in failed_urls:
                    if not any(o.url == furl for o in out):
                        out.append(
                            TavilyExtractResult(url=furl, raw_content="", failed=True)
                        )
                return out
            except requests.RequestException as e:
                logger.warning("Tavily extract failed: %s", e)
                if attempt < DEFAULT_MAX_RETRIES:
                    time.sleep(2**attempt)
                    continue
                return []
