"""Metric-driven query compiler — turns report_spec.required_metrics into search queries.

Per docs/deep_research/tightning/05-query-compiler-and-retrieval.md.
Maps each query back to metric_key for traceability and retrieval observability.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from backend.models.v2 import ReportSpec, RequiredMetric, ResearchScope

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class CompiledQuery:
    """Single compiled search query with metric and provenance."""

    text: str
    metric_key: str
    language: str = "en"
    query_type: str = "market_web"
    priority: int = 1


@dataclass(slots=True)
class QueryPlan:
    """Policy-aware query plan — traceable to required metrics."""

    report_id: str
    metric_queries: list[dict] = field(default_factory=list)
    flat_queries: list[CompiledQuery] = field(default_factory=list)

    def to_planned_queries(self, query_group: str = "market") -> list[tuple[str, str, int, str]]:
        """Convert to (query, reason, priority, metric_key) for retrieval integration."""
        out: list[tuple[str, str, int, str]] = []
        for q in self.flat_queries:
            out.append((
                q.text,
                f"Metric {q.metric_key}",
                q.priority,
                q.metric_key,
            ))
        return out


# Query templates by metric key (segment, geography, period placeholders)
QUERY_TEMPLATES: dict[str, list[tuple[str, str, str]]] = {
    "market_cagr_5y": [
        ("{segment} {geography} market CAGR {period} pdf", "en", "market_pdf"),
        ("{segment} {geography} market growth rate industry report", "en", "market_web"),
        ("{segment} marknad CAGR {geography} rapport pdf", "sv", "market_pdf"),
    ],
    "tam_current": [
        ("{segment} {geography} market size TAM {year}", "en", "market_web"),
        ("{segment} total addressable market {geography}", "en", "market_web"),
        ("{segment} marknadsstorlek {geography}", "sv", "market_web"),
    ],
    "sam_current": [
        ("{segment} {geography} SAM serviceable market", "en", "market_web"),
        ("{segment} addressable market {geography}", "en", "market_web"),
    ],
    "market_fragmentation_signal": [
        ("{segment} market fragmentation {geography}", "en", "market_web"),
        ("{segment} market concentration {geography}", "en", "market_web"),
    ],
    "direct_competitor_count": [
        ("{segment} competitors {geography}", "en", "competitors"),
        ("{segment} market players {geography}", "en", "competitors"),
    ],
    "peer_growth_benchmark": [
        ("{segment} companies growth rate {geography}", "en", "competitors"),
        ("{segment} industry growth benchmark", "en", "market_web"),
    ],
    "peer_margin_benchmark": [
        ("{segment} EBITDA margin benchmark {geography}", "en", "competitors"),
        ("{segment} industry margins", "en", "market_web"),
    ],
    "terminal_growth_proxy": [
        ("{segment} long-term growth rate {geography}", "en", "market_web"),
        ("{segment} GDP growth {geography}", "en", "market_web"),
    ],
    "ev_ebitda_peer_range": [
        ("{segment} EV EBITDA multiples {geography}", "en", "competitors"),
        ("{segment} valuation multiples transactions", "en", "competitors"),
    ],
}


def _apply_template(
    template: str,
    metric: RequiredMetric,
    scope: ResearchScope | None,
) -> str:
    """Fill template placeholders from metric and scope."""
    segment = metric.segment or (scope.industry_scope[0] if scope and scope.industry_scope else "market")
    geography = metric.geography or (scope.geography_scope[0] if scope and scope.geography_scope else "Nordics")
    period = metric.period or "2025-2030"
    year = str(metric.year or 2025)
    return template.format(
        segment=segment,
        geography=geography,
        period=period,
        year=year,
    ).strip()


def compile_query_plan(
    spec: ReportSpec,
    industry_hint: str | None = None,
    max_queries_per_metric: int = 3,
) -> QueryPlan:
    """Compile report_spec.required_metrics into a traceable query plan.

    Args:
        spec: Report spec with required_metrics
        industry_hint: Optional segment override (e.g. from company_understanding)
        max_queries_per_metric: Max queries to generate per metric

    Returns:
        QueryPlan with flat_queries and metric_queries for observability.
    """
    report_id = str(spec.report_id)
    metric_queries: list[dict] = []
    flat_queries: list[CompiledQuery] = []
    priority = 1

    scope = spec.research_scope
    for metric in spec.required_metrics:
        m = metric
        if industry_hint and not m.segment:
            m = type(m)(**{**m.model_dump(), "segment": industry_hint})

        templates = QUERY_TEMPLATES.get(m.key)
        if not templates:
            logger.info(
                "No query templates for metric_key=%s; using generic template",
                m.key,
            )
            templates = [
                (f"{m.definition} {m.geography or ''} {m.period or ''}".strip(), "en", "market_web"),
            ]

        metric_entries: list[dict] = []
        for template, lang, qtype in templates[:max_queries_per_metric]:
            text = _apply_template(template, m, scope)
            cq = CompiledQuery(
                text=text,
                metric_key=m.key,
                language=lang,
                query_type=qtype,
                priority=priority,
            )
            flat_queries.append(cq)
            metric_entries.append({
                "text": text,
                "language": lang,
                "query_type": qtype,
            })
            priority += 1

        metric_queries.append({
            "metric_key": m.key,
            "priority": priority - len(metric_entries),
            "queries": metric_entries,
        })

    plan = QueryPlan(
        report_id=report_id,
        metric_queries=metric_queries,
        flat_queries=flat_queries,
    )
    logger.info(
        "Query compiler: report_id=%s metrics=%d total_queries=%d mapping=%s",
        report_id,
        len(spec.required_metrics),
        len(flat_queries),
        {mq["metric_key"]: len(mq["queries"]) for mq in metric_queries},
    )
    return plan
