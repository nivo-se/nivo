"""Data quality checks for the targeting pipeline."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import pandas as pd


@dataclass(slots=True)
class QualityIssue:
    level: str
    message: str


class DataQualityChecker:
    """Runs data quality heuristics and returns human-readable findings."""

    def __init__(self, required_columns: Iterable[str]) -> None:
        self.required_columns = set(required_columns)

    def run(self, dataset: pd.DataFrame) -> list[QualityIssue]:
        issues: list[QualityIssue] = []
        if dataset.empty:
            issues.append(QualityIssue("critical", "Dataset is empty after loading."))
            return issues

        missing_cols = self.required_columns.difference(dataset.columns)
        if missing_cols:
            issues.append(
                QualityIssue(
                    "critical",
                    f"Missing required columns: {', '.join(sorted(missing_cols))}",
                )
            )

        for col in self.required_columns.intersection(dataset.columns):
            null_ratio = dataset[col].isna().mean()
            if null_ratio > 0.5:
                issues.append(
                    QualityIssue(
                        "warning",
                        f"Column '{col}' has {null_ratio:.0%} missing values.",
                    )
                )

        return issues


__all__ = ["DataQualityChecker", "QualityIssue"]
