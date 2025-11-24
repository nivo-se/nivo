
import sys
import os
import asyncio
import pandas as pd
from unittest.mock import MagicMock, patch

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from agentic_pipeline.staged_workflow import StagedTargetingWorkflow, StagePlan
from agentic_pipeline.config import PipelineConfig
from agentic_pipeline.ai_analysis import AgenticLLMAnalyzer, AIAnalysisBatch, ScreeningBatch, ScreeningResult, CompanyAnalysisRecord, AnalysisAuditRecord

# Mock OpenAI and Supabase
with patch('agentic_pipeline.ai_analysis.OpenAI'), \
     patch('agentic_pipeline.ai_analysis.create_client'):

    print("🚀 Starting Workflow Verification")
    
    # 1. Setup Config
    config = PipelineConfig(
        db_path="data/nivo_optimized.db",
        min_revenue=100_000, # Low threshold to ensure we get results
        min_employees=1,
        n_top_companies=10
    )
    
    # 2. Setup Plan (Small sizes for testing)
    plan = StagePlan(
        stage_one_size=5,
        stage_two_size=3,
        stage_three_size=2
    )
    
    # 3. Mock Analyzer to avoid API calls
    mock_analyzer = MagicMock(spec=AgenticLLMAnalyzer)
    
    # Mock Screening Result
    mock_screening_batch = ScreeningBatch(
        run=MagicMock(),
        results=[
            ScreeningResult(
                run_id="test", orgnr="123", company_name="Test Co", 
                screening_score=85, risk_flag="Low", brief_summary="Good",
                analysis_generated_at=None, audit=None, raw_json={}
            )
        ] * 3
    )
    mock_analyzer.run_screening.return_value = mock_screening_batch
    
    # Mock Deep Analysis Result
    mock_analysis_batch = AIAnalysisBatch(
        run=MagicMock(),
        companies=[
            CompanyAnalysisRecord(
                run_id="test", orgnr="123", company_name="Test Co",
                summary="Deep analysis summary", recommendation="Buy",
                confidence=0.9, risk_score=1, financial_grade="A",
                commercial_grade="A", operational_grade="A", next_steps=[],
                analysis_generated_at=None, sections=[], metrics=[],
                audit=MagicMock(), raw_json={}
            )
        ] * 2
    )
    mock_analyzer.run.return_value = mock_analysis_batch
    
    # 4. Run Workflow
    workflow = StagedTargetingWorkflow(
        pipeline_config=config,
        plan=plan,
        analyzer=mock_analyzer
    )
    
    print("\n--- Running Stage 1 (Financials) ---")
    try:
        stage1 = workflow.run_stage_one()
        print(f"✅ Stage 1 Complete. Shortlist size: {len(stage1.shortlist)}")
        print(stage1.shortlist[['company_name', 'revenue', 'revenue_growth']].head())
    except Exception as e:
        print(f"❌ Stage 1 Failed: {e}")
        sys.exit(1)
        
    print("\n--- Running Stage 2 (Screening) ---")
    try:
        stage2 = workflow.run_stage_two(stage1)
        print(f"✅ Stage 2 Complete. Screening results: {len(stage2.screening.results)}")
    except Exception as e:
        print(f"❌ Stage 2 Failed: {e}")
        sys.exit(1)

    print("\n--- Running Stage 3 (Deep Analysis) ---")
    try:
        stage3 = workflow.run_stage_three(stage2)
        print(f"✅ Stage 3 Complete. Analysis results: {len(stage3.analysis.companies)}")
    except Exception as e:
        print(f"❌ Stage 3 Failed: {e}")
        sys.exit(1)

    print("\n🎉 Verification Successful!")
