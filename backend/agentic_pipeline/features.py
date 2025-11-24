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
        
        # Helper to find column case-insensitive
        def get_col(candidates):
            for cand in candidates:
                for col in frame.columns:
                    if col.lower() == cand.lower():
                        return frame[col]
            return pd.Series(dtype=float)

        # Map columns
        frame["revenue"] = get_col(["revenue", "latest_revenue_sek", "sdi_sek", "net_turnover", "omsattning"])
        frame["revenue_growth"] = get_col(["revenue_growth", "revenue_growth_yoy", "revenuegrowth"])
        frame["ebit_margin"] = get_col(["ebit_margin", "avg_ebit_margin", "ebitmargin"])
        frame["net_margin"] = get_col(["net_margin", "avg_net_margin", "netprofit_margin"])
        
        employees_col = get_col(["employees", "latest_employees", "antalanstallda"])
        # Handle ranges like "10-19"
        if employees_col.dtype == 'object':
            def parse_employees(val):
                if isinstance(val, str) and '-' in val:
                    try:
                        parts = val.split('-')
                        return (float(parts[0]) + float(parts[1])) / 2
                    except:
                        return 0
                try:
                    return float(val)
                except:
                    return 0
            employees_col = employees_col.apply(parse_employees)
            
        frame["employees"] = employees_col.fillna(0)
        
        frame["ebit"] = get_col(["ebit", "latest_ebit_sek", "dr_sek", "ebit_sek"]).fillna(0)
        frame["assets"] = get_col(["assets", "totalatillgangar", "br_sek"]).fillna(0) 
        frame["equity"] = get_col(["equity", "latest_equity_sek", "ek_sek", "egetkapital"]).fillna(0)

        # If revenue is still empty, try to use sdi_sek directly if it exists with suffix
        if frame["revenue"].empty and "sdi_sek" in frame.columns:
             frame["revenue"] = frame["sdi_sek"]

        frame["revenue_per_employee"] = self._safe_ratio(frame["revenue"], frame["employees"]).fillna(0)
        frame["ebit_per_employee"] = self._safe_ratio(frame["ebit"], frame["employees"]).fillna(0)
        frame["equity_ratio"] = self._safe_ratio(frame["equity"], frame["assets"]).fillna(0)

        numeric_cols = [
            "revenue",
            "revenue_growth",
            "ebit",  # Added for filtering
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
