"""
Analysis Workflow Module

A clean 3-stage workflow for identifying targets:
1. Filter (SQL)
2. Research (Web)
3. Analyze (AI)
"""

from .stage1_filter import FilterCriteria, FinancialFilter, IntentAnalyzer
from .stage2_research import ResearchData, research_batch
from .stage3_analysis import AIAnalyzer, AnalysisResult
from .workflow import AnalysisWorkflow, RunResult

__all__ = [
    "FilterCriteria",
    "FinancialFilter",
    "IntentAnalyzer",
    "ResearchData",
    "research_batch",
    "AIAnalyzer",
    "AnalysisResult",
    "AnalysisWorkflow",
    "RunResult",
]
