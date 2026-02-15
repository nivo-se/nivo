"""Market and financial analysis generators."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import pandas as pd


@dataclass(slots=True)
class AnalysisResult:
    market_summary: pd.Series
    financial_summary: pd.Series
    risk_flags: pd.Series


class MarketFinancialAnalyzer:
    """Generates deterministic summaries using engineered data."""

    def __init__(self, language: str = "en") -> None:
        self.language = language

    def _format_currency(self, value: float) -> str:
        if pd.isna(value):
            return "unknown revenue"
        if value >= 1_000_000_000:
            return f"{value/1_000_000_000:.1f}B SEK"
        if value >= 1_000_000:
            return f"{value/1_000_000:.1f}M SEK"
        if value >= 1_000:
            return f"{value/1_000:.1f}k SEK"
        return f"{value:,.0f} SEK"

    def _categorize_growth(self, growth: float) -> str:
        if pd.isna(growth):
            return "stable"
        if growth > 0.35:
            return "hyper-growth"
        if growth > 0.15:
            return "high growth"
        if growth > 0.05:
            return "moderate growth"
        if growth >= 0:
            return "flat"
        return "contracting"

    def _categorize_margin(self, margin: float, label: str) -> str:
        if pd.isna(margin):
            return f"{label} margin unavailable"
        if margin > 0.2:
            return f"strong {label} margin"
        if margin > 0.1:
            return f"healthy {label} margin"
        if margin > 0:
            return f"thin {label} margin"
        return f"negative {label} margin"

    def _risk_assessment(self, equity_ratio: float, revenue_growth: float) -> str:
        flags: list[str] = []
        if pd.isna(equity_ratio) or equity_ratio < 0.25:
            flags.append("low equity cushion")
        if pd.isna(revenue_growth) or revenue_growth < 0:
            flags.append("declining topline")
        return "; ".join(flags) if flags else "no immediate red flags"

    def analyze(self, dataset: pd.DataFrame) -> AnalysisResult:
        market_summaries = []
        financial_summaries = []
        risk_flags = []

        for _, row in dataset.iterrows():
            revenue = row.get("revenue")
            growth = row.get("revenue_growth")
            ebit_margin = row.get("ebit_margin")
            net_margin = row.get("net_margin")
            employees = row.get("employees")
            segment = row.get("segment_name") or row.get("Segment") or "General"

            revenue_text = self._format_currency(revenue)
            growth_text = self._categorize_growth(growth)

            market_summary = (
                f"{segment} company with {growth_text} trajectory and "
                f"{revenue_text} in latest reported revenue."
            )
            market_summaries.append(market_summary)

            ebit_text = self._categorize_margin(ebit_margin, "EBIT")
            net_text = self._categorize_margin(net_margin, "net")
            headcount_text = "lean team" if employees and employees < 20 else "scaled workforce"
            financial_summary = (
                f"Operates with {ebit_text}, {net_text}, and a {headcount_text} of {int(employees) if pd.notna(employees) else 'unknown'} employees."
            )
            financial_summaries.append(financial_summary)

            risk_flags.append(self._risk_assessment(row.get("equity_ratio"), growth))

        return AnalysisResult(
            market_summary=pd.Series(market_summaries, index=dataset.index, name="market_summary"),
            financial_summary=pd.Series(financial_summaries, index=dataset.index, name="financial_summary"),
            risk_flags=pd.Series(risk_flags, index=dataset.index, name="risk_flags"),
        )


__all__ = ["MarketFinancialAnalyzer", "AnalysisResult"]
