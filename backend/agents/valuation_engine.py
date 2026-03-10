"""Deterministic valuation engine based on projected cash flows."""

from __future__ import annotations

from dataclasses import dataclass

SECTOR_SANITY_LOW = 4.1
SECTOR_SANITY_HIGH = 8.0
TERMINAL_DOMINANCE_THRESHOLD = 0.8


def _discount(value: float, rate: float, year: int) -> float:
    return value / ((1.0 + rate) ** year)


def _round2(value: float) -> float:
    return round(value, 2)


def _valuation_lint(
    ev: float,
    equity: float,
    net_debt: float,
    implied_multiple: float | None,
    sector_low: float = SECTOR_SANITY_LOW,
    sector_high: float = SECTOR_SANITY_HIGH,
) -> tuple[bool, list[str]]:
    """Run valuation lint checks. Returns (passed, warnings)."""
    warnings: list[str] = []
    # EV = equity + net_debt
    ev_implied = equity + net_debt
    if ev > 0 and abs(ev - ev_implied) / ev > 0.01:
        warnings.append(f"EV ↔ equity bridge mismatch: EV={ev:.1f} vs equity+net_debt={ev_implied:.1f}")
    # Net debt sign: typically positive for debt
    if net_debt < -0.5:  # large negative = net cash
        warnings.append("Net debt is negative (net cash position); verify sign convention")
    # Implied multiple vs sector sanity
    if implied_multiple is not None and implied_multiple > 0:
        if implied_multiple < sector_low:
            warnings.append(
                f"Implied EV/EBITDA {implied_multiple:.1f}× below sector range ({sector_low}–{sector_high}×)"
            )
        elif implied_multiple > sector_high:
            warnings.append(
                f"Implied EV/EBITDA {implied_multiple:.1f}× above sector range ({sector_low}–{sector_high}×)"
            )
    return len(warnings) == 0, warnings


@dataclass(slots=True)
class ValuationEngine:
    """Computes deterministic DCF valuation ranges from scenario projections."""

    method: str = "deterministic_dcf"

    def build(
        self,
        assumptions: dict,
        projections: dict,
        sector_range_low: float | None = None,
        sector_range_high: float | None = None,
    ) -> dict:
        base = assumptions.get("base", {})
        scenario_inputs = assumptions.get("scenarios", {})
        scenario_rows = projections.get("scenarios", {})
        horizon_years = int(assumptions.get("horizon_years", 3))

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

        ev_base = float(base_case.get("enterprise_value_msek", 0.0)) if base_case else 0.0
        equity_base = float(base_case.get("equity_value_msek", 0.0)) if base_case else 0.0
        pv_terminal = float(base_case.get("pv_terminal_msek", 0.0)) if base_case else 0.0

        # LTM EBITDA from first projection year (base scenario)
        ltm_ebitda: float | None = None
        base_rows = scenario_rows.get("base", [])
        if base_rows:
            first_row = base_rows[0] if isinstance(base_rows[0], dict) else None
            if first_row:
                ltm_ebitda = float(first_row.get("ebitda_msek", 0.0)) or None

        implied_ev_ebitda: float | None = None
        if ltm_ebitda and ltm_ebitda > 0 and ev_base > 0:
            implied_ev_ebitda = _round2(ev_base / ltm_ebitda)

        sl = sector_range_low if sector_range_low is not None else SECTOR_SANITY_LOW
        sh = sector_range_high if sector_range_high is not None else SECTOR_SANITY_HIGH
        lint_passed, lint_warnings = _valuation_lint(
            ev_base, equity_base, net_debt, implied_ev_ebitda, sector_low=sl, sector_high=sh
        )

        terminal_dominance = (
            ev_base > 0 and pv_terminal > 0 and (pv_terminal / ev_base) > TERMINAL_DOMINANCE_THRESHOLD
        )

        return {
            "method": self.method,
            "enterprise_value_msek": _round2(ev_base) if base_case else None,
            "equity_value_msek": _round2(equity_base) if base_case else None,
            "valuation_range_low_msek": _round2(range_low) if range_low is not None else None,
            "valuation_range_high_msek": _round2(range_high) if range_high is not None else None,
            "currency": "SEK",
            "scenario_valuations": scenario_values,
            "net_debt_msek": _round2(net_debt),
            "implied_ev_ebitda": implied_ev_ebitda,
            "sector_sanity_range_low": sl,
            "sector_sanity_range_high": sh,
            "lint_passed": lint_passed,
            "lint_warnings": lint_warnings,
            "primary_method": "dcf",
            "terminal_value_dominance_warning": terminal_dominance,
        }

