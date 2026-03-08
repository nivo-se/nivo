"""HTML extraction wrapper for retrieval content normalization with quality floor."""

from __future__ import annotations

import logging
from dataclasses import dataclass

from bs4 import BeautifulSoup

from .types import ExtractedContent, FetchResult

logger = logging.getLogger(__name__)

_MIN_TOKEN_COUNT = 30


def _estimate_token_count(text: str) -> int:
    return len(text.split())


@dataclass(slots=True)
class ContentExtractor:
    """Extracts normalized text and metadata from fetched HTML with quality filtering."""

    max_chars: int = 30000

    def extract(self, fetched: FetchResult) -> ExtractedContent | None:
        if not fetched.html:
            return None
        soup = BeautifulSoup(fetched.html, "lxml")
        for node in soup(["script", "style", "noscript", "nav", "footer", "header"]):
            node.decompose()

        title = soup.title.string.strip() if soup.title and soup.title.string else None
        meta_description = None
        meta_tag = soup.find("meta", attrs={"name": "description"})
        if meta_tag and meta_tag.get("content"):
            meta_description = str(meta_tag.get("content")).strip()

        text = " ".join(soup.stripped_strings)
        text = " ".join(text.split())
        text = text[: self.max_chars]

        token_count = _estimate_token_count(text)
        extraction_confidence: str
        if not text or token_count < _MIN_TOKEN_COUNT:
            extraction_confidence = "low"
            logger.info(
                "Skipping low-quality extraction for %s (tokens=%d, min=%d)",
                fetched.url, token_count, _MIN_TOKEN_COUNT,
            )
            return ExtractedContent(
                url=fetched.final_url or fetched.url,
                title=title,
                text="",
                metadata={
                    "status_code": fetched.status_code,
                    "meta_description": meta_description,
                    "source_url": fetched.url,
                    "final_url": fetched.final_url,
                    "token_count": token_count,
                    "extraction_confidence": extraction_confidence,
                    "quality_skipped": True,
                },
            )

        extraction_confidence = "high" if token_count >= 200 else "medium"

        return ExtractedContent(
            url=fetched.final_url or fetched.url,
            title=title,
            text=text,
            metadata={
                "status_code": fetched.status_code,
                "meta_description": meta_description,
                "source_url": fetched.url,
                "final_url": fetched.final_url,
                "token_count": token_count,
                "extraction_confidence": extraction_confidence,
            },
        )

