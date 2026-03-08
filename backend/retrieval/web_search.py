"""Search provider wrappers (SerpAPI/Tavily) for retrieval pipeline with dedup."""

from __future__ import annotations

import logging
import re
from collections import defaultdict
from dataclasses import dataclass
from urllib.parse import urlparse

import certifi
import requests

from backend.config import AppSettings

from .types import SearchResult

logger = logging.getLogger(__name__)

SERP_API_URL = "https://serpapi.com/search.json"
TAVILY_API_URL = "https://api.tavily.com/search"

_MAX_PER_DOMAIN = 2


def _root_domain(url: str) -> str:
    """Extract root domain (e.g. 'example.com') from a URL."""
    try:
        host = urlparse(url).hostname or ""
        parts = host.split(".")
        if len(parts) >= 2:
            return ".".join(parts[-2:])
        return host
    except Exception:
        return ""


def _looks_like_url(text: str) -> bool:
    candidate = text.strip().lower()
    if candidate.startswith("http://") or candidate.startswith("https://"):
        return True
    return " " not in candidate and "." in candidate and not candidate.startswith("/")


@dataclass(slots=True)
class SerpApiSearch:
    """SerpAPI wrapper."""

    api_key: str
    timeout_seconds: int = 20

    def search(self, query: str, max_results: int) -> list[SearchResult]:
        params = {
            "engine": "google",
            "q": query,
            "num": str(max_results),
            "api_key": self.api_key,
        }
        response = requests.get(
            SERP_API_URL, params=params, timeout=self.timeout_seconds, verify=certifi.where()
        )
        response.raise_for_status()
        payload = response.json()
        out: list[SearchResult] = []
        for idx, item in enumerate(payload.get("organic_results") or [], start=1):
            url = (item.get("link") or "").strip()
            if not url:
                continue
            out.append(
                SearchResult(
                    title=(item.get("title") or "Untitled").strip(),
                    url=url,
                    snippet=item.get("snippet"),
                    rank=idx,
                    provider="serpapi",
                    metadata={"source": "organic_results"},
                )
            )
            if len(out) >= max_results:
                break
        return out


@dataclass(slots=True)
class TavilySearch:
    """Tavily wrapper."""

    api_key: str
    timeout_seconds: int = 20

    def search(self, query: str, max_results: int) -> list[SearchResult]:
        response = requests.post(
            TAVILY_API_URL,
            json={
                "api_key": self.api_key,
                "query": query,
                "max_results": max_results,
                "search_depth": "basic",
                "include_raw_content": False,
            },
            timeout=self.timeout_seconds,
            verify=certifi.where(),
        )
        response.raise_for_status()
        payload = response.json()
        out: list[SearchResult] = []
        for idx, item in enumerate(payload.get("results") or [], start=1):
            url = (item.get("url") or "").strip()
            if not url:
                continue
            out.append(
                SearchResult(
                    title=(item.get("title") or "Untitled").strip(),
                    url=url,
                    snippet=item.get("content"),
                    rank=idx,
                    provider="tavily",
                    metadata={"score": item.get("score")},
                )
            )
            if len(out) >= max_results:
                break
        return out


class WebSearch:
    """Provider selector and search fallback behavior."""

    def __init__(self, settings: AppSettings) -> None:
        self.settings = settings
        self.provider_name = "none"
        self._provider = None

        provider_preference = (settings.retrieval_provider or "auto").strip().lower()
        if provider_preference in {"tavily", "auto"} and settings.tavily_api_key:
            self.provider_name = "tavily"
            self._provider = TavilySearch(
                api_key=settings.tavily_api_key,
                timeout_seconds=settings.retrieval_http_timeout_seconds,
            )
        elif provider_preference in {"serpapi", "auto"} and settings.serpapi_key:
            self.provider_name = "serpapi"
            self._provider = SerpApiSearch(
                api_key=settings.serpapi_key,
                timeout_seconds=settings.retrieval_http_timeout_seconds,
            )
        elif provider_preference == "serpapi" and not settings.serpapi_key:
            logger.warning("retrieval_provider=serpapi but SERPAPI_KEY is not configured")
        elif provider_preference == "tavily" and not settings.tavily_api_key:
            logger.warning("retrieval_provider=tavily but TAVILY_API_KEY is not configured")

    def search(self, query: str, max_results: int) -> list[SearchResult]:
        if _looks_like_url(query):
            normalized = query.strip()
            if not re.match(r"^https?://", normalized):
                normalized = f"https://{normalized}"
            return [
                SearchResult(
                    title="Direct URL",
                    url=normalized,
                    snippet="Directly provided website URL",
                    rank=1,
                    provider="direct",
                    metadata={},
                )
            ]

        if not self._provider:
            return []

        try:
            raw = self._provider.search(query, max_results=max_results + 5)
            return self._deduplicate(raw, max_results)
        except Exception as exc:  # pragma: no cover - network dependent
            logger.warning("Web search failed for query '%s': %s", query, exc)
            return []

    @staticmethod
    def _deduplicate(results: list[SearchResult], max_results: int) -> list[SearchResult]:
        """Limit to _MAX_PER_DOMAIN results per root domain and prefer newer results."""
        domain_counts: dict[str, int] = defaultdict(int)
        deduped: list[SearchResult] = []
        for r in results:
            domain = _root_domain(r.url)
            if domain_counts[domain] >= _MAX_PER_DOMAIN:
                continue
            domain_counts[domain] += 1
            deduped.append(r)
            if len(deduped) >= max_results:
                break
        return deduped

