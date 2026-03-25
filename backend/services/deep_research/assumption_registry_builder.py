"""Build and persist assumption registry from validated evidence bundle.

Per docs/deep_research/tightning/04-evidence-and-assumption-registry.md Phase 4.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy import select

from backend.config.policy_loader import load_policy
from backend.db.models.deep_research import AssumptionRegistryPersistence
from backend.models.v2 import (
    AssumptionItem,
    AssumptionRegistry,
    AssumptionRegistryCompleteness,
    AssumptionRegistryReadiness,
    AssumptionScope,
    PointEstimates,
    PolicyRefs,
    ValidatedEvidenceBundle,
)

logger = logging.getLogger(__name__)


def _evidence_to_point_estimates(
    value: float | None,
    uncertainty_policy: dict[str, Any],
) -> PointEstimates | None:
    """Build low/base/high from single value using uncertainty policy."""
    if value is None:
        return None
    default_spread = 0.15  # ±15% for low/high
    low = value * (1 - default_spread) if value else None
    high = value * (1 + default_spread) if value else None
    return PointEstimates(low=low, base=value, high=high)


def build_assumption_registry(
    run_id: uuid.UUID,
    bundle: ValidatedEvidenceBundle,
    required_metric_keys: list[str] | None = None,
    evidence_policy_version: str = "evidence_v1",
    uncertainty_policy_version: str = "uncertainty_v1",
) -> AssumptionRegistry:
    """Build assumption registry from validated evidence bundle."""
    required_metric_keys = required_metric_keys or []
    uncertainty_policy = load_policy("uncertainty_policy", uncertainty_policy_version) or {}
    policy_refs = PolicyRefs(
        evidence_policy_version=evidence_policy_version,
        uncertainty_policy_version=uncertainty_policy_version,
    )

    assumptions: list[AssumptionItem] = []
    by_key: dict[str, list[Any]] = {}
    for item in bundle.items:
        key = item.metric_key
        if key not in by_key:
            by_key[key] = []
        by_key[key].append(item)

    for key, items in by_key.items():
        if not items:
            continue
        best = max(items, key=lambda x: x.scores.overall_score)
        pt = _evidence_to_point_estimates(best.value, uncertainty_policy)
        ev_refs = [str(i.id) for i in items[:3]]
        scope = AssumptionScope(
            geography=best.scope.geography if hasattr(best, "scope") else None,
            segment=best.scope.segment if hasattr(best, "scope") else None,
            period=best.scope.period if hasattr(best, "scope") else None,
        )
        assumptions.append(
            AssumptionItem(
                key=key,
                category="market_growth" if "cagr" in key else "market_size" if "tam" in key else "general",
                definition=best.definition or f"Evidence for {key}",
                unit=best.unit or "",
                scope=scope,
                point_estimates=pt,
                confidence_score=best.scores.overall_score,
                derivation_method="direct_promotion" if len(items) == 1 else "conflict_resolved_interval",
                evidence_refs=ev_refs,
                policy_refs=policy_refs,
                status="accepted",
            )
        )

    accepted_keys = {a.key for a in assumptions}
    missing = [k for k in required_metric_keys if k not in accepted_keys]
    completeness = AssumptionRegistryCompleteness(
        required_total=len(required_metric_keys) or 1,
        accepted_total=len(assumptions),
        missing_keys=missing,
    )
    valuation_ready = len(missing) == 0 if required_metric_keys else len(assumptions) > 0
    readiness = AssumptionRegistryReadiness(
        valuation_ready=valuation_ready,
        blocked_reasons=[f"Missing: {k}" for k in missing] if missing else [],
    )

    return AssumptionRegistry(
        report_id=run_id,
        version="ar_v1",
        assumptions=assumptions,
        completeness=completeness,
        readiness=readiness,
    )


def persist_assumption_registry(
    session, run_id: uuid.UUID, company_id: uuid.UUID | None, registry: AssumptionRegistry
) -> AssumptionRegistryPersistence:
    """Persist assumption registry to DB. Upserts by run_id."""
    registry_dict = registry.to_dict()
    completeness = registry.completeness.model_dump()
    readiness = registry.readiness.model_dump()

    existing = session.execute(
        select(AssumptionRegistryPersistence).where(AssumptionRegistryPersistence.run_id == run_id)
    ).scalar_one_or_none()

    if existing:
        existing.registry_json = registry_dict
        existing.completeness_json = completeness
        existing.readiness_json = readiness
        existing.company_id = company_id
        session.flush()
        logger.info("Updated assumption_registry for run %s", run_id)
        return existing

    row = AssumptionRegistryPersistence(
        run_id=run_id,
        company_id=company_id,
        registry_json=registry_dict,
        completeness_json=completeness,
        readiness_json=readiness,
    )
    session.add(row)
    session.flush()
    logger.info("Persisted assumption_registry for run %s", run_id)
    return row


def load_assumption_registry_for_run(
    session, run_id: uuid.UUID
) -> AssumptionRegistry | None:
    """Load persisted assumption registry for a run."""
    row = session.execute(
        select(AssumptionRegistryPersistence).where(
            AssumptionRegistryPersistence.run_id == run_id
        )
    ).scalar_one_or_none()
    if not row or not row.registry_json:
        return None
    return AssumptionRegistry.model_validate(row.registry_json)


def build_and_persist_assumption_registry(
    session,
    run_id: uuid.UUID,
    company_id: uuid.UUID,
) -> tuple[AssumptionRegistry, AssumptionRegistryPersistence | None]:
    """Load evidence bundle and report spec, build registry, persist. Returns (registry, row or None)."""
    from backend.services.deep_research.evidence_bundle_builder import (
        load_evidence_bundle_for_run,
    )
    from backend.services.deep_research.report_spec_builder import load_report_spec_for_run

    bundle = load_evidence_bundle_for_run(session, run_id, company_id)
    report_spec = load_report_spec_for_run(session, run_id)
    if not bundle:
        registry = AssumptionRegistry(
            report_id=run_id,
            version="ar_v1",
            assumptions=[],
            completeness=AssumptionRegistryCompleteness(
                required_total=0, accepted_total=0, missing_keys=[]
            ),
            readiness=AssumptionRegistryReadiness(
                valuation_ready=False,
                blocked_reasons=["No evidence bundle found"],
            ),
        )
        row = persist_assumption_registry(session, run_id, company_id, registry)
        return registry, row

    required_keys = []
    if report_spec and report_spec.required_metrics:
        required_keys = [m.key for m in report_spec.required_metrics]

    registry = build_assumption_registry(
        run_id=run_id,
        bundle=bundle,
        required_metric_keys=required_keys,
    )
    row = persist_assumption_registry(session, run_id, company_id, registry)
    return registry, row
