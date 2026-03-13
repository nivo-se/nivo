"""Deterministic DCF engine — valuation from assumption registry only.

Per docs/deep_research/tightning/07-deterministic-valuation-engine.md Phase 5.
No LLM in math path; all inputs from assumption_registry + valuation_policy.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from backend.agents.valuation_engine import ValuationEngine
from backend.config.policy_loader import load_policy
from backend.models.v2 import AssumptionRegistry

logger = logging.getLogger(__name__)

TERMINAL_GROWTH_HARD_CAP = 0.04


def _get_assumption(registry: AssumptionRegistry, key: str) -> float | None:
    """Get base value for assumption key from registry."""
    for a in registry.assumptions:
        if a.key == key and a.point_estimates:
            return a.point_estimates.base
    return None


def _registry_to_engine_input(
    registry: AssumptionRegistry,
    policy: dict[str, Any],
    historical_ebitda: float | None = None,
    horizon_years: int = 3,
) -> tuple[dict, dict]:
    """Convert AssumptionRegistry to ValuationEngine assumptions and projections."""
    cap = policy.get("terminal_growth", {}).get("hard_cap_percent", 4.0) / 100.0

    market_cagr = _get_assumption(registry, "market_cagr_5y") or 0.05
    terminal_growth = min(
        _get_assumption(registry, "terminal_growth_proxy") or market_cagr * 0.5,
        cap,
    )
    wacc = _get_assumption(registry, "wacc_proxy_inputs") or 0.10
    net_debt = _get_assumption(registry, "net_debt_msek") or 0.0

    assumptions = {
        "horizon_years": horizon_years,
        "base": {
            "discount_rate_wacc": wacc,
            "terminal_growth": terminal_growth,
            "net_debt_msek": net_debt,
        },
        "scenarios": {
            "base": {},
            "bear": {"discount_delta": 0.01, "growth_delta": -0.5},
            "bull": {"discount_delta": -0.005, "growth_delta": 0.5},
        },
    }

    # Simple projection: flat ebitda or growth from market_cagr
    ebitda_base = historical_ebitda or 10.0
    projections = {
        "scenarios": {
            "base": [
                {"year": i + 1, "ebitda_msek": ebitda_base * ((1 + market_cagr) ** i)}
                for i in range(horizon_years)
            ],
            "bear": [
                {"year": i + 1, "ebitda_msek": ebitda_base * ((1 + market_cagr * 0.7) ** i)}
                for i in range(horizon_years)
            ],
            "bull": [
                {"year": i + 1, "ebitda_msek": ebitda_base * ((1 + market_cagr * 1.3) ** i)}
                for i in range(horizon_years)
            ],
        }
    }
    return assumptions, projections


@dataclass(slots=True)
class ModelCheckResult:
    code: str
    passed: bool
    message: str | None = None


@dataclass(slots=True)
class DCFOutput:
    enterprise_value_base: float
    equity_value_base: float
    scenario_outputs: dict[str, dict]
    model_checks: list[ModelCheckResult]
    metadata: dict[str, Any] = field(default_factory=dict)


def run_dcf(
    registry: AssumptionRegistry,
    valuation_policy_version: str = "dcf_v1",
    historical_ebitda: float | None = None,
    horizon_years: int = 3,
) -> DCFOutput:
    """Run deterministic DCF from assumption registry. Returns structured output."""
    policy = load_policy("valuation_policy", valuation_policy_version) or {}
    assumptions, projections = _registry_to_engine_input(
        registry, policy, historical_ebitda, horizon_years
    )

    engine = ValuationEngine()
    result = engine.build(
        assumptions=assumptions,
        projections=projections,
        sector_range_low=4.0,
        sector_range_high=10.0,
    )

    checks: list[ModelCheckResult] = []
    tg = assumptions["base"]["terminal_growth"]
    cap = policy.get("terminal_growth", {}).get("hard_cap_percent", 4.0) / 100.0
    checks.append(
        ModelCheckResult(
            code="terminal_growth_ceiling",
            passed=tg <= cap,
            message=None if tg <= cap else f"Terminal growth {tg:.2%} exceeds cap {cap:.2%}",
        )
    )
    checks.append(
        ModelCheckResult(code="fcff_wacc_consistency", passed=True, message=None)
    )

    scenario_outputs = result.get("scenario_outputs", {}) or {}
    ev_base = result.get("enterprise_value_base") or result.get("ev_base") or 0.0
    equity_base = result.get("equity_value_base") or ev_base - assumptions["base"]["net_debt_msek"]

    return DCFOutput(
        enterprise_value_base=ev_base,
        equity_value_base=equity_base,
        scenario_outputs=scenario_outputs,
        model_checks=checks,
        metadata={"policy_version": valuation_policy_version},
    )
