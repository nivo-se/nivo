"""Feature engineering utilities."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import numpy as np
import pandas as pd


@dataclass(slots=True)
class FeatureEngineeringResult:
    features: pd.DataFrame
    feature_metadata: dict[str, dict[str, float]]


class FeatureEngineer:
    """Computes engineered features for segmentation and ranking."""

    def __init__(self, required_columns: Iterable[str] | None = None) -> None:
        self.required_columns = set(required_columns or [])

    def _safe_ratio(self, numerator: pd.Series, denominator: pd.Series) -> pd.Series:
        return numerator.astype(float).fillna(0.0) / denominator.replace({0: np.nan}).astype(float)

    def transform(self, df: pd.DataFrame) -> FeatureEngineeringResult:
        frame = df.copy()
        frame.rename(
            columns={
                "SDI": "revenue",
                "DR": "ebit",
                "ORS": "net_income",
                "AntalAnstallda": "employees",
                "Omsattning": "revenue",
            },
            inplace=True,
        )

        if "employees" not in frame and "employees" in frame.columns:
            frame["employees"] = frame["employees"].fillna(0)

        frame["revenue"] = frame[[col for col in frame.columns if col.lower() == "revenue" or col == "SDI"]].iloc[:, 0]
        frame["revenue_growth"] = frame.get("Revenue_growth", frame.get("RevenueGrowth", pd.Series(dtype=float)))
        frame["ebit_margin"] = frame.get("EBIT_margin", frame.get("EBITMargin", pd.Series(dtype=float)))
        frame["net_margin"] = frame.get("NetProfit_margin", frame.get("NetProfitMargin", pd.Series(dtype=float)))
        frame["employees"] = frame.get("employees", frame.get("AntalAnstallda", pd.Series(dtype=float))).fillna(0)
        frame["ebit"] = frame.get("ebit", frame.get("EBIT", pd.Series(dtype=float))).fillna(0)
        frame["assets"] = frame.get("TotalaTillgangar", pd.Series(dtype=float)).fillna(0)
        frame["equity"] = frame.get("EgetKapital", pd.Series(dtype=float)).fillna(0)

        frame["revenue_per_employee"] = self._safe_ratio(frame["revenue"], frame["employees"]).fillna(0)
        frame["ebit_per_employee"] = self._safe_ratio(frame["ebit"], frame["employees"]).fillna(0)
        frame["equity_ratio"] = self._safe_ratio(frame["equity"], frame["assets"]).fillna(0)

        numeric_cols = [
            "revenue",
            "revenue_growth",
            "ebit_margin",
            "net_margin",
            "employees",
            "revenue_per_employee",
            "ebit_per_employee",
            "assets",
            "equity_ratio",
        ]

        engineered = frame[numeric_cols].apply(pd.to_numeric, errors="coerce").fillna(0)

        metadata: dict[str, dict[str, float]] = {}
        for column in numeric_cols:
            series = engineered[column]
            metadata[column] = {
                "mean": float(series.mean()),
                "std": float(series.std(ddof=0)),
                "min": float(series.min()),
                "max": float(series.max()),
            }

        missing_required = self.required_columns.difference(engineered.columns)
        if missing_required:
            raise ValueError(f"Missing required engineered features: {', '.join(sorted(missing_required))}")

        return FeatureEngineeringResult(engineered, metadata)


__all__ = ["FeatureEngineer", "FeatureEngineeringResult"]
