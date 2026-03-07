"""Composable Deep Research report generation utilities."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


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


@dataclass(slots=True)
class ReportComposer:
    """Composes markdown report payloads from orchestrator node outputs."""

    version: str = "v1"

    def compose(self, *, company_name: str, node_results: dict[str, dict]) -> dict:
        identity = node_results.get("identity", {})
        profile = node_results.get("company_profile", {})
        market = node_results.get("market_analysis", {})
        competitors = node_results.get("competitor_discovery", {})
        strategy = node_results.get("strategy", {})
        value_creation = node_results.get("value_creation", {})
        financial = node_results.get("financial_model", {})
        valuation = node_results.get("valuation", {})
        verification = node_results.get("verification", {})

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
        year7 = base_forecast[-1] if isinstance(base_forecast, list) and base_forecast else {}

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
                    "### 7-Year Projection (Base Case)\n"
                    f"- Year 7 Revenue (MSEK): {year7.get('revenue_msek', 'N/A')}\n"
                    f"- Year 7 EBITDA Margin (%): {year7.get('ebitda_margin_pct', 'N/A')}\n\n"
                    "### Valuation\n"
                    f"- Enterprise Value (MSEK): {valuation.get('enterprise_value', 'N/A')}\n"
                    f"- Equity Value (MSEK): {valuation.get('equity_value', 'N/A')}\n"
                    f"- Valuation Range (MSEK): {valuation.get('valuation_range_low', 'N/A')} "
                    f"to {valuation.get('valuation_range_high', 'N/A')}\n"
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
            },
        }

