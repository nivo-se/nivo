"""Per-run debug artifact builder for analysis input observability."""

from __future__ import annotations

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
    web_intel_output: dict | None = None,
    competitor_market_synthesis_output: dict | None = None,
    company_understanding_output: dict | None = None,
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

    def _cu_populated(val) -> bool:
        if val is None:
            return False
        if isinstance(val, str):
            return bool(val.strip())
        if isinstance(val, (list, dict)):
            return len(val) > 0
        return True

    market_niche = ai.market.niche_label if ai.market else None
    cu_checks = [
        _cu_populated(ai.summary),
        _cu_populated(ai.business_model),
        _cu_populated(ai.products_services),
        _cu_populated(ai.geographies),
        _cu_populated(ai.customer_segments_profile),
        _cu_populated(market_niche),
    ]
    cu_missing = sum(1 for ok in cu_checks if not ok)
    company_understanding_payload = {
        "summary": bool(ai.summary),
        "business_model": bool(ai.business_model),
        "products_services": list(ai.products_services),
        "geographies": list(ai.geographies),
        "customer_segments": list(ai.customer_segments_profile),
        "market_niche": market_niche,
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

    # Extract stage timing from evaluations (tracing/observability)
    pipeline_stage_times: dict[str, int] = {}
    if stage_evaluations:
        for stage_name, ev in stage_evaluations.items():
            if isinstance(ev, dict) and "elapsed_ms" in ev:
                pipeline_stage_times[f"{stage_name}_ms"] = ev["elapsed_ms"]

    total_pipeline_ms = sum(pipeline_stage_times.values())
    tracing_summary: dict[str, Any] = {
        "pipeline_stage_times_ms": pipeline_stage_times,
        "total_pipeline_ms": total_pipeline_ms,
    }
    if web_intel_output:
        meta = web_intel_output.get("metadata", {})
        tracing_summary["retrieval_rounds"] = meta.get("retrieval_rounds_attempted")
        tracing_summary["evidence_quality_score"] = meta.get("evidence_quality_score")
        tracing_summary["retrieval_degraded"] = meta.get("degraded")
        tracing_summary["retrieval_degraded_reason"] = meta.get("degraded_reason")

    web_intel_section: dict[str, Any] = {}
    if web_intel_output:
        queries = web_intel_output.get("queries_executed", [])
        web_intel_section = {
            "executed_queries": [
                {"query": q.get("query"), "query_group": q.get("query_group"), "result_count": q.get("result_count", 0)}
                for q in queries
            ],
            "evidence_accepted": web_intel_output.get("accepted_count", 0),
            "evidence_rejected": web_intel_output.get("rejected_count", 0),
            "metadata": web_intel_output.get("metadata", {}),
        }

    competitor_market_section: dict[str, Any] = {}
    if competitor_market_synthesis_output:
        verified = competitor_market_synthesis_output.get("verified_competitors", [])
        candidates = competitor_market_synthesis_output.get("candidates", [])
        by_type: dict[str, int] = {}
        for c in candidates:
            t = c.get("candidate_type", "adjacent")
            by_type[t] = by_type.get(t, 0) + 1
        by_status: dict[str, int] = {}
        for v in verified:
            s = v.get("verification_status", "unknown")
            by_status[s] = by_status.get(s, 0) + 1
        mm = competitor_market_synthesis_output.get("market_model") or {}
        pos = competitor_market_synthesis_output.get("positioning_analysis") or {}
        syn = competitor_market_synthesis_output.get("market_synthesis") or {}
        unclear = pos.get("unclear_axes") or []
        all_axes = (
            (pos.get("differentiated_axes") or [])
            + (pos.get("parity_axes") or [])
            + (pos.get("disadvantage_axes") or [])
            + unclear
        )
        unclear_ratio = len(unclear) / len(all_axes) if all_axes else 0
        competitor_market_section = {
            "generated_candidates": {"count": len(candidates), "by_type": by_type},
            "acceptance_rejection_reasons": by_status,
            "competitor_categories": by_status,
            "market_model_completeness": {
                "market_label": bool(mm.get("market_label")),
                "market_growth_signal": bool(mm.get("market_growth_signal")),
                "demand_drivers_count": len(mm.get("demand_drivers") or []),
                "confidence_score": mm.get("confidence_score"),
            },
            "positioning_ambiguity": {
                "unclear_axes_count": len(unclear),
                "unclear_ratio": round(unclear_ratio, 2),
            },
            "synthesis_score_breakdown": {
                "market_attractiveness_score": syn.get("market_attractiveness_score"),
                "competition_intensity_score": syn.get("competition_intensity_score"),
                "niche_defensibility_score": syn.get("niche_defensibility_score"),
                "growth_support_score": syn.get("growth_support_score"),
                "confidence_score": syn.get("confidence_score"),
            },
            "metadata": competitor_market_synthesis_output.get("metadata", {}),
        }

    company_understanding_stage: dict[str, Any] = {}
    if company_understanding_output:
        company_understanding_stage = {
            "confidence_score": company_understanding_output.get("confidence_score"),
            "has_business_model": bool(
                (company_understanding_output.get("business_model") or "").strip()
            ),
            "has_market_niche": bool(
                (company_understanding_output.get("market_niche") or "").strip()
            ),
            "extraction_method": company_understanding_output.get("extraction_method"),
        }

    result: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "run_id": str(ai.run_id) if ai.run_id else None,
        "company_id": str(ai.company_id) if ai.company_id else None,
        "identity": identity_summary,
        "profile": profile_summary,
        "company_understanding_payload": company_understanding_payload,
        "company_understanding_stage": company_understanding_stage,
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
        "tracing_summary": tracing_summary,
        "pipeline_integrity_passed": not report_degraded,
        "report_degraded": report_degraded,
        "report_degraded_reasons": report_degraded_reasons or [],
        "data_source_map": data_source_map,
        "assumptions_source": assumptions_source,
        "pipeline_stage_times": pipeline_stage_times,
    }
    if web_intel_section:
        result["web_intel"] = web_intel_section
    if competitor_market_section:
        result["competitor_market_synthesis"] = competitor_market_section
    return result


def _summarize_projection(proj: dict | None) -> dict | None:
    if not proj:
        return None
    return {
        "horizon_years": proj.get("horizon_years"),
        "scenario_summary": proj.get("scenario_summary"),
    }
