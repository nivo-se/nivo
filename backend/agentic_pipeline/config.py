"""Configuration models for the agentic targeting pipeline."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Sequence


@dataclass(slots=True)
class SegmentWeighting:
    """Weight configuration for ranking components."""

    growth: float = 0.35
    profitability: float = 0.25
    efficiency: float = 0.2
    risk: float = 0.1
    data_quality: float = 0.1

    def as_sequence(self) -> Sequence[float]:
        return [
            self.growth,
            self.profitability,
            self.efficiency,
            self.risk,
            self.data_quality,
        ]


@dataclass(slots=True)
class PipelineConfig:
    """Top-level configuration for the targeting pipeline."""

    db_path: Path = Path("allabolag.db")
    shortlist_table: str = "target_company_shortlist"
    shortlist_view_versioned_prefix: str = "target_company_shortlist_v"
    feature_columns: List[str] = field(
        default_factory=lambda: [
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
    )
    ranking_weights: SegmentWeighting = field(default_factory=SegmentWeighting)
    n_top_companies: int = 30
    output_dir: Path = Path("outputs/agentic")
    write_to_db: bool = True
    write_to_csv: bool = True
    write_to_excel: bool = True
    excel_filename: str = "agentic_shortlist.xlsx"
    csv_filename: str = "agentic_shortlist.csv"

    def ensure_output_dirs(self) -> None:
        self.output_dir.mkdir(parents=True, exist_ok=True)


__all__ = ["PipelineConfig", "SegmentWeighting"]
