"""Per-run debug artifact builder for analysis input observability."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from .analysis_input import AnalysisInput


def build_debug_artifact(
    *,
    analysis_input: AnalysisInput,
    completeness_report: dict,
    assumptions_output: dict | None = None,
    projection_output: dict | None = None,
    valuation_output: dict | None = None,
) -> dict[str, Any]:
    """Build a JSON-safe debug artifact for the run.

    Includes: assembled input summary, completeness, assumptions,
    projection outputs, and valuation outputs.
    """
    ai = analysis_input

    identity_summary = {
        "canonical_name": ai.canonical_name,
        "orgnr": ai.orgnr,
        "website": ai.website,
        "industry": ai.industry,
        "headquarters": ai.headquarters,
    }

    profile_summary = {
        "has_summary": bool(ai.summary),
        "has_business_model": bool(ai.business_model),
        "products_count": len(ai.products_services),
        "geographies_count": len(ai.geographies),
    }

    historicals_summary = {
        "years_count": len(ai.historical_financials),
        "years": [h.year for h in ai.historical_financials],
        "revenues_msek": [h.revenue_msek for h in ai.historical_financials],
        "ebitda_msek": [h.ebitda_msek for h in ai.historical_financials],
    }

    derived = {
        "revenue_cagr_pct": ai.derived_financial_history.revenue_cagr_pct,
        "ebitda_cagr_pct": ai.derived_financial_history.ebitda_cagr_pct,
        "latest_revenue_msek": ai.derived_financial_history.latest_revenue_msek,
        "latest_ebitda_margin_pct": ai.derived_financial_history.latest_ebitda_margin_pct,
        "ebitda_margin_trend": ai.derived_financial_history.ebitda_margin_trend,
        "avg_capex_pct_revenue": ai.derived_financial_history.avg_capex_pct_revenue,
        "avg_nwc_pct_revenue": ai.derived_financial_history.avg_nwc_pct_revenue,
    }

    market_summary = {
        "market_label": ai.market.market_label,
        "market_size": ai.market.market_size,
        "market_growth_base": ai.market.market_growth_base,
        "market_growth_low": ai.market.market_growth_low,
        "market_growth_high": ai.market.market_growth_high,
        "trends_count": len(ai.market.key_trends),
        "risks_count": len(ai.market.risks),
    }

    competitors_summary = {
        "count": len(ai.competitors),
        "names": [c.name for c in ai.competitors],
    }

    strategy_summary = {
        "has_investment_thesis": bool(ai.strategy.investment_thesis),
        "has_acquisition_rationale": bool(ai.strategy.acquisition_rationale),
        "risks_count": len(ai.strategy.key_risks),
    }

    vc_summary = {
        "initiatives_count": len(ai.value_creation_initiatives),
        "descriptions": [i.description[:80] for i in ai.value_creation_initiatives],
    }

    verification_summary = {
        "verified": ai.verification.verified,
        "total_claims": ai.verification.total_claims,
        "supported": ai.verification.supported,
        "unsupported": ai.verification.unsupported,
    }

    model_assumptions_summary = {
        "base_year": ai.model_assumptions.base_year,
        "projection_years": ai.model_assumptions.projection_years,
        "starting_revenue_msek": ai.model_assumptions.starting_revenue_msek,
        "growth_start": ai.model_assumptions.growth_start,
        "ebitda_margin_start": ai.model_assumptions.ebitda_margin_start,
    }

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "run_id": str(ai.run_id) if ai.run_id else None,
        "company_id": str(ai.company_id) if ai.company_id else None,
        "identity": identity_summary,
        "profile": profile_summary,
        "historical_financials": historicals_summary,
        "derived_metrics": derived,
        "market": market_summary,
        "competitors": competitors_summary,
        "strategy": strategy_summary,
        "value_creation": vc_summary,
        "verification": verification_summary,
        "model_assumptions": model_assumptions_summary,
        "completeness": completeness_report,
        "assumptions_engine_output": assumptions_output,
        "projection_output_summary": _summarize_projection(projection_output),
        "valuation_output": valuation_output,
        "source_refs_count": len(ai.source_refs),
    }


def _summarize_projection(proj: dict | None) -> dict | None:
    if not proj:
        return None
    return {
        "horizon_years": proj.get("horizon_years"),
        "scenario_summary": proj.get("scenario_summary"),
    }
