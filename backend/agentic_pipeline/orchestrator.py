"""Agentic pipeline orchestrator coordinating segmentation and analysis."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

import pandas as pd

from .analysis import MarketFinancialAnalyzer
from .config import PipelineConfig
from .data_access import TargetingDataLoader
from .features import FeatureEngineer
from .quality import DataQualityChecker
from .ranking import CompositeRanker
from .segmentation import Segmenter


@dataclass(slots=True)
class PipelineArtifacts:
    dataset: pd.DataFrame
    features: pd.DataFrame
    shortlist: pd.DataFrame
    quality_issues: list


class AgenticTargetingPipeline:
    """Coordinates the end-to-end selection workflow."""

    def __init__(self, config: PipelineConfig) -> None:
        self.config = config
        self.loader = TargetingDataLoader(config.db_path)
        self.feature_engineer = FeatureEngineer(required_columns=config.feature_columns)
        self.quality_checker = DataQualityChecker(required_columns=config.feature_columns)
        self.segmenter = Segmenter()
        self.ranker = CompositeRanker(config.ranking_weights)
        self.analyzer = MarketFinancialAnalyzer()

    def run(self) -> PipelineArtifacts:
        self.config.ensure_output_dirs()

        load_result = self.loader.load()
        dataset = load_result.dataset
        quality_issues = load_result.issues

        if dataset.empty:
            raise RuntimeError("Dataset is empty; cannot proceed with pipeline.")

        engineered = self.feature_engineer.transform(dataset)
        quality_issues.extend(self.quality_checker.run(engineered.features))

        segmentation = self.segmenter.fit_predict(engineered.features[self.config.feature_columns])
        dataset = dataset.join(segmentation.labels)

        ranking = self.ranker.score(engineered.features[self.config.feature_columns])
        dataset = dataset.join(ranking.scores)
        dataset = dataset.join(ranking.components.add_prefix("score_component_"))

        analysis = self.analyzer.analyze(dataset)
        dataset = dataset.join(analysis.market_summary)
        dataset = dataset.join(analysis.financial_summary)
        dataset = dataset.join(analysis.risk_flags)

        shortlist = dataset.sort_values("composite_score", ascending=False).head(self.config.n_top_companies)
        shortlist = shortlist.reset_index(drop=True)

        self._persist(shortlist, segmentation.cluster_centers)

        return PipelineArtifacts(
            dataset=dataset,
            features=engineered.features,
            shortlist=shortlist,
            quality_issues=quality_issues,
        )

    def _persist(self, shortlist: pd.DataFrame, centers: pd.DataFrame) -> None:
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        if self.config.write_to_csv:
            csv_path = self.config.output_dir / f"{timestamp}_{self.config.csv_filename}"
            shortlist.to_csv(csv_path, index=False)
        if self.config.write_to_excel:
            excel_path = self.config.output_dir / f"{timestamp}_{self.config.excel_filename}"
            shortlist.to_excel(excel_path, index=False)

        if self.config.write_to_db:
            engine = self.loader.engine
            shortlist.to_sql(self.config.shortlist_table, engine, if_exists="replace", index=False)
            versioned_table = f"{self.config.shortlist_view_versioned_prefix}{timestamp}"
            shortlist.to_sql(versioned_table, engine, if_exists="replace", index=False)
            centers.to_sql("target_segment_centers", engine, if_exists="replace", index=False)


__all__ = ["AgenticTargetingPipeline", "PipelineArtifacts"]
