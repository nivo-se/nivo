"""Report spec builder — produces and persists machine-readable run contract.

Per docs/deep_research/tightning/02-report-spec-schema.md and 09-implementation-roadmap Phase 1.
"""

from __future__ import annotations

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.config.policy_loader import get_default_policy_versions
from backend.db.models.deep_research import (
    Company,
    CompanyProfile,
    ReportSpecPersistence,
)
from backend.models.v2 import (
    AcceptanceRules,
    AnalystContext,
    OutputPreferences,
    PolicyVersions,
    ReportSpec,
    ReportSpecCompany,
    RequiredMetric,
    ResearchScope,
)

logger = logging.getLogger(__name__)

# Default required metrics for standard_deep_research mode
DEFAULT_REQUIRED_METRICS = [
    RequiredMetric(
        key="market_cagr_5y",
        definition="5-year CAGR for the defined market segment",
        unit="percent",
        geography="Nordics",
        period="2026-2030",
        min_sources=2,
        max_source_age_days=365,
    ),
    RequiredMetric(
        key="tam_current",
        definition="Current TAM for the same market segment",
        unit="SEKm",
        geography="Nordics",
        year=2026,
        min_sources=2,
    ),
]


def build_from_context(
    run_id: uuid.UUID,
    company_id: uuid.UUID | None,
    company: Company | None,
    company_profile: CompanyProfile | dict | None,
    run_mode: str = "standard_deep_research",
    analyst_note: str | None = None,
    query: str | None = None,
    policy_versions: dict[str, str] | None = None,
) -> ReportSpec:
    """Build a report spec from company and run context.

    Uses company_understanding output to seed research scope; falls back to defaults.
    """
    if policy_versions is None:
        policy_versions = get_default_policy_versions()

    company_spec = ReportSpecCompany(
        company_id=str(company_id) if company_id else None,
        legal_name=company.name if company else "",
        org_number=company.orgnr if company else None,
        website=company.website if company else None,
        country=company.country_code or "SE" if company else "SE",
        currency="SEK",
    )

    research_scope = ResearchScope(
        primary_question="Is this company attractive for Nivo's buy-and-build thesis?",
        geography_scope=["Sweden", "Nordics"],
        industry_scope=[company.industry] if company and company.industry else ["B2B software"],
        time_horizon_years=5,
    )

    # Enrich from company profile if available
    if company_profile:
        prof = (
            company_profile
            if isinstance(company_profile, dict)
            else {
                "business_model": getattr(company_profile, "business_model", None),
                "summary": getattr(company_profile, "summary", None),
                "products_services": getattr(company_profile, "products_services", {}),
            }
        )
        if isinstance(prof.get("products_services"), list):
            industries = [str(p) for p in prof["products_services"][:3]]
            if industries:
                research_scope.industry_scope = industries
        elif isinstance(prof.get("products_services"), dict):
            items = prof["products_services"].get("items", [])
            if items:
                research_scope.industry_scope = [str(i) for i in items[:3]]

    spec = ReportSpec(
        report_id=run_id,
        company=company_spec,
        run_mode=run_mode,
        analyst_context=AnalystContext(note=analyst_note or query),
        research_scope=research_scope,
        required_outputs=[
            "company_profile",
            "market_model",
            "competitor_set",
            "assumption_registry",
            "valuation_output",
        ],
        required_metrics=DEFAULT_REQUIRED_METRICS,
        policy_versions=PolicyVersions(
            valuation_policy_version=policy_versions.get("valuation_policy_version", "dcf_v1"),
            comp_policy_version=policy_versions.get("comp_policy_version", "multiples_v1"),
            evidence_policy_version=policy_versions.get("evidence_policy_version", "evidence_v1"),
            uncertainty_policy_version=policy_versions.get(
                "uncertainty_policy_version", "uncertainty_v1"
            ),
        ),
        acceptance_rules=AcceptanceRules(),
        output_preferences=OutputPreferences(),
    )
    return spec


def build_and_persist_report_spec(
    run_id: uuid.UUID,
    company_id: uuid.UUID,
    session: Session,
    company_understanding: dict | None = None,
    identity: dict | None = None,
    run_mode: str = "standard_deep_research",
    analyst_note: str | None = None,
) -> tuple[ReportSpec, ReportSpecPersistence]:
    """Build report spec from context and persist. Returns (spec, persistence_row)."""
    from sqlalchemy import select

    from backend.db.models.deep_research import Company

    company = None
    try:
        row = session.execute(select(Company).where(Company.id == company_id)).scalar_one_or_none()
        if row:
            company = row
    except Exception:
        pass

    company_profile = company_understanding  # use CU output as profile seed
    spec = build_from_context(
        run_id=run_id,
        company_id=company_id,
        company=company,
        company_profile=company_profile,
        run_mode=run_mode,
        analyst_note=analyst_note,
    )
    persisted = persist_report_spec(session, run_id, spec)
    return spec, persisted


def persist_report_spec(session: Session, run_id: uuid.UUID, spec: ReportSpec) -> ReportSpecPersistence:
    """Persist report spec to DB. Upserts by run_id."""
    spec_dict = spec.to_dict()
    policy_versions = {
        "valuation_policy_version": spec.policy_versions.valuation_policy_version,
        "comp_policy_version": spec.policy_versions.comp_policy_version,
        "evidence_policy_version": spec.policy_versions.evidence_policy_version,
        "uncertainty_policy_version": spec.policy_versions.uncertainty_policy_version,
    }
    company_id = None
    if spec.company.company_id:
        try:
            company_id = uuid.UUID(spec.company.company_id)
        except (ValueError, TypeError):
            pass

    existing = session.execute(
        select(ReportSpecPersistence).where(ReportSpecPersistence.run_id == run_id)
    ).scalar_one_or_none()
    report_id = spec.report_id
    run_mode = spec.run_mode

    if existing:
        existing.spec_json = spec_dict
        existing.policy_versions_json = policy_versions
        existing.company_id = company_id
        existing.report_id = report_id
        existing.run_mode = run_mode
        session.flush()
        logger.info("Updated report_spec for run %s", run_id)
        return existing

    row = ReportSpecPersistence(
        run_id=run_id,
        report_id=report_id,
        company_id=company_id,
        run_mode=run_mode,
        spec_json=spec_dict,
        policy_versions_json=policy_versions,
    )
    session.add(row)
    session.flush()
    logger.info("Persisted report_spec for run %s", run_id)
    return row


def load_report_spec_for_run(session: Session, run_id: uuid.UUID) -> ReportSpec | None:
    """Load persisted report spec for a run."""
    row = session.execute(
        select(ReportSpecPersistence).where(ReportSpecPersistence.run_id == run_id)
    ).scalar_one_or_none()
    if not row or not row.spec_json:
        return None
    return ReportSpec.from_dict(row.spec_json)
