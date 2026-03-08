"""Input completeness validation for AnalysisInput — checks required fields per report section."""

from __future__ import annotations

from typing import Any

from .analysis_input import AnalysisInput, SECTION_REQUIREMENTS


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
            section_completeness: dict[str, bool]  — per-section pass/fail
            missing_fields: list[str]               — dotted field paths that are missing
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
        missing: list[str] = []
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

        hist_years = len(ai.historical_financials)
        comp_count = len(ai.competitors)

        comp_metrics_complete = 0
        comp_total_metrics = max(comp_count, 1)
        for c in ai.competitors:
            has_any = bool(c.strengths or c.weaknesses or c.revenue_msek is not None)
            if has_any:
                comp_metrics_complete += 1

        projection_ready = bool(
            ai.model_assumptions.starting_revenue_msek
            and ai.model_assumptions.projection_years >= 1
        )
        valuation_ready = ai.valuation_output.enterprise_value_msek is not None

        overall_pct = round(total_present / total_required * 100, 1) if total_required else 100.0

        return {
            "section_completeness": section_status,
            "missing_fields": missing,
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
