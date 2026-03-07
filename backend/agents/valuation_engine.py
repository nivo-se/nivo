"""Deterministic valuation engine based on projected cash flows."""

from __future__ import annotations

from dataclasses import dataclass


def _discount(value: float, rate: float, year: int) -> float:
    return value / ((1.0 + rate) ** year)


def _round2(value: float) -> float:
    return round(value, 2)


@dataclass(slots=True)
class ValuationEngine:
    """Computes deterministic DCF valuation ranges from scenario projections."""

    method: str = "deterministic_dcf"

    def build(self, assumptions: dict, projections: dict) -> dict:
        base = assumptions.get("base", {})
        scenario_inputs = assumptions.get("scenarios", {})
        scenario_rows = projections.get("scenarios", {})
        horizon_years = int(assumptions.get("horizon_years", 7))

        base_wacc = float(base.get("discount_rate_wacc", 0.1))
        terminal_growth = float(base.get("terminal_growth", 0.025))
        net_debt = float(base.get("net_debt_msek", 0.0))

        scenario_values: dict[str, dict] = {}
        enterprise_values: list[float] = []
        for scenario_name, rows in scenario_rows.items():
            if not rows:
                continue
            scenario_delta = scenario_inputs.get(scenario_name, {})
            wacc = max(0.06, min(0.18, base_wacc + float(scenario_delta.get("discount_delta", 0.0))))
            g = max(0.01, min(0.045, terminal_growth + (float(scenario_delta.get("growth_delta", 0.0)) * 0.2)))

            discounted_fcf = 0.0
            for row in rows:
                year = int(row.get("year", 1))
                fcf = float(row.get("fcf_msek", 0.0))
                discounted_fcf += _discount(fcf, wacc, year)

            terminal_fcf = float(rows[-1].get("fcf_msek", 0.0)) * (1.0 + g)
            spread = max(0.02, wacc - g)
            terminal_value = terminal_fcf / spread
            pv_terminal = _discount(terminal_value, wacc, horizon_years)
            enterprise_value = discounted_fcf + pv_terminal
            equity_value = enterprise_value - net_debt
            enterprise_values.append(enterprise_value)
            scenario_values[scenario_name] = {
                "discount_rate_wacc": round(wacc, 4),
                "terminal_growth": round(g, 4),
                "pv_fcf_msek": _round2(discounted_fcf),
                "pv_terminal_msek": _round2(pv_terminal),
                "enterprise_value_msek": _round2(enterprise_value),
                "equity_value_msek": _round2(equity_value),
            }

        base_case = scenario_values.get("base") or next(iter(scenario_values.values()), {})
        range_low = min(enterprise_values) if enterprise_values else None
        range_high = max(enterprise_values) if enterprise_values else None
        if range_low is not None and range_high is not None and range_low == range_high:
            range_low = range_low * 0.95
            range_high = range_high * 1.05

        return {
            "method": self.method,
            "enterprise_value_msek": _round2(float(base_case.get("enterprise_value_msek", 0.0))) if base_case else None,
            "equity_value_msek": _round2(float(base_case.get("equity_value_msek", 0.0))) if base_case else None,
            "valuation_range_low_msek": _round2(range_low) if range_low is not None else None,
            "valuation_range_high_msek": _round2(range_high) if range_high is not None else None,
            "currency": "SEK",
            "scenario_valuations": scenario_values,
            "net_debt_msek": _round2(net_debt),
        }

