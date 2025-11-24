"""
Analysis Workflow Orchestrator

Coordinates the 3-stage workflow and manages run state.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional

from ..services.db_factory import get_database_service
from .stage1_filter import FilterCriteria, FinancialFilter
from .stage2_research import ResearchData, research_batch
from .stage3_analysis import AIAnalyzer, AnalysisResult

logger = logging.getLogger(__name__)


@dataclass
class RunResult:
    """Result of a workflow run"""
    run_id: str
    status: str
    stage1_count: int
    stage2_count: int
    stage3_count: int
    started_at: str
    completed_at: Optional[str] = None
    error_message: Optional[str] = None


class AnalysisWorkflow:
    """Orchestrates the 3-stage analysis workflow"""
    
    def __init__(self):
        self.db = get_database_service()
        self.filter = FinancialFilter()
        self.analyzer = AIAnalyzer()
    
    async def run(
        self,
        criteria: FilterCriteria,
        created_by: str = "system"
    ) -> RunResult:
        """
        Run the complete 3-stage workflow
        
        Args:
            criteria: Financial filtering criteria
            created_by: User who initiated the run
            
        Returns:
            RunResult with execution details
        """
        # Create run record
        run_id = str(uuid.uuid4())
        started_at = datetime.utcnow().isoformat()
        
        logger.info(f"Starting analysis workflow run {run_id}")
        
        try:
            # Insert run record
            self.db.run_raw_query(
                """
                INSERT INTO acquisition_runs 
                (id, criteria, stage, status, started_at, created_by)
                VALUES (?, ?, 0, 'running', ?, ?)
                """,
                params=[run_id, criteria.__dict__, started_at, created_by]
            )
            
            # Stage 1: Financial Filter
            logger.info(f"[{run_id}] Stage 1: Financial filtering")
            orgnrs = self.filter.filter(criteria)
            stage1_count = len(orgnrs)
            
            self._update_run(run_id, stage=1, stage1_count=stage1_count)
            logger.info(f"[{run_id}] Stage 1 complete: {stage1_count} companies")
            
            if stage1_count == 0:
                self._update_run(
                    run_id,
                    status='complete',
                    completed_at=datetime.utcnow().isoformat()
                )
                return RunResult(
                    run_id=run_id,
                    status='complete',
                    stage1_count=0,
                    stage2_count=0,
                    stage3_count=0,
                    started_at=started_at,
                    completed_at=datetime.utcnow().isoformat()
                )
            
            # Get company details for research
            companies = self._get_company_details(orgnrs)
            
            # Stage 2: Web Research
            logger.info(f"[{run_id}] Stage 2: Web research ({len(companies)} companies)")
            research_results = await research_batch(companies, max_concurrent=10)
            stage2_count = len(research_results)
            
            # Store research results
            self._store_research_results(run_id, research_results)
            self._update_run(run_id, stage=2, stage2_count=stage2_count)
            logger.info(f"[{run_id}] Stage 2 complete: {stage2_count} researched")
            
            # Stage 3: AI Analysis
            logger.info(f"[{run_id}] Stage 3: AI analysis")
            analysis_results = await self._run_stage3(run_id, orgnrs, research_results)
            stage3_count = len(analysis_results)
            
            # Store analysis results
            self._store_analysis_results(run_id, analysis_results)
            self._update_run(
                run_id,
                stage=3,
                stage3_count=stage3_count,
                status='complete',
                completed_at=datetime.utcnow().isoformat()
            )
            logger.info(f"[{run_id}] Stage 3 complete: {stage3_count} analyzed")
            
            return RunResult(
                run_id=run_id,
                status='complete',
                stage1_count=stage1_count,
                stage2_count=stage2_count,
                stage3_count=stage3_count,
                started_at=started_at,
                completed_at=datetime.utcnow().isoformat()
            )
            
        except Exception as e:
            logger.error(f"[{run_id}] Workflow failed: {e}")
            self._update_run(
                run_id,
                status='failed',
                error_message=str(e),
                completed_at=datetime.utcnow().isoformat()
            )
            raise
    
    async def _run_stage3(
        self,
        run_id: str,
        orgnrs: List[str],
        research_results: List[ResearchData]
    ) -> List[AnalysisResult]:
        """Run Stage 3 analysis in parallel"""
        
        # Create lookup for research data
        research_map = {r.orgnr: r for r in research_results}
        
        # Get financial data for all companies
        financial_map = self._get_financial_data(orgnrs)
        
        # Analyze in batches
        semaphore = asyncio.Semaphore(5)  # Max 5 concurrent
        
        async def analyze_with_limit(orgnr: str):
            async with semaphore:
                financial = financial_map.get(orgnr, {})
                research = research_map.get(orgnr)
                company_name = financial.get('company_name', orgnr)
                
                return await self.analyzer.analyze_company(
                    orgnr=orgnr,
                    company_name=company_name,
                    financial_data=financial,
                    research_data=research
                )
        
        tasks = [analyze_with_limit(orgnr) for orgnr in orgnrs]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter out exceptions
        return [r for r in results if isinstance(r, AnalysisResult)]
    
    def _get_company_details(self, orgnrs: List[str]) -> List[tuple]:
        """Get company details for research"""
        placeholders = ','.join('?' * len(orgnrs))
        sql = f"""
        SELECT c.orgnr, c.company_name, c.homepage
        FROM companies c
        WHERE c.orgnr IN ({placeholders})
        """
        
        rows = self.db.run_raw_query(sql, params=orgnrs)
        return [(r['orgnr'], r['company_name'], r.get('homepage')) for r in rows]
    
    def _get_financial_data(self, orgnrs: List[str]) -> dict:
        """Get financial data for companies"""
        placeholders = ','.join('?' * len(orgnrs))
        sql = f"""
        SELECT c.orgnr, c.company_name, c.employees_latest,
               m.latest_revenue_sek, m.avg_ebitda_margin, m.revenue_cagr_3y
        FROM companies c
        LEFT JOIN company_metrics m ON m.orgnr = c.orgnr
        WHERE c.orgnr IN ({placeholders})
        """
        
        rows = self.db.run_raw_query(sql, params=orgnrs)
        
        return {
            r['orgnr']: {
                'company_name': r['company_name'],
                'revenue': r.get('latest_revenue_sek'),
                'ebitda_margin': r.get('avg_ebitda_margin'),
                'growth': r.get('revenue_cagr_3y'),
                'employees': r.get('employees_latest'),
            }
            for r in rows
        }
    
    def _store_research_results(self, run_id: str, results: List[ResearchData]):
        """Store research results in database"""
        for research in results:
            try:
                self.db.run_raw_query(
                    """
                    INSERT INTO company_research 
                    (orgnr, run_id, homepage_url, website_content, about_text, 
                     products_text, search_results, digital_score, scrape_success, search_success)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT (orgnr) DO UPDATE SET
                        run_id = excluded.run_id,
                        homepage_url = excluded.homepage_url,
                        website_content = excluded.website_content,
                        about_text = excluded.about_text,
                        products_text = excluded.products_text,
                        search_results = excluded.search_results,
                        digital_score = excluded.digital_score,
                        scrape_success = excluded.scrape_success,
                        search_success = excluded.search_success,
                        researched_at = NOW()
                    """,
                    params=[
                        research.orgnr,
                        run_id,
                        research.homepage_url,
                        research.website_content,
                        research.about_text,
                        research.products_text,
                        research.search_results,
                        research.digital_score,
                        research.scrape_success,
                        research.search_success,
                    ]
                )
            except Exception as e:
                logger.error(f"Failed to store research for {research.orgnr}: {e}")
    
    def _store_analysis_results(self, run_id: str, results: List[AnalysisResult]):
        """Store analysis results in database"""
        for analysis in results:
            try:
                self.db.run_raw_query(
                    """
                    INSERT INTO company_analysis 
                    (orgnr, run_id, business_model, products_summary, market_position,
                     swot_strengths, swot_weaknesses, swot_opportunities, swot_threats,
                     strategic_fit_score, recommendation, investment_memo, raw_analysis)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    params=[
                        analysis.orgnr,
                        run_id,
                        analysis.business_model,
                        analysis.products_summary,
                        analysis.market_position,
                        analysis.swot_strengths,
                        analysis.swot_weaknesses,
                        analysis.swot_opportunities,
                        analysis.swot_threats,
                        analysis.strategic_fit_score,
                        analysis.recommendation,
                        analysis.investment_memo,
                        analysis.raw_analysis,
                    ]
                )
            except Exception as e:
                logger.error(f"Failed to store analysis for {analysis.orgnr}: {e}")
    
    def _update_run(self, run_id: str, **kwargs):
        """Update run record"""
        updates = []
        params = []
        
        for key, value in kwargs.items():
            updates.append(f"{key} = ?")
            params.append(value)
        
        params.append(run_id)
        
        sql = f"""
        UPDATE acquisition_runs
        SET {', '.join(updates)}
        WHERE id = ?
        """
        
        self.db.run_raw_query(sql, params=params)
