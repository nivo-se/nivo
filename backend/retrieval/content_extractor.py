"""HTML extraction wrapper for retrieval content normalization."""

from __future__ import annotations

from dataclasses import dataclass

from bs4 import BeautifulSoup

from .types import ExtractedContent, FetchResult


@dataclass(slots=True)
class ContentExtractor:
    """Extracts normalized text and metadata from fetched HTML."""

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
        if not text:
            return None

        return ExtractedContent(
            url=fetched.final_url or fetched.url,
            title=title,
            text=text,
            metadata={
                "status_code": fetched.status_code,
                "meta_description": meta_description,
                "source_url": fetched.url,
                "final_url": fetched.final_url,
            },
        )

