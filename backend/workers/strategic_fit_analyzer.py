from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

CONFIG_ENV_VAR = "INVESTMENT_CRITERIA_PATH"
DEFAULT_CONFIG_PATH = Path(__file__).resolve().parents[1] / "config" / "investment_criteria.json"


@dataclass
class StrategicFitResult:
    score: int
    defensibility: int
    risk_flags: List[str]
    upside_potential: str
    rationale: str
    matched_strategy: str


class StrategicFitAnalyzer:
    """
    Lightweight heuristic scorer that compares a company's metrics to the configured
    investment criteria. Output is later blended with the LLM-based strategic analysis.
    """

    def __init__(self, config_path: Optional[str] = None) -> None:
        path = self._resolve_config_path(config_path)
        self._criteria = self._load_config(path)
        self._default_strategy = self._criteria.get("default_strategy") or next(
            iter(self._criteria.get("strategies", {}) or {"core": {}})
        )

    def evaluate(
        self,
        company_name: str,
        financial_metrics: Optional[Dict[str, Any]],
        summary: Optional[Dict[str, Any]],
        strategy_key: Optional[str] = None,
    ) -> StrategicFitResult:
        strategy = self._get_strategy(strategy_key)
        score = 5
        defensibility = 5
        risk_flags: List[str] = []
        upside_points: List[str] = []
        rationale_parts: List[str] = []

        revenue = self._parse_number(financial_metrics, ["latest_revenue_sek", "revenue"])
        if revenue is not None:
            min_rev = strategy.get("revenue_min")
            max_rev = strategy.get("revenue_max")
            if min_rev and revenue < min_rev:
                score -= 2
                risk_flags.append(f"Omsättning under mål ({revenue:,.0f} SEK < {min_rev:,.0f} SEK)")
            elif max_rev and revenue > max_rev:
                score -= 1
                risk_flags.append(f"Omsättning över mål ({revenue:,.0f} SEK > {max_rev:,.0f} SEK)")
            else:
                score += 1
                rationale_parts.append("Omsättning inom målspann")

        ebitda_margin = self._parse_ratio(financial_metrics, ["avg_ebitda_margin", "ebitda_margin"])
        if ebitda_margin is not None:
            target_margin = strategy.get("ebitda_margin_min")
            if target_margin and ebitda_margin < target_margin:
                score -= 1
                risk_flags.append(f"EBITDA-marginal {ebitda_margin:.0%} under mål {target_margin:.0%}")
            else:
                score += 1
                defensibility += 1
                rationale_parts.append(f"EBITDA-marginal {ebitda_margin:.0%}")

        cagr = self._parse_ratio(financial_metrics, ["revenue_cagr_3y", "revenue_growth_yoy"])
        if cagr is not None:
            growth_min = strategy.get("growth_min")
            if growth_min and cagr < growth_min:
                score -= 1
                risk_flags.append(f"Tillväxt {cagr:.0%} under mål {growth_min:.0%}")
            else:
                score += 1
                rationale_parts.append(f"Tillväxt {cagr:.0%}")

        if summary:
            value_chain = summary.get("value_chain_position") or ""
            if value_chain:
                defensibility += 1
                rationale_parts.append(f"Position i värdekedja: {value_chain}")

        preferred_keywords = strategy.get("preferred_keywords") or []
        if preferred_keywords and summary:
            description = (summary.get("product_description") or "").lower()
            match = any(keyword.lower() in description for keyword in preferred_keywords)
            if match:
                score += 1
                upside_points.append("Matchar prioriterat produktfokus")

        defensibility = max(1, min(10, defensibility))
        score = max(1, min(10, score))

        upside_text = "; ".join(upside_points) if upside_points else strategy.get("default_upside", "")
        rationale = "; ".join(rationale_parts) if rationale_parts else "Standardbedömning enligt investeringskriterier."

        return StrategicFitResult(
            score=score,
            defensibility=defensibility,
            risk_flags=risk_flags,
            upside_potential=upside_text,
            rationale=rationale,
            matched_strategy=strategy.get("name", strategy_key or self._default_strategy),
        )

    def _get_strategy(self, strategy_key: Optional[str]) -> Dict[str, Any]:
        strategies = self._criteria.get("strategies", {})
        key = strategy_key or self._default_strategy
        if key not in strategies:
            logger.warning("Unknown strategy %s, falling back to default %s", key, self._default_strategy)
            key = self._default_strategy
        return strategies.get(key, {})

    @staticmethod
    def _parse_number(metrics: Optional[Dict[str, Any]], keys: List[str]) -> Optional[float]:
        if not metrics:
            return None
        for key in keys:
            value = metrics.get(key)
            if isinstance(value, (int, float)):
                return float(value)
        return None

    @staticmethod
    def _parse_ratio(metrics: Optional[Dict[str, Any]], keys: List[str]) -> Optional[float]:
        value = StrategicFitAnalyzer._parse_number(metrics, keys)
        if value is None:
            return None
        if value > 1.5:  # Likely stored as percent (e.g., 15 instead of .15)
            return value / 100
        return value

    @staticmethod
    def _resolve_config_path(config_path: Optional[str]) -> Path:
        if config_path:
            return Path(config_path).expanduser()
        env_path = os.getenv(CONFIG_ENV_VAR)
        if env_path:
            return Path(env_path).expanduser()
        return DEFAULT_CONFIG_PATH

    @staticmethod
    def _load_config(path: Path) -> Dict[str, Any]:
        if path.exists():
            with path.open("r", encoding="utf-8") as file:
                return json.load(file)
        logger.warning("Investment criteria config missing at %s. Using safe defaults.", path)
        return {
            "default_strategy": "core",
            "strategies": {
                "core": {
                    "name": "Core Thesis",
                    "revenue_min": 10000000,
                    "revenue_max": 200000000,
                    "ebitda_margin_min": 0.1,
                    "growth_min": 0.05,
                    "default_upside": "Operativ förbättring och kommersiell acceleration.",
                }
            },
        }


__all__ = ["StrategicFitAnalyzer", "StrategicFitResult"]

