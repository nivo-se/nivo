"""Segmentation logic for target company selection."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler


@dataclass(slots=True)
class SegmentationResult:
    labels: pd.Series
    cluster_centers: pd.DataFrame
    inertia: float


class Segmenter:
    """Clusters companies based on engineered features."""

    def __init__(self, n_clusters: int = 6, random_state: int = 42) -> None:
        self.n_clusters = n_clusters
        self.random_state = random_state
        self._scaler: Optional[StandardScaler] = None
        self._model: Optional[KMeans] = None

    def fit_predict(self, features: pd.DataFrame) -> SegmentationResult:
        if features.empty:
            raise ValueError("Cannot segment an empty feature frame.")

        self._scaler = StandardScaler()
        scaled = self._scaler.fit_transform(features)

        self._model = KMeans(n_clusters=self.n_clusters, random_state=self.random_state, n_init="auto")
        labels = self._model.fit_predict(scaled)

        centers = pd.DataFrame(
            self._scaler.inverse_transform(self._model.cluster_centers_),
            columns=features.columns,
        )
        return SegmentationResult(
            labels=pd.Series(labels, index=features.index, name="segment_id"),
            cluster_centers=centers,
            inertia=float(self._model.inertia_),
        )


__all__ = ["Segmenter", "SegmentationResult"]
