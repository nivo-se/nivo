"""Input completeness validation for AnalysisInput — checks required fields per report section."""

from __future__ import annotations

from typing import Any

from .analysis_input import AnalysisInput, SECTION_REQUIREMENTS

# ---------------------------------------------------------------------------
# Quality thresholds (Task 6)
# ---------------------------------------------------------------------------

DEEP_RESEARCH_THRESHOLDS: dict[str, Any] = {
    "min_financial_years": 3,
    "min_competitors": 1,
    "require_real_orgnr": True,
    "require_starting_revenue": True,
    "require_market_label": True,
    "require_business_model": True,
}


def _resolve_field(obj: Any, dotted_path: str) -> Any:
    """Traverse a dotted path like 'market.market_label' on a dataclass hierarchy."""
    parts = dotted_path.split(".")
    current = obj
    for part in parts:
        if current is None:
            return None
        if hasattr(current, part):
            current = getattr(current, part)
        elif isinstance(current, dict):
            current = current.get(part)
        else:
            return None
    return current


def _is_populated(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, dict)):
        return len(value) > 0
    if isinstance(value, (int, float)):
        return True
    return bool(value)


class InputCompletenessValidator:
    """Validates an AnalysisInput against per-section required-field checklists."""

    def validate(self, ai: AnalysisInput) -> dict:
        """Return a completeness report dict.

        Keys:
            completeness_score: float       — 0-100 overall score
            stage_passed: bool              — True if no blocking issues
            stage_score: float              — same as completeness_score
            section_completeness: dict      — per-section pass/fail
            missing_fields: list[str]       — dotted field paths missing
            weak_fields: list[str]          — present but below quality threshold
            blocking_issues: list[str]      — critical issues that block the report
            warnings: list[str]             — non-blocking concerns
            orgnr_is_real: bool
            historical_financials_years: int
            competitor_count: int
            competitor_metrics_complete_pct: float
            value_creation_count: int
            projection_ready: bool
            valuation_ready: bool
            company_profile_complete: bool
            market_growth_available: bool
            overall_completeness_pct: float
        """
        thresholds = DEEP_RESEARCH_THRESHOLDS
        missing: list[str] = []
        weak_fields: list[str] = []
        blocking_issues: list[str] = []
        warnings: list[str] = []
        section_status: dict[str, bool] = {}

        total_required = 0
        total_present = 0

        for section, fields in SECTION_REQUIREMENTS.items():
            section_ok = True
            for field_path in fields:
                total_required += 1
                val = _resolve_field(ai, field_path)
                if _is_populated(val):
                    total_present += 1
                else:
                    missing.append(field_path)
                    section_ok = False
            section_status[section] = section_ok

        # --- Identity checks ---
        orgnr_is_real = bool(ai.orgnr and not ai.orgnr.startswith("tmp-"))
        if thresholds["require_real_orgnr"] and not orgnr_is_real:
            blocking_issues.append("orgnr is missing or synthetic (tmp-)")
        if not ai.canonical_name:
            blocking_issues.append("canonical_name is empty")
        if not ai.website:
            warnings.append("website not available")

        # --- Historical financials integrity ---
        hist_years = len(ai.historical_financials)
        min_years = thresholds["min_financial_years"]

        if hist_years == 0:
            blocking_issues.append("no historical financials loaded")
        elif hist_years < min_years:
            weak_fields.append(f"historical_financials (only {hist_years} years, expected >= {min_years})")
            warnings.append(f"only {hist_years} financial years available (threshold: {min_years})")

        revenues = [y.revenue_msek for y in ai.historical_financials if y.revenue_msek is not None]
        ebitdas = [y.ebitda_msek for y in ai.historical_financials if y.ebitda_msek is not None]

        if ai.historical_financials and not revenues:
            blocking_issues.append("revenue_history is entirely null")
        if ai.historical_financials and not ebitdas:
            weak_fields.append("ebitda_history all null")
            warnings.append("EBITDA data missing for all historical years")

        if hist_years >= 2:
            years_sorted = sorted(y.year for y in ai.historical_financials)
            expected_span = years_sorted[-1] - years_sorted[0]
            actual_count = len(years_sorted)
            if actual_count < expected_span + 1:
                warnings.append(f"financial year sequence has gaps: {years_sorted}")

        # --- Stage flags from assembler ---
        if ai.stage_flags.get("financials_skipped_tmp_orgnr"):
            blocking_issues.append("financials skipped due to synthetic tmp-orgnr")
        if ai.stage_flags.get("financials_skipped_no_orgnr"):
            blocking_issues.append("financials skipped because orgnr is missing")

        # --- Business model ---
        if thresholds["require_business_model"] and not ai.business_model:
            warnings.append("business_model not available")

        # --- Market ---
        if thresholds["require_market_label"] and not ai.market.market_label and not ai.market.market_size:
            warnings.append("market label/size not available")
        if ai.market.market_growth_base is None:
            warnings.append("market growth baseline not available")

        # --- Competitors ---
        comp_count = len(ai.competitors)
        min_comp = thresholds["min_competitors"]
        if comp_count < min_comp:
            warnings.append(f"only {comp_count} competitors (threshold: {min_comp})")

        comp_metrics_complete = 0
        comp_total_metrics = max(comp_count, 1)
        for c in ai.competitors:
            has_any = bool(c.strengths or c.weaknesses or c.revenue_msek is not None)
            if has_any:
                comp_metrics_complete += 1

        # --- Model readiness ---
        projection_ready = bool(
            ai.model_assumptions.starting_revenue_msek
            and ai.model_assumptions.projection_years >= 1
        )
        if thresholds["require_starting_revenue"] and not ai.model_assumptions.starting_revenue_msek:
            warnings.append("starting_revenue_msek is missing for model assumptions")

        valuation_ready = ai.valuation_output.enterprise_value_msek is not None

        overall_pct = round(total_present / total_required * 100, 1) if total_required else 100.0
        stage_passed = len(blocking_issues) == 0

        return {
            "completeness_score": overall_pct,
            "stage_passed": stage_passed,
            "stage_score": overall_pct,
            "section_completeness": section_status,
            "missing_fields": missing,
            "weak_fields": weak_fields,
            "blocking_issues": blocking_issues,
            "warnings": warnings,
            "orgnr_is_real": orgnr_is_real,
            "historical_financials_years": hist_years,
            "competitor_count": comp_count,
            "competitor_metrics_complete_pct": round(comp_metrics_complete / comp_total_metrics, 2),
            "value_creation_count": len(ai.value_creation_initiatives),
            "projection_ready": projection_ready,
            "valuation_ready": valuation_ready,
            "company_profile_complete": section_status.get("company", False),
            "market_growth_available": ai.market.market_growth_base is not None,
            "overall_completeness_pct": overall_pct,
        }
