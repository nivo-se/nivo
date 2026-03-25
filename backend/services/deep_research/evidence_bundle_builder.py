"""Build and persist validated evidence bundle from web retrieval output.

Per docs/deep_research/tightning/04-evidence-and-assumption-registry.md Phase 3.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Protocol

from sqlalchemy import select

from backend.db.models.deep_research import EvidenceBundlePersistence
from backend.models.v2 import (
    EvidenceCoverageSummary,
    EvidenceItem as V2EvidenceItem,
    EvidenceExtraction,
    EvidenceScores,
    EvidenceSource,
    EvidenceValidation,
    ValidatedEvidenceBundle,
)
from backend.services.deep_research.evidence_loader import load_validated_evidence

logger = logging.getLogger(__name__)


class _EvidenceLike(Protocol):
    """Protocol for web evidence or DB record."""

    claim: str
    claim_type: str
    value: str | None
    unit: str | None
    source_url: str
    source_title: str | None
    source_domain: str
    source_type: str
    supporting_text: str
    confidence: float | None
    query_group: str | None
    query: str | None
    overall_score: float | None
    score_breakdown: dict | None
    verification_status: str | None
    retrieved_at: str | None


def _infer_metric_key(item: _EvidenceLike, query_metrics: dict[str, str] | None) -> str:
    """Infer metric_key from query or claim_type/query_group."""
    if query_metrics and item.query:
        for q, mk in query_metrics.items():
            if q and q in (item.query or ""):
                return mk
    qg = item.query_group or "company_facts"
    ct = item.claim_type or ""
    if "market" in qg or "market" in ct:
        if "growth" in ct or (item.value and "%" in str(item.value)):
            return "market_cagr_5y"
        return "tam_current"
    if "competitor" in qg or "competitor" in ct:
        return "direct_competitor_count"
    return f"{qg}_{ct}" if ct else qg


def _record_to_v2(
    item: _EvidenceLike,
    query_metrics: dict[str, str] | None,
    retrieved_at: str | None = None,
) -> V2EvidenceItem:
    """Convert EvidenceRecord or web EvidenceItem to v2 EvidenceItem."""
    metric_key = _infer_metric_key(item, query_metrics)
    try:
        value_float = float(item.value.replace(",", ".")) if item.value else None
    except (ValueError, TypeError, AttributeError):
        value_float = None

    scores = EvidenceScores(
        relevance_score=0.7,
        authority_score=0.6,
        freshness_score=0.8,
        specificity_score=0.6,
        overall_score=item.overall_score or item.confidence or 0.5,
    )
    sb = getattr(item, "score_breakdown", None)
    if isinstance(sb, dict):
        scores.relevance_score = sb.get("relevance", 0.5)
        scores.authority_score = sb.get("authority", 0.5)
        scores.freshness_score = sb.get("freshness", 0.5)
        scores.specificity_score = sb.get("specificity", 0.5)

    return V2EvidenceItem(
        metric_key=metric_key,
        claim=item.claim,
        value=value_float,
        unit=item.unit or "",
        source=EvidenceSource(
            url=item.source_url,
            title=item.source_title,
            domain=item.source_domain,
            source_type=item.source_type,
            retrieved_at=getattr(item, "retrieved_at", None) or retrieved_at,
        ),
        extraction=EvidenceExtraction(
            supporting_text=item.supporting_text[:500] if item.supporting_text else "",
            extractor="web_intel_v1",
        ),
        scores=scores,
        validation=EvidenceValidation(
            status="validated" if getattr(item, "verification_status", None) != "conflicting" else "rejected",
        ),
    )


def build_validated_bundle(
    company_id: uuid.UUID,
    run_id: uuid.UUID,
    accepted_evidence: list,
    rejected_evidence: list[tuple] | None = None,
    required_metrics: list | None = None,
    queries_executed: list[dict] | None = None,
) -> ValidatedEvidenceBundle:
    """Build ValidatedEvidenceBundle from web retrieval output."""
    rejected_evidence = rejected_evidence or []
    required_metrics = required_metrics or []
    queries_executed = queries_executed or []

    query_to_metric: dict[str, str] = {}
    for qe in queries_executed:
        if not isinstance(qe, dict):
            continue
        mk = qe.get("metric_key")
        q = qe.get("query")
        if mk and q:
            query_to_metric[q] = mk

    items: list[V2EvidenceItem] = []
    for ev_item in accepted_evidence:
        try:
            v2_item = _record_to_v2(ev_item, query_to_metric or None)
            if v2_item.validation.status == "validated":
                items.append(v2_item)
        except Exception as e:
            logger.warning("Skipped evidence item: %s", e)

    rejected_items: list[V2EvidenceItem] = []
    for entry in rejected_evidence:
        ev_item = entry[0] if isinstance(entry, (list, tuple)) else entry
        try:
            v2_item = _record_to_v2(ev_item, query_to_metric or None)
            v2_item.validation.status = "rejected"
            rejected_items.append(v2_item)
        except Exception:
            pass

    required_keys: set[str] = set()
    for m in required_metrics:
        if hasattr(m, "key"):
            required_keys.add(m.key)
        elif isinstance(m, dict):
            k = m.get("key")
            if k:
                required_keys.add(k)
    covered = {i.metric_key for i in items}
    covered &= required_keys
    coverage = EvidenceCoverageSummary(
        required_metrics_total=len(required_keys) or 1,
        required_metrics_covered=len(covered),
        coverage_rate=len(covered) / len(required_keys) if required_keys else 0.0,
    )

    return ValidatedEvidenceBundle(
        company_id=company_id,
        report_id=run_id,
        generated_at=datetime.now(timezone.utc),
        items=items,
        rejected_items=rejected_items,
        conflict_log=[],
        coverage_summary=coverage,
    )


def build_and_persist_evidence_bundle(
    session,
    run_id: uuid.UUID,
    company_id: uuid.UUID | None,
    load_from_db: bool = True,
    accepted_evidence: list | None = None,
    rejected_evidence: list | None = None,
    required_metrics: list | None = None,
    queries_executed: list[dict] | None = None,
) -> tuple[ValidatedEvidenceBundle, EvidenceBundlePersistence]:
    """Build validated bundle (from DB or in-memory) and persist. Returns (bundle, row)."""

    if load_from_db:
        records = load_validated_evidence(session, run_id, company_id)
        accepted_evidence = records
        rejected_evidence = rejected_evidence or []

    if required_metrics is None:
        try:
            from backend.services.deep_research.report_spec_builder import load_report_spec_for_run

            spec = load_report_spec_for_run(session, run_id)
            required_metrics = [m.model_dump() for m in spec.required_metrics] if spec else []
        except Exception:
            required_metrics = []

    bundle = build_validated_bundle(
        company_id=company_id or uuid.UUID(int=0),
        run_id=run_id,
        accepted_evidence=accepted_evidence or [],
        rejected_evidence=rejected_evidence or [],
        required_metrics=required_metrics,
        queries_executed=queries_executed or [],
    )
    row = persist_evidence_bundle(session, run_id, company_id, bundle)
    return bundle, row


def persist_evidence_bundle(
    session, run_id: uuid.UUID, company_id: uuid.UUID | None, bundle: ValidatedEvidenceBundle
) -> EvidenceBundlePersistence:
    """Persist validated evidence bundle to DB. Upserts by run_id."""
    bundle_dict = bundle.to_dict()
    coverage = bundle.coverage_summary.model_dump()

    existing = session.execute(
        select(EvidenceBundlePersistence).where(EvidenceBundlePersistence.run_id == run_id)
    ).scalar_one_or_none()

    if existing:
        existing.bundle_json = bundle_dict
        existing.coverage_summary_json = coverage
        existing.company_id = company_id
        session.flush()
        logger.info("Updated evidence_bundle for run %s", run_id)
        return existing

    row = EvidenceBundlePersistence(
        run_id=run_id,
        company_id=company_id,
        bundle_json=bundle_dict,
        coverage_summary_json=coverage,
    )
    session.add(row)
    session.flush()
    logger.info("Persisted evidence_bundle for run %s", run_id)
    return row


def load_evidence_bundle_for_run(
    session,
    run_id: uuid.UUID,
    company_id: uuid.UUID | None = None,
) -> ValidatedEvidenceBundle | None:
    """Load persisted validated evidence bundle for a run. Returns None if not found."""
    row = session.execute(
        select(EvidenceBundlePersistence).where(EvidenceBundlePersistence.run_id == run_id)
    ).scalar_one_or_none()
    if not row or not row.bundle_json:
        return None
    try:
        return ValidatedEvidenceBundle.model_validate(row.bundle_json)
    except Exception as e:
        logger.warning("Failed to deserialize evidence bundle for run %s: %s", run_id, e)
        return None
