"""Web intelligence layer for Deep Research.

Centralizes Tavily usage, evidence extraction, scoring, and verification.
Downstream agents consume validated evidence via Source records.
"""

from .evidence_extractor import EvidenceItem
from .evidence_scorer import EvidenceScorer
from .evidence_verifier import EvidenceVerifier
from .source_normalizer import NormalizedSource, classify_source_type, normalize_domain
from .tavily_client import TavilyClient, TavilyExtractResult, TavilySearchResult
from .web_retrieval_service import RetrievalBundle, WebRetrievalService

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
]
