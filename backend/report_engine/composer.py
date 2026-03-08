"""Composable Deep Research report generation utilities."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from backend.services.deep_research.analysis_input import AnalysisInput

_UNVERIFIED = "[unverified]"

_GUARDED_SECTIONS = frozenset({
    "financials_and_valuation",
    "market_and_competitive_landscape",
})


def _as_list(value: Any) -> list:
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        items = value.get("items")
        return items if isinstance(items, list) else []
    return []


def _lines(items: list[str]) -> str:
    if not items:
        return "- N/A"
    return "\n".join(f"- {x}" for x in items)


def _build_unsupported_types(verification: dict) -> set[str]:
    """Return claim_types that have at least one UNSUPPORTED claim."""
    stats = verification.get("stats", {})
    per_type: dict[str, dict] = stats.get("per_type", {})
    bad_types: set[str] = set()
    for claim_type, counts in per_type.items():
        if isinstance(counts, dict) and counts.get("unsupported", 0) > 0:
            bad_types.add(claim_type)
    return bad_types


def _guard_numeric(value: Any, unsupported_types: set[str], types_to_check: tuple[str, ...]) -> Any:
    """Replace value with [unverified] if any of the given claim types are unsupported."""
    if not unsupported_types:
        return value
    for t in types_to_check:
        if t in unsupported_types:
            return _UNVERIFIED
    return value


def _fmt_num(val: Any, suffix: str = "") -> str:
    if val is None:
        return "N/A"
    try:
        return f"{float(val):,.1f}{suffix}"
    except (TypeError, ValueError):
        return str(val)


def _historicals_table(ai: AnalysisInput) -> str:
    if not ai.historical_financials:
        return "*No historical financial data available.*"
    header = "| Year | Revenue (MSEK) | EBITDA (MSEK) | EBITDA Margin |"
    sep = "|------|---------------|--------------|--------------|"
    rows = []
    for h in ai.historical_financials:
        rows.append(
            f"| {h.year} | {_fmt_num(h.revenue_msek)} | {_fmt_num(h.ebitda_msek)} "
            f"| {_fmt_num(h.ebitda_margin_pct, '%')} |"
        )
    return "\n".join([header, sep] + rows)


def _projection_table(ai: AnalysisInput, scenario: str = "base") -> str:
    proj_rows = ai.projections.get(scenario, [])
    if not proj_rows:
        return "*No projection data available.*"
    base_year = ai.model_assumptions.base_year or 0
    header = "| Year | Revenue (MSEK) | Growth | EBITDA Margin | EBITDA (MSEK) | FCF (MSEK) |"
    sep = "|------|---------------|--------|--------------|--------------|------------|"
    rows = []
    for p in proj_rows:
        label = f"{base_year + p.year}E" if base_year else f"Y{p.year}"
        rows.append(
            f"| {label} | {_fmt_num(p.revenue_msek)} | {_fmt_num(p.growth_pct, '%')} "
            f"| {_fmt_num(p.ebitda_margin_pct, '%')} | {_fmt_num(p.ebitda_msek)} "
            f"| {_fmt_num(p.fcf_msek)} |"
        )
    return "\n".join([header, sep] + rows)


def _missing_note(missing_fields: list[str], section_keys: list[str]) -> str:
    relevant = [f for f in missing_fields if any(f.startswith(k) or f == k for k in section_keys)]
    if not relevant:
        return ""
    return f"\n\n> **Note:** Some data is incomplete — missing: {', '.join(relevant)}\n"


@dataclass(slots=True)
class ReportComposer:
    """Composes markdown report payloads from orchestrator node outputs."""

    version: str = "v1"

    def compose_from_analysis_input(
        self,
        *,
        analysis_input: AnalysisInput,
        completeness_report: dict | None = None,
        report_degraded: bool = False,
        degraded_reasons: list[str] | None = None,
    ) -> dict:
        """Primary compose path: build report from the canonical AnalysisInput."""
        ai = analysis_input
        cr = completeness_report or {}
        missing = cr.get("missing_fields", [])
        company_name = ai.canonical_name or "Unknown Company"

        unsupported_types: set[str] = set()
        if ai.verification.per_type:
            for ctype, counts in ai.verification.per_type.items():
                if isinstance(counts, dict) and counts.get("unsupported", 0) > 0:
                    unsupported_types.add(ctype)

        degraded_banner = ""
        if report_degraded and degraded_reasons:
            degraded_banner = (
                "> **Notice:** This report was generated with incomplete data. "
                f"Issues: {', '.join(degraded_reasons)}.\n\n"
            )

        financials_warning = ""
        if not ai.historical_financials:
            financials_warning = (
                "> **Warning:** Financial history incomplete "
                "— projections are less reliable.\n\n"
            )

        # Derived history
        d = ai.derived_financial_history
        derived_lines = []
        if d.revenue_cagr_pct is not None:
            derived_lines.append(f"- Revenue CAGR: {d.revenue_cagr_pct:.1f}%")
        if d.ebitda_cagr_pct is not None:
            derived_lines.append(f"- EBITDA CAGR: {d.ebitda_cagr_pct:.1f}%")
        if d.latest_ebitda_margin_pct is not None:
            derived_lines.append(f"- Latest EBITDA margin: {d.latest_ebitda_margin_pct:.1f}%")
        if d.avg_capex_pct_revenue is not None:
            derived_lines.append(f"- Avg capex/revenue: {d.avg_capex_pct_revenue:.1f}%")
        derived_md = "\n".join(derived_lines) if derived_lines else "- N/A"

        # Final projection year
        base_proj = ai.projections.get("base", [])
        final = base_proj[-1] if base_proj else None
        proj_years = ai.model_assumptions.projection_years or 3

        revenue_final = _guard_numeric(
            _fmt_num(final.revenue_msek) if final else "N/A",
            unsupported_types, ("financial_model",),
        )
        ebitda_final = _guard_numeric(
            _fmt_num(final.ebitda_margin_pct, "%") if final else "N/A",
            unsupported_types, ("financial_model",),
        )

        # Valuation
        v = ai.valuation_output
        ev = _guard_numeric(_fmt_num(v.enterprise_value_msek), unsupported_types, ("valuation",))
        eq = _guard_numeric(_fmt_num(v.equity_value_msek), unsupported_types, ("valuation",))
        vr_low = _guard_numeric(_fmt_num(v.valuation_range_low_msek), unsupported_types, ("valuation",))
        vr_high = _guard_numeric(_fmt_num(v.valuation_range_high_msek), unsupported_types, ("valuation",))

        # Market
        market_size = _guard_numeric(ai.market.market_size or "N/A", unsupported_types, ("market_analysis",))
        growth_base = ai.market.market_growth_base
        growth_str = _guard_numeric(
            f"{growth_base * 100:.1f}%" if growth_base is not None else "N/A",
            unsupported_types, ("market_analysis",),
        )

        competitor_names = [c.name for c in ai.competitors if c.name]
        initiatives = [i.description for i in ai.value_creation_initiatives]
        risks = ai.strategy.key_risks

        verification_status = "Passed" if ai.verification.verified else "Needs review"
        completeness_pct = cr.get("overall_completeness_pct", "N/A")

        sections = [
            {
                "section_key": "executive_summary",
                "heading": "Executive Summary",
                "content_md": (
                    f"{degraded_banner}"
                    f"## Executive Summary\n\n"
                    f"**Company:** {company_name}\n\n"
                    f"{ai.summary or 'No summary available.'}\n\n"
                    f"**Verification status:** {verification_status}\n"
                    f"**Data completeness:** {completeness_pct}%\n"
                ),
                "sort_order": 1,
            },
            {
                "section_key": "company_identity_and_profile",
                "heading": "Company Identity & Profile",
                "content_md": (
                    f"### Identity\n"
                    f"- Canonical name: {company_name}\n"
                    f"- Website: {ai.website or 'N/A'}\n"
                    f"- Industry: {ai.industry or 'N/A'}\n"
                    f"- Headquarters: {ai.headquarters or 'N/A'}\n\n"
                    f"### Profile\n"
                    f"{ai.business_model or 'Business model not available.'}\n\n"
                    f"### Products & Services\n"
                    f"{_lines(ai.products_services)}\n\n"
                    f"### Geographies\n"
                    f"{_lines(ai.geographies)}\n"
                    + _missing_note(missing, ["canonical_name", "business_model", "products_services", "geographies"])
                ),
                "sort_order": 2,
            },
            {
                "section_key": "historical_financials",
                "heading": "Historical Financials",
                "content_md": (
                    f"{financials_warning}"
                    f"### Financial History ({cr.get('historical_financials_years', 0)} years)\n\n"
                    f"{_historicals_table(ai)}\n\n"
                    f"### Derived Metrics\n"
                    f"{derived_md}\n"
                    + _missing_note(missing, ["historical_financials", "derived_financial_history"])
                ),
                "sort_order": 3,
            },
            {
                "section_key": "market_and_competitive_landscape",
                "heading": "Market & Competitive Landscape",
                "content_md": (
                    f"### Market Size & Growth\n"
                    f"- Market size: {market_size}\n"
                    f"- Growth rate (base): {growth_str}\n"
                    + (f"- Growth range: {ai.market.market_growth_low:.1%} – {ai.market.market_growth_high:.1%}\n"
                       if ai.market.market_growth_low is not None and ai.market.market_growth_high is not None
                       else "")
                    + f"\n### Market Trends\n"
                    f"{_lines([str(x) for x in ai.market.key_trends])}\n\n"
                    f"### Key Competitors ({len(competitor_names)})\n"
                    f"{_lines([str(x) for x in competitor_names])}\n\n"
                    f"### Risk Signals\n"
                    f"{_lines([str(x) for x in risks])}\n"
                    + _missing_note(missing, ["market.", "competitors"])
                ),
                "sort_order": 4,
            },
            {
                "section_key": "strategy_and_value_creation",
                "heading": "Strategy & Value Creation",
                "content_md": (
                    "### Investment Thesis\n"
                    f"{ai.strategy.investment_thesis or 'N/A'}\n\n"
                    "### Acquisition Rationale\n"
                    f"{ai.strategy.acquisition_rationale or 'N/A'}\n\n"
                    f"### Value Creation Initiatives ({len(initiatives)})\n"
                    f"{_lines([str(x) for x in initiatives])}\n"
                    + _missing_note(missing, ["value_creation_initiatives"])
                ),
                "sort_order": 5,
            },
            {
                "section_key": "financials_and_valuation",
                "heading": "Financial Projections & Valuation",
                "content_md": (
                    f"{financials_warning}"
                    f"### {proj_years}-Year Projection (Base Case)\n\n"
                    f"{_projection_table(ai, 'base')}\n\n"
                    f"- Final year revenue (MSEK): {revenue_final}\n"
                    f"- Final year EBITDA margin: {ebitda_final}\n\n"
                    "### Valuation\n"
                    f"- Enterprise Value (MSEK): {ev}\n"
                    f"- Equity Value (MSEK): {eq}\n"
                    f"- Valuation Range (MSEK): {vr_low} to {vr_high}\n"
                    + _missing_note(missing, ["model_assumptions.", "valuation_output."])
                ),
                "sort_order": 6,
            },
        ]

        return {
            "status": "draft",
            "title": f"Deep Research Report - {company_name}",
            "sections": sections,
            "metadata": {
                "composer_version": self.version,
                "unsupported_claim_types": sorted(unsupported_types),
                "completeness": cr,
            },
        }

    def compose(
        self,
        *,
        company_name: str,
        node_results: dict[str, dict],
        verification_output: dict | None = None,
    ) -> dict:
        """Legacy compose path — kept for backward compatibility.

        Builds a minimal AnalysisInput from node_results and delegates to the new path.
        """
        identity = node_results.get("identity", {})
        profile = node_results.get("company_profile", {})
        market = node_results.get("market_analysis", {})
        competitors = node_results.get("competitor_discovery", {})
        strategy = node_results.get("strategy", {})
        value_creation = node_results.get("value_creation", {})
        financial = node_results.get("financial_model", {})
        valuation = node_results.get("valuation", {})
        verification = verification_output or node_results.get("verification", {})

        unsupported_types = _build_unsupported_types(verification)

        competitor_items = _as_list(competitors.get("competitors"))
        competitor_names = [c.get("name") for c in competitor_items if isinstance(c, dict) and c.get("name")]
        trends = _as_list(market.get("trends"))
        risks = _as_list(strategy.get("key_risks")) or _as_list(market.get("risks"))
        initiatives = _as_list(value_creation.get("initiatives"))

        base_forecast = (
            financial.get("forecast", {}).get("scenarios", {}).get("base", [])
            if isinstance(financial.get("forecast"), dict)
            else []
        )
        final_year = base_forecast[-1] if isinstance(base_forecast, list) and base_forecast else {}
        horizon = int(financial.get("forecast", {}).get("horizon_years", 3)) if isinstance(financial.get("forecast"), dict) else 3

        revenue = _guard_numeric(final_year.get("revenue_msek", "N/A"), unsupported_types, ("financial_model",))
        ebitda = _guard_numeric(final_year.get("ebitda_margin_pct", "N/A"), unsupported_types, ("financial_model",))
        ev = _guard_numeric(valuation.get("enterprise_value", valuation.get("enterprise_value_msek", "N/A")), unsupported_types, ("valuation",))
        eq = _guard_numeric(valuation.get("equity_value", valuation.get("equity_value_msek", "N/A")), unsupported_types, ("valuation",))
        vr_low = _guard_numeric(valuation.get("valuation_range_low", valuation.get("valuation_range_low_msek", "N/A")), unsupported_types, ("valuation",))
        vr_high = _guard_numeric(valuation.get("valuation_range_high", valuation.get("valuation_range_high_msek", "N/A")), unsupported_types, ("valuation",))

        market_size = _guard_numeric(market.get("market_size", "N/A"), unsupported_types, ("market_analysis",))
        growth_rate = _guard_numeric(market.get("growth_rate", "N/A"), unsupported_types, ("market_analysis",))

        sections = [
            {
                "section_key": "executive_summary",
                "heading": "Executive Summary",
                "content_md": (
                    f"## Executive Summary\n\n"
                    f"**Company:** {company_name}\n\n"
                    f"{profile.get('summary') or 'No summary available.'}\n\n"
                    f"**Verification status:** {'Passed' if verification.get('verified') else 'Needs review'}\n"
                ),
                "sort_order": 1,
            },
            {
                "section_key": "company_identity_and_profile",
                "heading": "Company Identity & Profile",
                "content_md": (
                    f"### Identity\n"
                    f"- Canonical name: {identity.get('canonical_name') or company_name}\n"
                    f"- Website: {identity.get('website') or 'N/A'}\n"
                    f"- Industry: {identity.get('industry') or 'N/A'}\n"
                    f"- Headquarters: {identity.get('headquarters') or 'N/A'}\n\n"
                    f"### Profile\n"
                    f"{profile.get('business_model') or 'Business model not available.'}\n"
                ),
                "sort_order": 2,
            },
            {
                "section_key": "market_and_competitive_landscape",
                "heading": "Market & Competitive Landscape",
                "content_md": (
                    f"### Market Size & Growth\n"
                    f"- Market size: {market_size}\n"
                    f"- Growth rate: {growth_rate}\n\n"
                    "### Market Trends\n"
                    f"{_lines([str(x) for x in trends])}\n\n"
                    "### Key Competitors\n"
                    f"{_lines([str(x) for x in competitor_names])}\n\n"
                    "### Risk Signals\n"
                    f"{_lines([str(x) for x in risks])}\n"
                ),
                "sort_order": 3,
            },
            {
                "section_key": "strategy_and_value_creation",
                "heading": "Strategy & Value Creation",
                "content_md": (
                    "### Investment Thesis\n"
                    f"{strategy.get('investment_thesis') or 'N/A'}\n\n"
                    "### Acquisition Rationale\n"
                    f"{strategy.get('acquisition_rationale') or 'N/A'}\n\n"
                    "### Value Creation Initiatives\n"
                    f"{_lines([str(x) for x in initiatives])}\n"
                ),
                "sort_order": 4,
            },
            {
                "section_key": "financials_and_valuation",
                "heading": "Financial Model & Valuation",
                "content_md": (
                    f"### {horizon}-Year Projection (Base Case)\n"
                    f"- Final Year Revenue (MSEK): {revenue}\n"
                    f"- Final Year EBITDA Margin (%): {ebitda}\n\n"
                    "### Valuation\n"
                    f"- Enterprise Value (MSEK): {ev}\n"
                    f"- Equity Value (MSEK): {eq}\n"
                    f"- Valuation Range (MSEK): {vr_low} "
                    f"to {vr_high}\n"
                ),
                "sort_order": 5,
            },
        ]

        return {
            "status": "draft",
            "title": f"Deep Research Report - {company_name}",
            "sections": sections,
            "metadata": {
                "composer_version": self.version,
                "node_count": len(node_results),
                "unsupported_claim_types": sorted(unsupported_types),
            },
        }
