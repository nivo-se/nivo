"""Shared types for retrieval pipeline modules."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Optional


@dataclass(slots=True)
class PlannedQuery:
    query: str
    reason: str
    priority: int = 0
    query_group: str | None = None  # company_facts | market | competitors | news
    metric_key: str | None = None  # V2: traceability to report_spec required_metric


@dataclass(slots=True)
class SearchResult:
    title: str
    url: str
    snippet: str | None = None
    rank: int = 0
    provider: str = "unknown"
    metadata: dict = field(default_factory=dict)


@dataclass(slots=True)
class FetchResult:
    url: str
    status_code: int
    final_url: str | None
    html: str | None
    error: str | None = None


@dataclass(slots=True)
class ExtractedContent:
    url: str
    title: str | None
    text: str
    metadata: dict = field(default_factory=dict)


@dataclass(slots=True)
class RetrievalRequest:
    company_name: str
    orgnr: str | None = None
    company_id: uuid.UUID | None = None
    website: str | None = None
    run_id: uuid.UUID | None = None
    max_results_per_query: int = 5
    max_queries: int = 3


@dataclass(slots=True)
class RetrievalResult:
    run_id: uuid.UUID
    company_id: uuid.UUID
    provider: str
    queries: list[str]
    sources_stored: int
    chunks_stored: int
    skipped_urls: int
    errors: list[str] = field(default_factory=list)

