"""Deterministic assumptions engine for financial modeling."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass

from .context import AgentContext


def _stable_unit(seed: str) -> float:
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    return int(digest[:12], 16) / float(16**12)


def _stable_range(seed: str, low: float, high: float) -> float:
    return low + (_stable_unit(seed) * (high - low))


def _round4(value: float) -> float:
    return round(value, 4)


@dataclass(slots=True)
class AssumptionsEngine:
    """Builds deterministic financial assumptions from context."""

    horizon_years: int = 3

    def build(
        self,
        *,
        context: AgentContext,
        strategy_payload: dict | None = None,
        value_creation_payload: dict | None = None,
    ) -> dict:
        strategy_payload = strategy_payload or {}
        value_creation_payload = value_creation_payload or {}
        initiatives = value_creation_payload.get("initiatives", [])
        if isinstance(initiatives, dict):
            initiatives = initiatives.get("items", [])
        initiative_count = len(initiatives) if isinstance(initiatives, list) else 0

        key = f"{context.company_id}:{context.company_name}:{context.orgnr or ''}:{context.website or ''}"
        base_revenue = round(_stable_range(f"{key}:rev", 350.0, 2200.0), 2)
        growth_start = _stable_range(f"{key}:g_start", 0.09, 0.22)
        growth_terminal = _stable_range(f"{key}:g_term", 0.02, 0.045)
        margin_start = _stable_range(f"{key}:m_start", 0.14, 0.30)
        margin_terminal = min(0.4, margin_start + _stable_range(f"{key}:m_exp", 0.01, 0.06))
        capex_pct = _stable_range(f"{key}:capex", 0.03, 0.08)
        nwc_pct = _stable_range(f"{key}:nwc", 0.015, 0.06)
        depreciation_pct = _stable_range(f"{key}:dep", 0.018, 0.045)
        tax_rate = 0.206 if (context.orgnr and context.orgnr.startswith("55")) else 0.22
        wacc = _stable_range(f"{key}:wacc", 0.085, 0.13)
        net_debt = round(base_revenue * _stable_range(f"{key}:debt", 0.15, 0.45), 2)

        # Deterministic adjustment from strategic signals.
        strategy_risk_items = strategy_payload.get("key_risks", [])
        if isinstance(strategy_risk_items, dict):
            strategy_risk_items = strategy_risk_items.get("items", [])
        risk_count = len(strategy_risk_items) if isinstance(strategy_risk_items, list) else 0
        growth_adjustment = max(-0.03, min(0.03, (initiative_count * 0.0025) - (risk_count * 0.003)))
        margin_adjustment = max(-0.02, min(0.02, (initiative_count * 0.0015) - (risk_count * 0.001)))

        base = {
            "starting_revenue_msek": base_revenue,
            "growth_start": _round4(growth_start + growth_adjustment),
            "growth_terminal": _round4(growth_terminal),
            "ebitda_margin_start": _round4(margin_start + margin_adjustment),
            "ebitda_margin_terminal": _round4(margin_terminal + margin_adjustment),
            "capex_pct_revenue": _round4(capex_pct),
            "nwc_pct_revenue": _round4(nwc_pct),
            "depreciation_pct_revenue": _round4(depreciation_pct),
            "tax_rate": _round4(tax_rate),
            "discount_rate_wacc": _round4(wacc),
            "terminal_growth": _round4(max(0.015, min(0.04, growth_terminal))),
            "net_debt_msek": net_debt,
        }

        scenarios = {
            "base": {
                "growth_delta": 0.0,
                "margin_delta": 0.0,
                "discount_delta": 0.0,
            },
            "upside": {
                "growth_delta": 0.02,
                "margin_delta": 0.015,
                "discount_delta": -0.008,
            },
            "downside": {
                "growth_delta": -0.025,
                "margin_delta": -0.02,
                "discount_delta": 0.01,
            },
        }

        return {
            "horizon_years": self.horizon_years,
            "base": base,
            "scenarios": scenarios,
            "driver_summary": {
                "initiative_count": initiative_count,
                "risk_count": risk_count,
            },
            "deterministic_key_hash": hashlib.sha256(key.encode("utf-8")).hexdigest()[:16],
        }

