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
    stage_evaluations: dict[str, Any] | None = None,
    report_degraded: bool = False,
    report_degraded_reasons: list[str] | None = None,
) -> dict[str, Any]:
    """Build a JSON-safe debug artifact for the run.

    Includes: assembled input summary, completeness, assumptions,
    projection outputs, valuation outputs, stage evaluations,
    resolution source, and data source map.
    """
    ai = analysis_input

    orgnr_is_real = bool(ai.orgnr and not ai.orgnr.startswith("tmp-"))

    identity_summary = {
        "canonical_name": ai.canonical_name,
        "orgnr": ai.orgnr,
        "orgnr_is_real": orgnr_is_real,
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

    cu_critical_fields = ["summary", "business_model", "products_services", "geographies", "customer_segments"]
    cu_missing = sum(
        1 for f in cu_critical_fields
        if not getattr(ai, f, None) or (isinstance(getattr(ai, f, None), (list, str)) and not getattr(ai, f))
    )
    company_understanding_payload = {
        "summary": bool(ai.summary),
        "business_model": bool(ai.business_model),
        "products_services": list(ai.products_services),
        "geographies": list(ai.geographies),
        "customer_segments": list(ai.customer_segments) if hasattr(ai, "customer_segments") else [],
        "quality_score": max(0, 100 - cu_missing * 20),
    }

    assumptions_source = "unknown"
    if assumptions_output and isinstance(assumptions_output, dict):
        assumptions_source = assumptions_output.get("assumptions_source", "synthetic_seed")

    model_input_payload = {
        "historical_financials_count": len(ai.historical_financials),
        "has_derived_metrics": ai.derived_financial_history.latest_revenue_msek is not None,
        "assumptions_source": assumptions_source,
        "has_market_growth": ai.market.market_growth_base is not None,
        "has_strategy": bool(ai.strategy.investment_thesis or ai.strategy.acquisition_rationale),
        "has_value_creation": len(ai.value_creation_initiatives) > 0,
    }

    data_source_map = {
        "orgnr": "public.companies" if orgnr_is_real else "synthetic_tmp",
        "financials": "public.financials" if ai.historical_financials else "none",
        "kpis": "public.company_kpis" if ai.derived_financial_history.latest_revenue_msek else "derived",
        "assumptions": assumptions_source,
    }

    # Extract stage timing from evaluations
    pipeline_stage_times: dict[str, int] = {}
    if stage_evaluations:
        for stage_name, ev in stage_evaluations.items():
            if isinstance(ev, dict) and "elapsed_ms" in ev:
                pipeline_stage_times[f"{stage_name}_ms"] = ev["elapsed_ms"]

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "run_id": str(ai.run_id) if ai.run_id else None,
        "company_id": str(ai.company_id) if ai.company_id else None,
        "identity": identity_summary,
        "profile": profile_summary,
        "company_understanding_payload": company_understanding_payload,
        "historical_financials": historicals_summary,
        "derived_metrics": derived,
        "market": market_summary,
        "competitors": competitors_summary,
        "strategy": strategy_summary,
        "value_creation": vc_summary,
        "verification": verification_summary,
        "model_assumptions": model_assumptions_summary,
        "model_input_payload": model_input_payload,
        "completeness": completeness_report,
        "assumptions_engine_output": assumptions_output,
        "projection_output_summary": _summarize_projection(projection_output),
        "valuation_output": valuation_output,
        "proprietary_sources_summary": {
            "proprietary_source_count": ai.proprietary_source_count,
            "total_source_count": len(ai.source_refs),
            "proprietary_source_types": sorted({
                sr.source_type
                for sr in ai.source_refs
                if sr.provenance == "proprietary"
            }),
        },
        "source_refs_count": len(ai.source_refs),
        "stage_flags": dict(ai.stage_flags),
        "stage_evaluations": stage_evaluations or {},
        "pipeline_integrity_passed": not report_degraded,
        "report_degraded": report_degraded,
        "report_degraded_reasons": report_degraded_reasons or [],
        "data_source_map": data_source_map,
        "assumptions_source": assumptions_source,
        "pipeline_stage_times": pipeline_stage_times,
    }


def _summarize_projection(proj: dict | None) -> dict | None:
    if not proj:
        return None
    return {
        "horizon_years": proj.get("horizon_years"),
        "scenario_summary": proj.get("scenario_summary"),
    }
