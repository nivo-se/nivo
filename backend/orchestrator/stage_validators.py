"""Per-stage validation functions for the Generate -> Validate -> Refine -> Approve pattern.

Each validator is a simple Python function (not an agent) that checks the output of a
pipeline stage and returns a StageValidation result.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any, Callable

from backend.services.deep_research.input_completeness import DEEP_RESEARCH_THRESHOLDS


STRICT_STAGE_GATING = os.getenv("STRICT_STAGE_GATING", "false").lower() == "true"

MAX_STAGE_RETRIES = 2


class StageValidationError(Exception):
    """Raised when strict gating is enabled and a stage fails validation after all retries."""


@dataclass
class StageValidation:
    status: str  # "pass" | "warn" | "fail"
    issues: list[str] = field(default_factory=list)
    score: int = 100


def validate_identity(output: dict) -> StageValidation:
    issues: list[str] = []
    orgnr = output.get("orgnr", "")
    if not orgnr:
        issues.append("orgnr missing from identity output")
    elif orgnr.startswith("tmp-"):
        issues.append("orgnr is synthetic tmp- (not resolved from main DB)")

    name = output.get("canonical_name") or output.get("company_name", "")
    if not name:
        issues.append("canonical_name missing")

    if issues:
        return StageValidation(status="fail", issues=issues, score=0)
    return StageValidation(status="pass", score=100)


def validate_company_understanding(output: dict) -> StageValidation:
    """Validate CompanyUnderstanding payload; gate market retrieval on threshold."""
    issues: list[str] = []
    fail = False

    thresholds = DEEP_RESEARCH_THRESHOLDS
    conf_threshold = thresholds.get("company_understanding_confidence_threshold", 0.5)
    conf = output.get("confidence_score")
    if conf is not None and isinstance(conf, (int, float)) and conf < conf_threshold:
        issues.append(f"confidence_score {conf} below threshold {conf_threshold}")
        fail = True

    bm = output.get("business_model")
    if not bm or (isinstance(bm, str) and not bm.strip()):
        issues.append("business_model missing from company understanding")
        fail = True

    niche = output.get("market_niche")
    if thresholds.get("require_market_niche") and (
        not niche or (isinstance(niche, str) and not niche.strip())
    ):
        issues.append("market_niche missing from company understanding")
        fail = True

    if fail:
        return StageValidation(status="fail", issues=issues, score=0)
    if issues:
        return StageValidation(status="warn", issues=issues, score=60)
    return StageValidation(status="pass", score=100)


def validate_company_profile(output: dict) -> StageValidation:
    issues: list[str] = []
    fail = False

    bm = output.get("business_model")
    if not bm or (isinstance(bm, str) and not bm.strip()):
        issues.append("business_model missing from company profile")
        fail = True

    summary_val = output.get("summary")
    if not summary_val or (isinstance(summary_val, str) and not summary_val.strip()):
        issues.append("summary missing from company profile")

    thresholds = DEEP_RESEARCH_THRESHOLDS
    if thresholds.get("require_market_niche"):
        niche = output.get("market_niche")
        if not niche or (isinstance(niche, str) and not niche.strip()):
            issues.append("market_niche missing from company profile")
            fail = True

    conf_threshold = thresholds.get("company_understanding_confidence_threshold", 0.5)
    conf = output.get("confidence_score")
    if conf is not None and isinstance(conf, (int, float)) and conf < conf_threshold:
        issues.append(f"confidence_score {conf} below threshold {conf_threshold}")
        fail = True

    if thresholds.get("require_products_services"):
        ps = output.get("products_services", [])
        if not ps:
            issues.append("products_services empty in company profile")
    if thresholds.get("require_geographies"):
        geo = output.get("geographies", [])
        if not geo:
            issues.append("geographies empty in company profile")

    if fail:
        return StageValidation(status="fail", issues=issues, score=0)
    if issues:
        return StageValidation(status="warn", issues=issues, score=60)
    return StageValidation(status="pass", score=100)


def validate_market_analysis(output: dict) -> StageValidation:
    issues: list[str] = []
    thresholds = DEEP_RESEARCH_THRESHOLDS

    market_label = output.get("market_label") or output.get("market_size")
    if thresholds["require_market_label"] and not market_label:
        issues.append("market label/size missing")

    growth = output.get("growth_rate") or output.get("market_growth")
    if growth is None:
        issues.append("market growth rate not determined")

    if issues:
        return StageValidation(status="warn", issues=issues, score=50)
    return StageValidation(status="pass", score=100)


def validate_competitors(output: dict) -> StageValidation:
    """Validate competitor_market_synthesis output (Workstream 3)."""
    issues: list[str] = []
    thresholds = DEEP_RESEARCH_THRESHOLDS
    min_comp = thresholds.get("min_competitors", 1)
    min_verified = thresholds.get("minimum_verified_competitors", 1)
    min_direct = thresholds.get("minimum_direct_competitors", 0)
    min_market_conf = thresholds.get("minimum_market_model_confidence", 0.4)
    max_unclear = thresholds.get("maximum_unclear_positioning_ratio", 0.7)
    min_synthesis_conf = thresholds.get("minimum_market_synthesis_confidence", 0.4)

    # Competitors: prefer verified from Workstream 3, fallback to legacy payload
    competitors = output.get("competitors", [])
    verified = output.get("verified_competitors", [])
    verified_accepted = [v for v in verified if v.get("verification_status") != "rejected"]
    profiles = output.get("competitor_profiles", [])

    if len(verified_accepted) < min_verified and len(profiles) < min_verified:
        count = max(len(verified_accepted), len(profiles), len(competitors))
        if count < min_verified:
            issues.append(
                f"only {count} verified competitors (threshold: {min_verified})"
            )

    if min_direct > 0:
        direct_count = sum(
            1 for v in verified_accepted
            if v.get("verification_status") == "verified_direct"
        )
        if direct_count < min_direct:
            issues.append(
                f"no direct competitor where expected (found {direct_count}, threshold: {min_direct})"
            )

    # Market model
    market_model = output.get("market_model") or {}
    if not market_model.get("market_label"):
        issues.append("market model missing market_label")
    conf = market_model.get("confidence_score")
    if conf is not None and conf < min_market_conf:
        issues.append(
            f"market model confidence {conf} below threshold {min_market_conf}"
        )

    # Positioning: fail if too many unclear axes
    positioning = output.get("positioning_analysis") or {}
    unclear = positioning.get("unclear_axes") or []
    all_axes = (
        (positioning.get("differentiated_axes") or [])
        + (positioning.get("parity_axes") or [])
        + (positioning.get("disadvantage_axes") or [])
        + unclear
    )
    if all_axes and len(unclear) / len(all_axes) > max_unclear:
        issues.append(
            f"positioning mostly unclear (ratio {len(unclear)/len(all_axes):.2f} > {max_unclear})"
        )

    # Market synthesis
    synthesis = output.get("market_synthesis") or {}
    syn_conf = synthesis.get("confidence_score")
    if syn_conf is not None and syn_conf < min_synthesis_conf:
        issues.append(
            f"market synthesis confidence {syn_conf} below threshold {min_synthesis_conf}"
        )
    if not synthesis.get("key_supporting_claims") and not synthesis.get("synthesis_summary"):
        issues.append("market synthesis lacks supporting evidence")

    if issues:
        return StageValidation(status="warn", issues=issues, score=60)
    return StageValidation(status="pass", score=100)


def validate_financial_model(output: dict) -> StageValidation:
    issues: list[str] = []

    assumption_set = output.get("assumption_set")
    if not assumption_set:
        issues.append("assumption_set missing from financial model output")

    forecast = output.get("forecast")
    if not forecast:
        issues.append("forecast missing from financial model output")

    if issues:
        return StageValidation(status="warn", issues=issues, score=40)
    return StageValidation(status="pass", score=100)


def validate_report_quality(output: dict) -> StageValidation:
    issues: list[str] = []

    sections = output.get("sections", {})
    if not sections:
        issues.append("report has no sections")
        return StageValidation(status="fail", issues=issues, score=0)

    for key in ("executive_summary", "company"):
        if key not in sections or not sections[key]:
            issues.append(f"report section '{key}' is empty")

    if issues:
        return StageValidation(status="warn", issues=issues, score=60)
    return StageValidation(status="pass", score=100)


def validate_transaction_research(output: dict) -> StageValidation:
    """Validate transaction discovery output; target ≥ 2 transactions per spec."""
    issues: list[str] = []
    transactions = output.get("transactions", [])
    if len(transactions) < 2:
        issues.append(f"only {len(transactions)} transaction(s) (target ≥ 2)")
        return StageValidation(status="warn", issues=issues, score=50)
    return StageValidation(status="pass", score=100)


def validate_product_research(output: dict) -> StageValidation:
    """Validate product agent output."""
    issues: list[str] = []
    categories = output.get("product_categories", [])
    pricing = output.get("pricing_position")
    if not categories and not pricing:
        issues.append("product_categories and pricing_position both empty")
        return StageValidation(status="warn", issues=issues, score=40)
    if not categories:
        issues.append("product_categories empty")
    if not pricing:
        issues.append("pricing_position missing")
    if issues:
        return StageValidation(status="warn", issues=issues, score=60)
    return StageValidation(status="pass", score=100)


def validate_strategy(output: dict) -> StageValidation:
    issues: list[str] = []
    thesis = output.get("investment_thesis")
    rationale = output.get("acquisition_rationale")
    if not thesis and not rationale:
        issues.append("neither investment_thesis nor acquisition_rationale present")
        return StageValidation(status="warn", issues=issues, score=60)
    return StageValidation(status="pass", score=100)


def validate_value_creation(output: dict) -> StageValidation:
    issues: list[str] = []
    initiatives = output.get("initiatives", [])
    if not initiatives:
        issues.append("value creation initiatives list is empty")
        return StageValidation(status="warn", issues=issues, score=60)
    return StageValidation(status="pass", score=100)


def validate_valuation(output: dict) -> StageValidation:
    """Full valuation sanity checks per VALUATION_INTELLIGENCE_SPEC Section 8."""
    if output.get("skipped") is True and output.get("reason") == "valuation_not_ready":
        return StageValidation(status="pass", score=80)
    issues: list[str] = []
    ev = output.get("enterprise_value")
    eq = output.get("equity_value")
    metadata = output.get("metadata", {})
    if ev is None and eq is None:
        issues.append("neither enterprise_value nor equity_value present")
        return StageValidation(status="warn", issues=issues, score=60)

    lint_passed = metadata.get("lint_passed", True)
    lint_warnings = metadata.get("lint_warnings", [])
    if not lint_passed and lint_warnings:
        issues.extend(lint_warnings[:3])
    terminal_dominance = metadata.get("terminal_value_dominance_warning", False)
    if terminal_dominance:
        issues.append("terminal value dominance (>70% of EV)")

    implied = metadata.get("implied_ev_ebitda")
    sector_low = metadata.get("sector_sanity_range_low")
    sector_high = metadata.get("sector_sanity_range_high")
    if implied is not None and sector_low is not None and sector_high is not None:
        if implied < sector_low:
            issues.append(f"implied EV/EBITDA {implied:.1f}× below sector range ({sector_low}–{sector_high})")
        elif implied > sector_high:
            issues.append(f"implied EV/EBITDA {implied:.1f}× above sector range ({sector_low}–{sector_high})")

    if issues:
        return StageValidation(status="warn", issues=issues, score=60)
    return StageValidation(status="pass", score=100)


def validate_web_evidence_bundle(output: dict) -> StageValidation:
    """Validate web retrieval bundle per Master Spec Evidence Validation.

    Checks: source diversity ≥ 2, confidence ≥ 0.6, provenance (sources present).
    """
    if output.get("metadata", {}).get("skipped") == "no_tavily_key":
        return StageValidation(status="pass", score=80)

    thresholds = DEEP_RESEARCH_THRESHOLDS
    min_market = thresholds.get("minimum_market_evidence_items", 1)
    min_comp = thresholds.get("minimum_competitor_evidence_items", 1)
    min_avg_score = thresholds.get("minimum_average_evidence_score", 0.4)
    min_domains = 2 if thresholds.get("require_source_diversity", True) else 1
    confidence_threshold = 0.6

    accepted = output.get("accepted_count", 0)
    queries = output.get("queries_executed", [])
    normalized_sources = output.get("normalized_sources", [])
    domains = {s.get("domain", "") for s in normalized_sources if s.get("domain")}
    domain_count = len(domains)
    quality_score = output.get("metadata", {}).get("evidence_quality_score")

    issues: list[str] = []
    if not queries:
        issues.append("no queries executed")
    if accepted < (min_market + min_comp) and accepted > 0:
        issues.append(f"accepted evidence {accepted} below combined threshold {min_market + min_comp}")
    if min_domains >= 2 and domain_count < min_domains and accepted > 0:
        issues.append(f"source diversity {domain_count} < {min_domains} (require ≥2 domains)")
    if quality_score is not None and quality_score < confidence_threshold and accepted > 0:
        issues.append(f"evidence quality score {quality_score:.2f} < {confidence_threshold}")

    if issues:
        return StageValidation(status="warn", issues=issues, score=50)
    return StageValidation(status="pass", score=100)


STAGE_VALIDATORS: dict[str, Callable[[dict], StageValidation]] = {
    "identity": validate_identity,
    "company_understanding": validate_company_understanding,
    "company_profile": validate_company_profile,
    "web_retrieval": validate_web_evidence_bundle,
    "market_analysis": validate_market_analysis,
    "competitor_discovery": validate_competitors,
    "product_research": validate_product_research,
    "transaction_research": validate_transaction_research,
    "financial_model": validate_financial_model,
    "report_generation": validate_report_quality,
    "strategy": validate_strategy,
    "value_creation": validate_value_creation,
    "valuation": validate_valuation,
}
