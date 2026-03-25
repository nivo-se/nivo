"""Web intelligence layer for Deep Research.

Centralizes Tavily usage, evidence extraction, scoring, and verification.
Downstream agents consume validated evidence via Source records.

Exports are lazy-loaded so lightweight imports (e.g. ``site_about_fetch``) do not pull Tavily/requests.
"""

from __future__ import annotations

from typing import Any, TYPE_CHECKING

__all__ = [
    "TavilyClient",
    "TavilySearchResult",
    "TavilyExtractResult",
    "NormalizedSource",
    "normalize_domain",
    "classify_source_type",
    "EvidenceItem",
    "EvidenceScorer",
    "EvidenceVerifier",
    "RetrievalBundle",
    "WebRetrievalService",
    "fetch_screening_evidence_refs",
]

if TYPE_CHECKING:
    from .evidence_extractor import EvidenceItem
    from .evidence_scorer import EvidenceScorer
    from .evidence_verifier import EvidenceVerifier
    from .screening_retrieval import fetch_screening_evidence_refs
    from .source_normalizer import NormalizedSource, classify_source_type, normalize_domain
    from .tavily_client import TavilyClient, TavilyExtractResult, TavilySearchResult
    from .web_retrieval_service import RetrievalBundle, WebRetrievalService


def __getattr__(name: str) -> Any:
    if name == "EvidenceItem":
        from .evidence_extractor import EvidenceItem

        return EvidenceItem
    if name == "EvidenceScorer":
        from .evidence_scorer import EvidenceScorer

        return EvidenceScorer
    if name == "EvidenceVerifier":
        from .evidence_verifier import EvidenceVerifier

        return EvidenceVerifier
    if name in ("NormalizedSource", "classify_source_type", "normalize_domain"):
        from . import source_normalizer as m

        return getattr(m, name)
    if name in ("TavilyClient", "TavilyExtractResult", "TavilySearchResult"):
        from . import tavily_client as m

        return getattr(m, name)
    if name == "fetch_screening_evidence_refs":
        from .screening_retrieval import fetch_screening_evidence_refs

        return fetch_screening_evidence_refs
    if name in ("RetrievalBundle", "WebRetrievalService"):
        from . import web_retrieval_service as m

        return getattr(m, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
