"""Web retrieval orchestration: plan, search, extract, score, verify.

Implements bounded retrieval loop per BOUNDED_RETRIEVAL_LOOP_SPEC:
- 1 primary round + up to 2 supplemental rounds
- Supplemental rounds triggered by weak evidence
- Hard limits on queries and extracted URLs
- Explicit degradation when budget exhausted
"""

from __future__ import annotations

import hashlib
import logging
import uuid
from collections import defaultdict
from dataclasses import dataclass, field

from backend.api.report_settings import (
    get_report_retrieval_config,
    get_retrieval_loop_config,
)
from backend.config import get_settings
from backend.retrieval.query_planner import QueryPlanner

from .evidence_extractor import EvidenceItem, extract_evidence
from .evidence_scorer import EvidenceScorer
from .evidence_verifier import EvidenceVerifier
from .openai_search_client import OpenAISearchClient
from .source_normalizer import is_blocked_domain, normalize_source
from .tavily_client import TavilyClient

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class RetrievalBundle:
    """Canonical retrieval bundle for downstream stages."""

    queries_executed: list[dict] = field(default_factory=list)
    raw_results_by_group: dict[str, list] = field(default_factory=dict)
    normalized_sources: list = field(default_factory=list)
    accepted_evidence: list[EvidenceItem] = field(default_factory=list)
    rejected_evidence: list[tuple[EvidenceItem, str]] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)


def _compute_evidence_quality(
    accepted: list[EvidenceItem],
    market_threshold: float,
    competitor_threshold: float,
) -> tuple[float, list[str]]:
    """Compute overall quality score and identify missing evidence groups."""
    if not accepted:
        return 0.0, ["market", "competitors", "company_facts"]

    by_group: dict[str, list[EvidenceItem]] = defaultdict(list)
    for item in accepted:
        by_group[item.query_group or "company_facts"].append(item)

    def _avg_score(items: list[EvidenceItem]) -> float:
        scores = [i.overall_score or 0 for i in items]
        return sum(scores) / len(scores) if scores else 0.0

    market_items = by_group.get("market", [])
    comp_items = by_group.get("competitors", [])
    company_items = by_group.get("company_facts", [])

    market_score = _avg_score(market_items) if market_items else 0.0
    comp_score = _avg_score(comp_items) if comp_items else 0.0
    company_score = _avg_score(company_items) if company_items else 0.0

    missing: list[str] = []
    if market_score < market_threshold and not market_items:
        missing.append("market")
    elif market_score < market_threshold:
        missing.append("market")
    if comp_score < competitor_threshold and not comp_items:
        missing.append("competitors")
    elif comp_score < competitor_threshold:
        missing.append("competitors")
    if not company_items:
        missing.append("company_facts")

    weights = {"market": 0.35, "competitors": 0.35, "company_facts": 0.2, "news": 0.1}
    overall = (
        weights["market"] * min(1.0, market_score / market_threshold if market_threshold else 1.0)
        + weights["competitors"] * min(1.0, comp_score / competitor_threshold if competitor_threshold else 1.0)
        + weights["company_facts"] * (1.0 if company_items else 0.3)
        + weights["news"] * (0.5 if by_group.get("news") else 0.2)
    )
    return round(overall, 4), missing


class WebRetrievalService:
    """Orchestrates grouped retrieval with bounded loop: plan, search, extract, score, verify."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.planner = QueryPlanner(self.settings)
        self.tavily = TavilyClient()
        provider = (self.settings.web_retrieval_search_provider or "tavily").lower()
        if provider == "openai":
            self._search_client = OpenAISearchClient()
            self._search_provider_name = "openai"
        else:
            self._search_client = self.tavily
            self._search_provider_name = "tavily"
        self.scorer = EvidenceScorer(minimum_score=0.4)
        self.verifier = EvidenceVerifier(max_unresolved_conflicts=2)

    def _run_retrieval_round(
        self,
        *,
        planned: list,
        seen_urls: set[str],
        domain_counts: dict[str, int],
        text_hashes: set[str],
        extracted_urls: set[str],
        max_results_per_query: int,
        max_extracted_urls: int,
        max_per_domain: int,
        company_website: str | None,
        round_label: str,
    ) -> tuple[list[tuple[str, str, str, str, str]], list[dict], dict[str, list]]:
        """Execute one round of search; return (urls_to_extract, queries_executed, results_by_group)."""
        urls_to_extract: list[tuple[str, str, str, str, str]] = []
        queries_executed: list[dict] = []
        results_by_group: dict[str, list] = defaultdict(list)

        for pq in planned:
            group = pq.query_group or "company_facts"
            search_results = self._search_client.search(
                pq.query,
                max_results=max_results_per_query,
            )
            count = 0
            for r in search_results:
                url = r.url.strip()
                if not url or url in seen_urls:
                    continue
                if is_blocked_domain(url):
                    continue
                domain = normalize_source(url, company_website=company_website).domain
                if domain_counts[domain] >= max_per_domain:
                    continue
                seen_urls.add(url)
                domain_counts[domain] += 1
                count += 1
                results_by_group[group].append({
                    "url": url,
                    "title": r.title,
                    "content": getattr(r, "content", None),
                    "query": pq.query,
                })
            entry: dict = {
                "query": pq.query,
                "query_group": group,
                "result_count": count,
                "round": round_label,
                "search_provider": self._search_provider_name,
            }
            metric_key = getattr(pq, "metric_key", None)
            if metric_key:
                entry["metric_key"] = metric_key
                logger.info(
                    "Query-to-metric: metric_key=%s query=%s results=%d",
                    metric_key,
                    pq.query[:60] + "..." if len(pq.query) > 60 else pq.query,
                    count,
                )
            queries_executed.append(entry)

        for group, items in results_by_group.items():
            for item in items:
                url = item["url"]
                if url in extracted_urls:
                    continue
                content = item.get("content") or ""
                h = hashlib.md5(content[:500].encode()).hexdigest()
                if h in text_hashes and len(content) < 200:
                    continue
                text_hashes.add(h)
                extracted_urls.add(url)
                urls_to_extract.append((
                    url,
                    item.get("title") or "",
                    content,
                    group,
                    item.get("query") or "",
                ))

        return urls_to_extract[:max_extracted_urls], queries_executed, dict(results_by_group)

    def retrieve(
        self,
        *,
        run_id: uuid.UUID,
        company_id: uuid.UUID,
        company_name: str,
        company_profile: dict | None = None,
        orgnr: str | None = None,
        company_website: str | None = None,
        market_label: str | None = None,
    ) -> RetrievalBundle:
        """Execute bounded retrieval: 1 primary + up to 2 supplemental rounds."""
        bundle = RetrievalBundle()

        search_key = getattr(self._search_client, "api_key", None)
        if not search_key:
            logger.warning(
                "Search provider %s not configured; web retrieval skipped",
                self._search_provider_name,
            )
            bundle.metadata["skipped"] = f"no_{self._search_provider_name}_key"
            return bundle

        config = get_report_retrieval_config()
        loop_config = get_retrieval_loop_config()
        max_queries_total = min(
            config["max_queries_per_stage"],
            loop_config["max_queries_per_stage"],
        )
        max_extracted_total = min(
            config["max_extracted_urls"],
            loop_config["max_extracted_urls_per_stage"],
        )
        max_results_per_query = config["max_results_per_query"]
        max_per_domain = config["max_per_domain"]
        market_threshold = loop_config["market_evidence_quality_threshold"]
        comp_threshold = loop_config["competitor_evidence_quality_threshold"]
        max_supplemental = loop_config["max_supplemental_rounds"]

        primary_queries = min(4, max_queries_total)
        supplemental_queries_per_round = min(2, max(1, max_queries_total - primary_queries))

        planned = self.planner.plan_stage_queries(
            company_name=company_name,
            orgnr=orgnr,
            website=company_website,
            company_profile=company_profile,
            market_label=market_label,
            max_queries=primary_queries,
        )

        seen_urls: set[str] = set()
        domain_counts: dict[str, int] = defaultdict(int)
        text_hashes: set[str] = set()
        extracted_urls: set[str] = set()
        all_queries_executed: list[dict] = []
        all_results_by_group: dict[str, list] = defaultdict(list)
        all_evidence: list[EvidenceItem] = []
        total_queries_used = 0
        total_urls_extracted = 0
        rounds_attempted = 0
        degraded = False
        degraded_reason: str | None = None

        for round_idx in range(max_supplemental + 1):
            is_primary = round_idx == 0
            rounds_attempted += 1
            round_label = "primary" if is_primary else "supplemental"

            if is_primary:
                round_planned = planned[:primary_queries]
            else:
                if total_queries_used >= max_queries_total:
                    degraded = True
                    degraded_reason = "budget_exceeded_max_queries"
                    break
                quality, missing = _compute_evidence_quality(
                    all_evidence, market_threshold, comp_threshold
                )
                if loop_config.get("stop_if_threshold_met") and quality >= 0.7:
                    break
                if not missing:
                    break
                round_planned = self.planner.plan_supplemental_queries(
                    company_name=company_name,
                    company_profile=company_profile,
                    market_label=market_label,
                    missing_groups=missing,
                    max_queries=supplemental_queries_per_round,
                )
                if not round_planned:
                    break

            urls_to_extract, queries_executed, round_results = self._run_retrieval_round(
                planned=round_planned,
                seen_urls=seen_urls,
                domain_counts=domain_counts,
                text_hashes=text_hashes,
                extracted_urls=extracted_urls,
                max_results_per_query=max_results_per_query,
                max_extracted_urls=max_extracted_total - total_urls_extracted,
                max_per_domain=max_per_domain,
                company_website=company_website,
                round_label=round_label,
            )
            all_queries_executed.extend(queries_executed)
            for group, items in round_results.items():
                all_results_by_group[group].extend(items)
            total_queries_used += len(round_planned)

            if not urls_to_extract:
                if is_primary:
                    bundle.metadata["no_urls_to_extract"] = True
                break

            urls_only = [u[0] for u in urls_to_extract]
            total_urls_extracted += len(urls_only)
            if total_urls_extracted > max_extracted_total and loop_config.get("degrade_if_budget_exceeded"):
                degraded = True
                degraded_reason = "budget_exceeded_max_extracted_urls"

            extract_results = self.tavily.extract(urls_only, chunks_per_source=3)
            url_to_extracted: dict[str, str] = {}
            for er in extract_results:
                if not er.failed and er.raw_content:
                    url_to_extracted[er.url] = er.raw_content

            for url, title, snippet, group, query in urls_to_extract:
                raw = url_to_extracted.get(url) or snippet
                if not raw or len(raw.strip()) < 30:
                    continue
                items = extract_evidence(
                    url=url,
                    title=title or None,
                    raw_content=raw,
                    query=query,
                    query_group=group,
                    company_website=company_website,
                )
                for item in items:
                    self.scorer.score(item)
                all_evidence.extend(items)

        accepted, rejected_by_score = self.scorer.filter_by_threshold(all_evidence)
        for item in rejected_by_score:
            bundle.rejected_evidence.append((item, "below_score_threshold"))

        self.verifier.verify(accepted)
        for item in accepted:
            if item.verification_status == "conflicting":
                bundle.rejected_evidence.append((item, "conflicting"))
            else:
                bundle.accepted_evidence.append(item)

        quality_final, missing_final = _compute_evidence_quality(
            bundle.accepted_evidence, market_threshold, comp_threshold
        )
        if not degraded and quality_final < 0.7 and rounds_attempted >= max_supplemental + 1:
            degraded = True
            degraded_reason = "insufficient_evidence_after_max_rounds"

        bundle.queries_executed = all_queries_executed
        bundle.raw_results_by_group = dict(all_results_by_group)
        seen_for_norm: set[str] = set()
        bundle.normalized_sources = []
        for group_items in all_results_by_group.values():
            for item in group_items:
                u = item.get("url")
                if u and u not in seen_for_norm:
                    seen_for_norm.add(u)
                    bundle.normalized_sources.append({
                        "url": u,
                        "domain": normalize_source(u, company_website=company_website).domain,
                    })
        bundle.metadata["accepted_count"] = len(bundle.accepted_evidence)
        bundle.metadata["rejected_count"] = len(bundle.rejected_evidence)
        bundle.metadata["retrieval_rounds_attempted"] = rounds_attempted
        bundle.metadata["evidence_quality_score"] = quality_final
        bundle.metadata["degraded"] = degraded
        if degraded_reason:
            bundle.metadata["degraded_reason"] = degraded_reason
        return bundle
