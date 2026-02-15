"""Ranking logic for shortlisted companies."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict

import numpy as np
import pandas as pd

from .config import SegmentWeighting


@dataclass(slots=True)
class RankingResult:
    scores: pd.Series
    components: pd.DataFrame


class CompositeRanker:
    """Combines feature-derived metrics into a single score."""

    def __init__(self, weights: SegmentWeighting) -> None:
        self.weights = weights

    def _normalize(self, series: pd.Series) -> pd.Series:
        if series.std(ddof=0) == 0:
            return pd.Series(0.0, index=series.index)
        normalized = (series - series.mean()) / (series.std(ddof=0) + 1e-9)
        return normalized.clip(lower=-3, upper=3)

    def compute_components(self, dataset: pd.DataFrame) -> pd.DataFrame:
        components = pd.DataFrame(index=dataset.index)
        components["growth"] = self._normalize(dataset.get("revenue_growth", pd.Series(0, index=dataset.index)))
        components["profitability"] = self._normalize(dataset.get("ebit_margin", pd.Series(0, index=dataset.index)))
        components["efficiency"] = self._normalize(dataset.get("revenue_per_employee", pd.Series(0, index=dataset.index)))
        risk_proxy = 1 - dataset.get("equity_ratio", pd.Series(0, index=dataset.index)).fillna(0)
        components["risk"] = -self._normalize(risk_proxy)
        data_quality_proxy = dataset.notna().mean(axis=1)
        components["data_quality"] = data_quality_proxy
        return components.fillna(0)

    def score(self, dataset: pd.DataFrame) -> RankingResult:
        components = self.compute_components(dataset)
        weights = np.array(self.weights.as_sequence())
        score_values = components.mul(weights, axis=1).sum(axis=1)
        return RankingResult(scores=score_values.rename("composite_score"), components=components)


__all__ = ["CompositeRanker", "RankingResult"]
