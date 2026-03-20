"""OpenAI web search client for A/B testing vs Tavily (per Deep Research Flow Investigation plan).

Uses Responses API with web_search tool. Returns results in TavilySearchResult-compatible format.
Enable with WEB_RETRIEVAL_SEARCH_PROVIDER=openai.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from backend.config import get_settings

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class OpenAISearchResult:
    """Search result compatible with TavilySearchResult interface."""

    url: str
    title: str
    content: str | None
    score: float | None
    metadata: dict = field(default_factory=dict)


class OpenAISearchClient:
    """Search via OpenAI Responses API with web_search tool.

    Used for A/B testing: set WEB_RETRIEVAL_SEARCH_PROVIDER=openai to compare
    evidence quality and coverage vs Tavily.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._api_key = settings.openai_api_key
        self._model = "gpt-4o-mini-search-preview"

    @property
    def api_key(self) -> str | None:
        """Expose for WebRetrievalService 'skipped' check (no key = skip)."""
        return self._api_key

    def search(
        self,
        query: str,
        max_results: int = 5,
        topic: str = "general",
        search_depth: str = "basic",
    ) -> list[OpenAISearchResult]:
        """Search via OpenAI web_search tool. Returns normalized results."""
        if not self._api_key:
            logger.debug("OpenAI API key not configured, skipping search")
            return []

        try:
            from openai import OpenAI
        except ImportError:
            logger.warning("openai package not installed")
            return []

        client = OpenAI(api_key=self._api_key)
        prompt = (
            f"Search the web for: {query}. "
            f"Return exactly {max_results} results. "
            "For each result provide: 1) URL, 2) title, 3) a 2-3 sentence content snippet. "
            "Format as a simple numbered list."
        )

        try:
            response = client.responses.create(
                model=self._model,
                input=prompt,
                tools=[{"type": "web_search"}],
                tool_choice="required",
            )
        except Exception as e:
            logger.warning("OpenAI web search failed: %s", e)
            return []

        results: list[OpenAISearchResult] = []
        seen_urls: set[str] = set()

        # Extract from output: message content and annotations
        output = getattr(response, "output", None) or []
        for item in output:
            if getattr(item, "type", None) != "message":
                continue
            content = getattr(item, "content", None) or []
            for block in content:
                if getattr(block, "type", None) != "output_text":
                    continue
                annotations = getattr(block, "annotations", None) or []
                for ann in annotations:
                    if getattr(ann, "type", None) == "url_citation":
                        url = (getattr(ann, "url", None) or "").strip()
                        title = getattr(ann, "title", None) or ""
                        if url and url not in seen_urls:
                            seen_urls.add(url)
                            results.append(
                                OpenAISearchResult(
                                    url=url,
                                    title=title if isinstance(title, str) else str(title),
                                    content=None,
                                    score=None,
                                    metadata={"provider": "openai_web_search"},
                                )
                            )
                            if len(results) >= max_results:
                                break
            if len(results) >= max_results:
                break

        # Fallback: use sources field if available
        if len(results) < max_results:
            sources = getattr(response, "sources", None) or []
            for s in sources:
                if len(results) >= max_results:
                    break
                url = (getattr(s, "url", None) or (s.get("url") if isinstance(s, dict) else None) or "").strip()
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    title = getattr(s, "title", None) or (s.get("title") if isinstance(s, dict) else None) or ""
                    results.append(
                        OpenAISearchResult(
                            url=url,
                            title=title if isinstance(title, str) else str(title),
                            content=None,
                            score=None,
                            metadata={"provider": "openai_web_search", "from": "sources"},
                        )
                    )

        logger.info(
            "OpenAI web search query=%r results=%d",
            query[:60],
            len(results),
        )
        return results[:max_results]
