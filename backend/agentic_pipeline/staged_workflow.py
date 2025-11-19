"""Two-stage, manually-triggered targeting workflow.

Stage 1 builds a financial shortlist with clustering/weights only from
structured data so operators can assemble an "interesting" list without
waiting on enrichment. Stage 2 runs opt-in AI screening on that list to
select ~100 companies for deeper analysis.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Optional

import pandas as pd

from .ai_analysis import AIAnalysisConfig, AgenticLLMAnalyzer, ScreeningBatch
from .config import PipelineConfig
from .orchestrator import AgenticTargetingPipeline, PipelineArtifacts


@dataclass(slots=True)
class StagePlan:
    """Operator-controlled plan for staged targeting runs."""

    stage_one_size: int = 180
    stage_two_size: int = 100
    screening_batch_size: int = 10


@dataclass(slots=True)
class StageOneResult:
    """Outputs of the financial segmentation stage."""

    artifacts: PipelineArtifacts
    shortlist: pd.DataFrame


@dataclass(slots=True)
class StageTwoResult:
    """Outputs of the AI screening stage."""

    shortlist: pd.DataFrame
    screening: ScreeningBatch


class StagedTargetingWorkflow:
    """Manual-first orchestration with explicit Stage 1 and Stage 2 hops."""

    def __init__(
        self,
        *,
        pipeline_config: Optional[PipelineConfig] = None,
        analysis_config: Optional[AIAnalysisConfig] = None,
        plan: Optional[StagePlan] = None,
        analyzer: Optional[AgenticLLMAnalyzer] = None,
    ) -> None:
        self.plan = plan or StagePlan()
        self.pipeline_config = pipeline_config or PipelineConfig()
        self.analysis_config = analysis_config or AIAnalysisConfig(batch_size=self.plan.screening_batch_size)
        self._analyzer = analyzer

    def run_stage_one(self) -> StageOneResult:
        """Run financial segmentation and return a shortlist ready for Stage 2."""

        # Avoid mutating the shared config while applying Stage 1 sizing.
        stage_one_config = replace(self.pipeline_config, n_top_companies=self.plan.stage_one_size)
        pipeline = AgenticTargetingPipeline(stage_one_config)
        artifacts = pipeline.run()
        shortlist = artifacts.shortlist.head(self.plan.stage_one_size).copy()
        return StageOneResult(artifacts=artifacts, shortlist=shortlist)

    def run_stage_two(
        self,
        stage_one: StageOneResult,
        *,
        initiated_by: Optional[str] = None,
        filters: Optional[dict] = None,
    ) -> StageTwoResult:
        """Run AI screening on the Stage 1 shortlist to converge on ~100 companies."""

        if stage_one.shortlist.empty:
            raise ValueError("Stage 1 shortlist is empty; run Stage 1 before Stage 2.")

        shortlist_for_stage_two = stage_one.shortlist.head(self.plan.stage_two_size).copy()
        analyzer = self._analyzer or AgenticLLMAnalyzer(self.analysis_config)
        screening = analyzer.run_screening(
            shortlist_for_stage_two,
            limit=self.plan.stage_two_size,
            initiated_by=initiated_by,
            filters=filters or {"stage": "stage_two_screening"},
        )

        return StageTwoResult(shortlist=shortlist_for_stage_two, screening=screening)

