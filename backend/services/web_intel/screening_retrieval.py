"""Bounded Tavily search for screening Layer 1 (snippets + URLs).

Uses TavilyClient only — no direct HTTP to Tavily outside this package.
"""

from __future__ import annotations

import logging
from typing import Any

from backend.services.web_intel.tavily_client import TavilyClient

logger = logging.getLogger(__name__)


def fetch_screening_evidence_refs(
    *,
    company_name: str | None,
    orgnr: str | None,
    homepage: str | None = None,
    max_queries: int = 2,
    max_refs: int = 8,
) -> list[dict[str, Any]]:
    """
    Run 1–2 Tavily searches; return normalized refs {url, title, snippet} for prompts / audit.

    Returns [] when Tavily is not configured or on error (Layer 1 still runs on DB facts).
    """
    client = TavilyClient()
    if not client.api_key:
        return []

    name = (company_name or "").strip()
    o = (orgnr or "").strip()
    queries: list[str] = []
    if name:
        queries.append(f'"{name}" Sweden company business')
    if o:
        queries.append(f"Swedish company orgnr {o} {name}".strip())
    if homepage and homepage.startswith("http"):
        queries.insert(0, f"site:{homepage.replace('https://', '').replace('http://', '').split('/')[0]} {name}".strip())

    queries = queries[: max(1, max_queries)]
    refs: list[dict[str, Any]] = []
    seen: set[str] = set()

    for q in queries:
        try:
            results = client.search(q, max_results=4, search_depth="basic")
        except Exception as exc:
            logger.debug("screening Tavily search failed: %s", exc)
            continue
        for r in results or []:
            url = (r.url or "").strip()
            if not url or url in seen:
                continue
            seen.add(url)
            refs.append(
                {
                    "url": url,
                    "title": (r.title or "")[:500],
                    "snippet": (r.content or "")[:1200],
                }
            )
            if len(refs) >= max_refs:
                return refs
    return refs
