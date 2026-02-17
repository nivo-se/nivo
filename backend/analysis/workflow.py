"""
Analysis Workflow Orchestrator

Coordinates the 3-stage workflow and manages run state.
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

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
        self.analyzer: Optional[AIAnalyzer] = None
        self.analyzer_init_error: Optional[str] = None
        try:
            self.analyzer = AIAnalyzer()
        except Exception as exc:
            self.analyzer_init_error = str(exc)
            logger.warning("AI analyzer unavailable at workflow init: %s", exc)

    def create_run_record(
        self,
        criteria: FilterCriteria,
        created_by: str = "system",
        run_id: Optional[str] = None,
        started_at: Optional[str] = None,
        run_context: Optional[Dict[str, Any]] = None,
    ) -> tuple[str, str]:
        """Create acquisition_runs row and return (run_id, started_at)."""
        resolved_run_id = run_id or str(uuid.uuid4())
        resolved_started_at = started_at or datetime.utcnow().isoformat()
        criteria_payload = self._build_criteria_payload(criteria, run_context)
        self.db.run_raw_query(
            """
            INSERT INTO acquisition_runs
            (id, criteria, stage, status, started_at, created_by)
            VALUES (?::uuid, ?::jsonb, 0, 'running', ?, ?)
            """,
            params=[
                resolved_run_id,
                json.dumps(criteria_payload, ensure_ascii=False),
                resolved_started_at,
                created_by,
            ],
        )
        return resolved_run_id, resolved_started_at

    async def run(
        self,
        criteria: FilterCriteria,
        created_by: str = "system",
        run_id: Optional[str] = None,
        started_at: Optional[str] = None,
        selected_orgnrs: Optional[List[str]] = None,
        run_context: Optional[Dict[str, Any]] = None,
        create_record: bool = True,
    ) -> RunResult:
        """
        Run the complete 3-stage workflow

        Args:
            criteria: Financial filtering criteria
            created_by: User who initiated the run
            run_id: Existing run id to continue, or None to create one
            started_at: Optional precomputed start timestamp
            selected_orgnrs: Optional explicit list of target companies
            run_context: Optional metadata persisted in criteria JSON
            create_record: Whether to insert run row here

        Returns:
            RunResult with execution details
        """
        if create_record or run_id is None:
            run_id, started_at = self.create_run_record(
                criteria=criteria,
                created_by=created_by,
                run_id=run_id,
                started_at=started_at,
                run_context=run_context,
            )
        else:
            if started_at is None:
                started_at = datetime.utcnow().isoformat()
            self._update_run(
                run_id,
                stage=0,
                status="running",
                error_message=None,
                criteria=self._build_criteria_payload(criteria, run_context),
            )

        logger.info(f"Starting analysis workflow run {run_id}")

        try:
            # Stage 1: Financial Filter
            logger.info(f"[{run_id}] Stage 1: Financial filtering")
            if selected_orgnrs is not None:
                orgnrs = self._normalize_orgnrs(selected_orgnrs, criteria.max_results)
            else:
                orgnrs = self.filter.filter(criteria)
            if self._skip_existing_analyses(run_context):
                orgnrs = self._exclude_already_analyzed(orgnrs)
            stage1_count = len(orgnrs)

            self._update_run(
                run_id,
                stage=1,
                status="stage_1_complete",
                stage1_count=stage1_count,
            )
            logger.info(f"[{run_id}] Stage 1 complete: {stage1_count} companies")

            if stage1_count == 0:
                self._update_run(
                    run_id,
                    status="complete",
                    stage2_count=0,
                    stage3_count=0,
                    completed_at=datetime.utcnow().isoformat(),
                )
                return RunResult(
                    run_id=run_id,
                    status="complete",
                    stage1_count=0,
                    stage2_count=0,
                    stage3_count=0,
                    started_at=started_at,
                    completed_at=datetime.utcnow().isoformat(),
                )

            # Get company details for research
            companies = self._get_company_details(orgnrs)

            # Stage 2: Web Research
            logger.info(f"[{run_id}] Stage 2: Web research ({len(companies)} companies)")
            research_results = await research_batch(companies, max_concurrent=10)
            stage2_count = len(research_results)

            # Store research results
            self._store_research_results(run_id, research_results)
            self._update_run(
                run_id,
                stage=2,
                status="stage_2_complete",
                stage2_count=stage2_count,
            )
            logger.info(f"[{run_id}] Stage 2 complete: {stage2_count} researched")

            # Stage 3: AI Analysis
            if self.analyzer is None:
                raise RuntimeError(
                    self.analyzer_init_error or "AI analyzer is not configured"
                )
            template_prompt = None
            if run_context:
                tp = run_context.get("template_prompt")
                if isinstance(tp, str) and tp.strip():
                    template_prompt = tp
            logger.info(f"[{run_id}] Stage 3: AI analysis")
            analysis_results = await self._run_stage3(
                run_id=run_id,
                orgnrs=orgnrs,
                research_results=research_results,
                template_prompt=template_prompt,
            )
            stage3_count = len(analysis_results)

            # Store analysis results
            self._store_analysis_results(run_id, analysis_results)
            self._update_run(
                run_id,
                stage=3,
                stage3_count=stage3_count,
                status="complete",
                completed_at=datetime.utcnow().isoformat(),
            )
            logger.info(f"[{run_id}] Stage 3 complete: {stage3_count} analyzed")

            return RunResult(
                run_id=run_id,
                status="complete",
                stage1_count=stage1_count,
                stage2_count=stage2_count,
                stage3_count=stage3_count,
                started_at=started_at,
                completed_at=datetime.utcnow().isoformat(),
            )

        except Exception as e:
            logger.error(f"[{run_id}] Workflow failed: {e}")
            self._update_run(
                run_id,
                status="failed",
                error_message=str(e),
                completed_at=datetime.utcnow().isoformat(),
            )
            raise

    async def _run_stage3(
        self,
        run_id: str,
        orgnrs: List[str],
        research_results: List[ResearchData],
        template_prompt: Optional[str] = None,
    ) -> List[AnalysisResult]:
        """Run Stage 3 analysis in parallel"""

        if self.analyzer is None:
            raise RuntimeError(
                self.analyzer_init_error or "AI analyzer is not configured"
            )

        # Create lookup for research data
        research_map = {r.orgnr: r for r in research_results}

        # Get financial data for all companies
        financial_map = self._get_financial_data(orgnrs)

        # Analyze in batches
        semaphore = asyncio.Semaphore(5)  # Max 5 concurrent

        async def analyze_with_limit(orgnr: str):
            async with semaphore:
                financial = financial_map.get(orgnr, {}) or {}
                research = research_map.get(orgnr)
                company_name = str(financial.get("company_name", orgnr))

                return await self.analyzer.analyze_company(
                    orgnr=orgnr,
                    company_name=company_name,
                    financial_data=financial,
                    research_data=research,
                    template_prompt=template_prompt,
                )

        tasks = [analyze_with_limit(orgnr) for orgnr in orgnrs]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Filter out exceptions
        return [r for r in results if isinstance(r, AnalysisResult)]

    def _get_company_details(self, orgnrs: List[str]) -> List[tuple]:
        """Get company details for research"""
        if not orgnrs:
            return []
        placeholders = ",".join("?" * len(orgnrs))
        sql = f"""
        SELECT c.orgnr, c.company_name, c.homepage
        FROM companies c
        WHERE c.orgnr IN ({placeholders})
        """

        rows = self.db.run_raw_query(sql, params=orgnrs)
        return [
            (str(r["orgnr"]), str(r["company_name"]), r.get("homepage"))
            for r in rows
        ]

    def _get_financial_data(self, orgnrs: List[str]) -> dict:
        """Get financial data for companies"""
        if not orgnrs:
            return {}
        placeholders = ",".join("?" * len(orgnrs))
        sql = f"""
        SELECT c.orgnr, c.company_name, c.employees_latest, c.segment_names,
               m.latest_revenue_sek, m.avg_ebitda_margin, m.revenue_cagr_3y
        FROM companies c
        LEFT JOIN company_metrics m ON m.orgnr = c.orgnr
        WHERE c.orgnr IN ({placeholders})
        """

        rows = self.db.run_raw_query(sql, params=orgnrs)

        return {
            str(r["orgnr"]): {
                "company_name": r.get("company_name"),
                "revenue": r.get("latest_revenue_sek"),
                "ebitda_margin": r.get("avg_ebitda_margin"),
                "growth": r.get("revenue_cagr_3y"),
                "employees": r.get("employees_latest"),
                "industry_label": self._extract_segment_label(r.get("segment_names")),
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
                     products_text, search_results, extracted_products, extracted_markets, sales_channels,
                     digital_score, scrape_success, search_success)
                    VALUES (?, ?::uuid, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?, ?, ?, ?)
                    ON CONFLICT (orgnr) DO UPDATE SET
                        run_id = excluded.run_id,
                        homepage_url = excluded.homepage_url,
                        website_content = excluded.website_content,
                        about_text = excluded.about_text,
                        products_text = excluded.products_text,
                        search_results = excluded.search_results,
                        extracted_products = excluded.extracted_products,
                        extracted_markets = excluded.extracted_markets,
                        sales_channels = excluded.sales_channels,
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
                        json.dumps(research.search_results or {}, ensure_ascii=False),
                        json.dumps(research.extracted_products or [], ensure_ascii=False),
                        json.dumps(research.extracted_markets or [], ensure_ascii=False),
                        research.sales_channels or [],
                        research.digital_score,
                        research.scrape_success,
                        research.search_success,
                    ],
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
                    VALUES (?, ?::uuid, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, ?, ?, ?, ?::jsonb)
                    ON CONFLICT (orgnr, run_id) DO UPDATE SET
                        business_model = excluded.business_model,
                        products_summary = excluded.products_summary,
                        market_position = excluded.market_position,
                        swot_strengths = excluded.swot_strengths,
                        swot_weaknesses = excluded.swot_weaknesses,
                        swot_opportunities = excluded.swot_opportunities,
                        swot_threats = excluded.swot_threats,
                        strategic_fit_score = excluded.strategic_fit_score,
                        recommendation = excluded.recommendation,
                        investment_memo = excluded.investment_memo,
                        raw_analysis = excluded.raw_analysis,
                        analyzed_at = NOW()
                    """,
                    params=[
                        analysis.orgnr,
                        run_id,
                        analysis.business_model,
                        analysis.products_summary,
                        analysis.market_position,
                        json.dumps(analysis.swot_strengths or [], ensure_ascii=False),
                        json.dumps(analysis.swot_weaknesses or [], ensure_ascii=False),
                        json.dumps(analysis.swot_opportunities or [], ensure_ascii=False),
                        json.dumps(analysis.swot_threats or [], ensure_ascii=False),
                        analysis.strategic_fit_score,
                        analysis.recommendation,
                        analysis.investment_memo,
                        json.dumps(analysis.raw_analysis or {}, ensure_ascii=False),
                    ],
                )
            except Exception as e:
                logger.error(f"Failed to store analysis for {analysis.orgnr}: {e}")

    def _update_run(self, run_id: str, **kwargs):
        """Update run record"""
        if not kwargs:
            return
        updates = []
        params = []

        for key, value in kwargs.items():
            if key == "criteria" or isinstance(value, (dict, list)):
                updates.append(f"{key} = ?::jsonb")
                params.append(json.dumps(value, ensure_ascii=False))
            else:
                updates.append(f"{key} = ?")
                params.append(value)

        params.append(run_id)

        sql = f"""
        UPDATE acquisition_runs
        SET {', '.join(updates)}
        WHERE id = ?::uuid
        """

        self.db.run_raw_query(sql, params=params)

    def _build_criteria_payload(
        self, criteria: FilterCriteria, run_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "min_revenue": criteria.min_revenue,
            "min_ebitda_margin": criteria.min_ebitda_margin,
            "min_growth": criteria.min_growth,
            "industries": criteria.industries,
            "max_results": criteria.max_results,
            "custom_sql_conditions": criteria.custom_sql_conditions,
            "description": criteria.description,
            "suggestions": criteria.suggestions,
        }
        if run_context:
            payload["name"] = run_context.get("name")
            payload["list_id"] = run_context.get("list_id")
            payload["template_id"] = run_context.get("template_id")
            payload["template_name"] = run_context.get("template_name")
            payload["template_prompt"] = run_context.get("template_prompt")
            payload["config"] = run_context.get("config") or {}
        return payload

    def _skip_existing_analyses(self, run_context: Optional[Dict[str, Any]]) -> bool:
        if not run_context:
            return False
        cfg = run_context.get("config")
        if not isinstance(cfg, dict):
            return False
        if "overwrite_existing" not in cfg:
            return False
        return not bool(cfg.get("overwrite_existing"))

    def _normalize_orgnrs(self, orgnrs: List[str], max_results: int) -> List[str]:
        seen: set[str] = set()
        out: List[str] = []
        for orgnr in orgnrs:
            val = str(orgnr).strip()
            if not val or val in seen:
                continue
            seen.add(val)
            out.append(val)
            if max_results > 0 and len(out) >= max_results:
                break
        return out

    def _exclude_already_analyzed(self, orgnrs: List[str]) -> List[str]:
        if not orgnrs:
            return []
        if hasattr(self.db, "table_exists") and not self.db.table_exists("company_analysis"):
            return orgnrs
        placeholders = ",".join("?" * len(orgnrs))
        rows = self.db.run_raw_query(
            f"SELECT DISTINCT orgnr FROM company_analysis WHERE orgnr IN ({placeholders})",
            orgnrs,
        )
        existing = {str(r.get("orgnr")) for r in rows if r.get("orgnr")}
        return [orgnr for orgnr in orgnrs if orgnr not in existing]

    def _extract_segment_label(self, segment_names: Any) -> Optional[str]:
        if segment_names is None:
            return None
        if isinstance(segment_names, list):
            return str(segment_names[0]) if segment_names else None
        if isinstance(segment_names, str):
            text = segment_names.strip()
            if not text:
                return None
            if text.startswith("["):
                try:
                    parsed = json.loads(text)
                    if isinstance(parsed, list) and parsed:
                        return str(parsed[0])
                except Exception:
                    pass
            return text
        return None
