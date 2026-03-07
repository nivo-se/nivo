"""Deterministic projection engine for 7-year financial forecasts."""

from __future__ import annotations

from dataclasses import dataclass


def _linspace(start: float, end: float, steps: int) -> list[float]:
    if steps <= 1:
        return [start]
    step = (end - start) / (steps - 1)
    return [start + (step * i) for i in range(steps)]


def _round2(value: float) -> float:
    return round(value, 2)


@dataclass(slots=True)
class ProjectionEngine:
    """Projects deterministic scenario forecasts from assumptions."""

    def build(self, assumptions: dict) -> dict:
        base = assumptions.get("base", {})
        scenarios = assumptions.get("scenarios", {})
        horizon_years = int(assumptions.get("horizon_years", 7))

        start_revenue = float(base.get("starting_revenue_msek", 500.0))
        tax_rate = float(base.get("tax_rate", 0.22))
        capex_pct = float(base.get("capex_pct_revenue", 0.05))
        nwc_pct = float(base.get("nwc_pct_revenue", 0.03))
        dep_pct = float(base.get("depreciation_pct_revenue", 0.025))
        growth_start = float(base.get("growth_start", 0.12))
        growth_terminal = float(base.get("growth_terminal", 0.03))
        margin_start = float(base.get("ebitda_margin_start", 0.18))
        margin_terminal = float(base.get("ebitda_margin_terminal", 0.23))

        out: dict[str, list[dict]] = {}
        scenario_summary: dict[str, dict] = {}

        for scenario_name, delta in scenarios.items():
            growth_delta = float(delta.get("growth_delta", 0.0))
            margin_delta = float(delta.get("margin_delta", 0.0))
            growth_curve = _linspace(
                growth_start + growth_delta, growth_terminal + (growth_delta * 0.4), horizon_years
            )
            margin_curve = _linspace(
                margin_start + margin_delta, margin_terminal + (margin_delta * 0.5), horizon_years
            )

            rows: list[dict] = []
            revenue = start_revenue
            previous_nwc = revenue * nwc_pct
            total_fcf = 0.0
            for year in range(1, horizon_years + 1):
                growth = growth_curve[year - 1]
                margin = margin_curve[year - 1]
                revenue = revenue * (1.0 + growth)
                ebitda = revenue * margin
                depreciation = revenue * dep_pct
                ebit = ebitda - depreciation
                taxes = max(0.0, ebit * tax_rate)
                nopat = ebit - taxes
                capex = revenue * capex_pct
                nwc = revenue * nwc_pct
                delta_nwc = nwc - previous_nwc
                fcf = nopat + depreciation - capex - delta_nwc
                previous_nwc = nwc
                total_fcf += fcf
                rows.append(
                    {
                        "year": year,
                        "revenue_msek": _round2(revenue),
                        "growth_pct": round(growth * 100, 2),
                        "ebitda_margin_pct": round(margin * 100, 2),
                        "ebitda_msek": _round2(ebitda),
                        "ebit_msek": _round2(ebit),
                        "taxes_msek": _round2(taxes),
                        "capex_msek": _round2(capex),
                        "delta_nwc_msek": _round2(delta_nwc),
                        "fcf_msek": _round2(fcf),
                    }
                )

            out[scenario_name] = rows
            scenario_summary[scenario_name] = {
                "revenue_cagr_pct": round(((rows[-1]["revenue_msek"] / start_revenue) ** (1 / horizon_years) - 1) * 100, 2),
                "total_fcf_msek": _round2(total_fcf),
                "year7_revenue_msek": rows[-1]["revenue_msek"],
                "year7_ebitda_margin_pct": rows[-1]["ebitda_margin_pct"],
            }

        return {
            "horizon_years": horizon_years,
            "scenarios": out,
            "scenario_summary": scenario_summary,
        }

