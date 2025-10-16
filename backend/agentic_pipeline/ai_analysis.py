"""LLM-powered commercial and financial analysis for shortlisted companies."""

from __future__ import annotations

import json
import logging
import os
import textwrap
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable, Optional, Sequence

import pandas as pd
from openai import OpenAI
from supabase import Client, create_client

from .screening_prompt import SCREENING_SYSTEM_PROMPT, get_screening_prompt, get_batch_screening_prompt
from .web_enrichment import enrich_companies_for_analysis, EnrichmentDataFormatter

logger = logging.getLogger(__name__)


def _default_context_fields() -> list[str]:
    return [
        "orgnr",
        "company_name",
        "segment_name",
        "industry",
        "subindustry",
        "revenue",
        "revenue_growth",
        "ebit",
        "ebit_margin",
        "net_income",
        "net_margin",
        "employees",
        "revenue_per_employee",
        "ebit_per_employee",
        "equity",
        "equity_ratio",
        "assets",
        "market_summary",
        "financial_summary",
        "risk_flags",
        "composite_score",
        "analysis_year",
    ]


def _default_system_prompt() -> str:
    return textwrap.dedent(
        """
        You are Nivo's lead corporate development strategist. Your task is to produce
        concise yet actionable analysis for potential SME acquisitions in Sweden.
        Assess each target's financial health, commercial opportunity, and post-acquisition
        value creation levers. Incorporate any engineered insights such as risk flags or
        segment information when relevant.

        Respond in professional English even if source data is Swedish. If information is
        missing, acknowledge the gap explicitly and infer carefully using comparable metrics.
        """
    ).strip()


def _default_analysis_schema() -> dict[str, Any]:
    return {
        "name": "CompanyAnalysisBundle",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "summary": {
                    "type": "string",
                    "description": "Executive summary highlighting attractiveness and strategic fit.",
                },
                "recommendation": {
                    "type": "string",
                    "description": "Headline recommendation (e.g. Pursue, Watchlist, Pass) with short qualifier.",
                },
                "confidence": {
                    "type": "number",
                    "description": "Overall confidence rating from 1 (low) to 5 (high).",
                    "minimum": 1,
                    "maximum": 5,
                },
                "risk_score": {
                    "type": "number",
                    "description": "Risk rating from 1 (low) to 5 (high).",
                    "minimum": 1,
                    "maximum": 5,
                },
                "financial_grade": {
                    "type": "string",
                    "description": "Letter grade representing financial resilience.",
                },
                "commercial_grade": {
                    "type": "string",
                    "description": "Letter grade representing market and commercial outlook.",
                },
                "operational_grade": {
                    "type": "string",
                    "description": "Letter grade representing operational maturity and integration fit.",
                },
                "next_steps": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Concrete follow-up actions or diligence questions.",
                },
                "sections": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "section_type": {
                                "type": "string",
                                "description": "Section identifier such as financial_outlook or swot_strengths.",
                            },
                            "title": {"type": "string"},
                            "content_md": {
                                "type": "string",
                                "description": "Markdown-formatted narrative with bullet lists or tables.",
                            },
                            "supporting_metrics": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "metric_name": {"type": "string"},
                                        "metric_value": {"type": "number"},
                                        "metric_unit": {"type": "string"},
                                        "year": {"type": "integer"},
                                        "source": {"type": "string"},
                                    },
                                    "required": ["metric_name", "metric_value"],
                                },
                            },
                            "confidence": {"type": "number"},
                            "tokens_used": {"type": "integer"},
                        },
                        "required": ["section_type", "content_md"],
                    },
                },
                "metrics": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "metric_name": {"type": "string"},
                            "metric_value": {"type": "number"},
                            "metric_unit": {"type": "string"},
                            "source": {"type": "string"},
                            "year": {"type": "integer"},
                            "confidence": {"type": "number"},
                        },
                        "required": ["metric_name", "metric_value"],
                    },
                },
            },
            "required": [
                "summary",
                "recommendation",
                "confidence",
                "risk_score",
                "financial_grade",
                "commercial_grade",
                "operational_grade",
                "sections",
                "metrics",
            ],
        },
    }


def _screening_analysis_schema() -> dict[str, Any]:
    """Simplified schema for rapid screening analysis."""
    return {
        "name": "ScreeningAnalysis",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "screening_score": {
                    "type": "number",
                    "description": "Overall screening score from 1-100 based on financial health, growth, and market position.",
                    "minimum": 1,
                    "maximum": 100,
                },
                "risk_flag": {
                    "type": "string",
                    "description": "Risk level: Low, Medium, or High",
                    "enum": ["Low", "Medium", "High"],
                },
                "brief_summary": {
                    "type": "string",
                    "description": "2-3 sentences highlighting key strengths and weaknesses.",
                },
            },
            "required": ["screening_score", "risk_flag", "brief_summary"],
        },
    }


def _iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if dt else None


@dataclass(slots=True)
class AIAnalysisRun:
    """Metadata for an AI analysis execution."""

    id: str
    model_version: str
    started_at: datetime
    analysis_mode: str = "deep"
    initiated_by: Optional[str] = None
    status: str = "running"
    filters: Optional[dict[str, Any]] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    def to_record(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "initiated_by": self.initiated_by,
            "status": self.status,
            "model_version": self.model_version,
            "analysis_mode": self.analysis_mode,
            "filters_json": self.filters or {},
            "started_at": _iso(self.started_at),
            "completed_at": _iso(self.completed_at),
            "error_message": self.error_message,
        }


@dataclass(slots=True)
class AnalysisSection:
    section_type: str
    content_md: str
    title: Optional[str] = None
    supporting_metrics: Sequence[dict[str, Any]] = field(default_factory=list)
    confidence: Optional[float] = None
    tokens_used: Optional[int] = None


@dataclass(slots=True)
class AnalysisMetric:
    metric_name: str
    metric_value: float
    metric_unit: Optional[str] = None
    source: Optional[str] = None
    year: Optional[int] = None
    confidence: Optional[float] = None


@dataclass(slots=True)
class AnalysisAuditRecord:
    module: str
    prompt: str
    response: str
    model: str
    latency_ms: int
    prompt_tokens: int
    completion_tokens: int
    cost_usd: Optional[float]


@dataclass(slots=True)
class CompanyAnalysisRecord:
    """Full analysis payload for a single company."""

    run_id: str
    orgnr: Optional[str]
    company_name: Optional[str]
    summary: Optional[str]
    recommendation: Optional[str]
    confidence: Optional[float]
    risk_score: Optional[float]
    financial_grade: Optional[str]
    commercial_grade: Optional[str]
    operational_grade: Optional[str]
    next_steps: Sequence[str]
    analysis_generated_at: datetime
    sections: list[AnalysisSection]
    metrics: list[AnalysisMetric]
    audit: AnalysisAuditRecord
    raw_json: dict[str, Any]


@dataclass(slots=True)
class ScreeningResult:
    """Screening analysis result for a single company."""

    run_id: str
    orgnr: Optional[str]
    company_name: Optional[str]
    screening_score: Optional[float]
    risk_flag: Optional[str]
    brief_summary: Optional[str]
    analysis_generated_at: datetime
    audit: AnalysisAuditRecord
    raw_json: dict[str, Any]


@dataclass(slots=True)
class AIAnalysisBatch:
    run: AIAnalysisRun
    companies: list[CompanyAnalysisRecord]
    errors: list[str] = field(default_factory=list)


@dataclass(slots=True)
class ScreeningBatch:
    run: AIAnalysisRun
    results: list[ScreeningResult]
    errors: list[str] = field(default_factory=list)

    def results_dataframe(self) -> pd.DataFrame:
        rows = [
            {
                "run_id": result.run_id,
                "orgnr": result.orgnr,
                "company_name": result.company_name,
                "screening_score": result.screening_score,
                "risk_flag": result.risk_flag,
                "brief_summary": result.brief_summary,
                "analysis_generated_at": _iso(result.analysis_generated_at),
            }
            for result in self.results
        ]
        return pd.DataFrame(rows)


@dataclass(slots=True)
class AIAnalysisBatch:
    run: AIAnalysisRun
    companies: list[CompanyAnalysisRecord]
    errors: list[str] = field(default_factory=list)

    def company_dataframe(self) -> pd.DataFrame:
        rows = [
            {
                "run_id": record.run_id,
                "orgnr": record.orgnr,
                "company_name": record.company_name,
                "summary": record.summary,
                "recommendation": record.recommendation,
                "confidence": record.confidence,
                "risk_score": record.risk_score,
                "financial_grade": record.financial_grade,
                "commercial_grade": record.commercial_grade,
                "operational_grade": record.operational_grade,
                "next_steps": json.dumps(list(record.next_steps), ensure_ascii=False),
                "analysis_generated_at": _iso(record.analysis_generated_at),
            }
            for record in self.companies
        ]
        return pd.DataFrame(rows)

    def sections_dataframe(self) -> pd.DataFrame:
        rows: list[dict[str, Any]] = []
        for record in self.companies:
            for section in record.sections:
                rows.append(
                    {
                        "run_id": record.run_id,
                        "orgnr": record.orgnr,
                        "section_type": section.section_type,
                        "title": section.title,
                        "content_md": section.content_md,
                        "supporting_metrics": json.dumps(section.supporting_metrics, ensure_ascii=False),
                        "confidence": section.confidence,
                        "tokens_used": section.tokens_used,
                    }
                )
        return pd.DataFrame(rows)

    def metrics_dataframe(self) -> pd.DataFrame:
        rows: list[dict[str, Any]] = []
        for record in self.companies:
            for metric in record.metrics:
                rows.append(
                    {
                        "run_id": record.run_id,
                        "orgnr": record.orgnr,
                        "metric_name": metric.metric_name,
                        "metric_value": metric.metric_value,
                        "metric_unit": metric.metric_unit,
                        "source": metric.source,
                        "year": metric.year,
                        "confidence": metric.confidence,
                    }
                )
        return pd.DataFrame(rows)

    def audit_dataframe(self) -> pd.DataFrame:
        rows = [
            {
                "run_id": record.run_id,
                "orgnr": record.orgnr,
                "module": record.audit.module,
                "prompt": record.audit.prompt,
                "response": record.audit.response,
                "model": record.audit.model,
                "latency_ms": record.audit.latency_ms,
                "prompt_tokens": record.audit.prompt_tokens,
                "completion_tokens": record.audit.completion_tokens,
                "cost_usd": record.audit.cost_usd,
            }
            for record in self.companies
        ]
        return pd.DataFrame(rows)


@dataclass(slots=True)
class AIAnalysisConfig:
    """Configuration for LLM-powered analysis."""

    model: str = "gpt-4o-mini"
    temperature: float = 0.15
    max_output_tokens: int = 1200
    system_prompt: str = field(default_factory=_default_system_prompt)
    context_fields: list[str] = field(default_factory=_default_context_fields)
    response_schema: dict[str, Any] = field(default_factory=_default_analysis_schema)
    supabase_schema: str = "ai_ops"
    runs_table: str = "ai_analysis_runs"
    company_table: str = "ai_company_analysis"
    sections_table: str = "ai_analysis_sections"
    metrics_table: str = "ai_analysis_metrics"
    audit_table: str = "ai_analysis_audit"
    screening_table: str = "ai_screening_results"
    output_dir: Path = Path("outputs/agentic_ai")
    output_prefix: str = "ai_analysis"
    write_to_disk: bool = True
    sleep_between_requests: float = 0.5
    prompt_cost_per_1k: float = 0.15
    completion_cost_per_1k: float = 0.6
    batch_size: int = 5  # For screening batch processing

    def ensure_output_dir(self) -> None:
        if self.write_to_disk:
            self.output_dir.mkdir(parents=True, exist_ok=True)


class SupabaseAnalysisWriter:
    """Utility for persisting AI analysis rows into Supabase."""

    def __init__(
        self,
        *,
        config: AIAnalysisConfig,
        chunk_size: int = 50,
        url_env: str = "SUPABASE_URL",
        key_env_options: Iterable[str] = ("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY"),
    ) -> None:
        url = os.getenv(url_env)
        key = next((os.getenv(env) for env in key_env_options if os.getenv(env)), None)
        if not url or not key:
            raise ValueError(
                "Supabase credentials missing. Set SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY."
            )
        self.config = config
        self.chunk_size = chunk_size
        self.client: Client = create_client(url, key)

    def _table(self, table_name: str):
        builder = self.client.table(table_name)
        if self.config.supabase_schema:
            builder = builder.schema(self.config.supabase_schema)
        return builder

    def record_run_start(self, run: AIAnalysisRun) -> None:
        self._table(self.config.runs_table).insert(run.to_record()).execute()

    def record_run_completion(self, run: AIAnalysisRun) -> None:
        payload = {
            "status": run.status,
            "completed_at": _iso(run.completed_at),
            "error_message": run.error_message,
        }
        self._table(self.config.runs_table).update(payload).eq("id", run.id).execute()

    def upsert_company_results(self, results: Sequence[CompanyAnalysisRecord]) -> None:
        if not results:
            return
        company_rows = [
            {
                "run_id": record.run_id,
                "orgnr": record.orgnr,
                "company_name": record.company_name,
                "summary": record.summary,
                "recommendation": record.recommendation,
                "confidence": record.confidence,
                "risk_score": record.risk_score,
                "financial_grade": record.financial_grade,
                "commercial_grade": record.commercial_grade,
                "operational_grade": record.operational_grade,
                "next_steps": list(record.next_steps),
                "created_at": _iso(record.analysis_generated_at),
            }
            for record in results
        ]
        self._table(self.config.company_table).upsert(company_rows, on_conflict="run_id,orgnr").execute()

        sections_rows: list[dict[str, Any]] = []
        metrics_rows: list[dict[str, Any]] = []
        audit_rows: list[dict[str, Any]] = []

        for record in results:
            for section in record.sections:
                sections_rows.append(
                    {
                        "run_id": record.run_id,
                        "orgnr": record.orgnr,
                        "section_type": section.section_type,
                        "title": section.title,
                        "content_md": section.content_md,
                        "supporting_metrics": section.supporting_metrics,
                        "confidence": section.confidence,
                        "tokens_used": section.tokens_used,
                    }
                )
            for metric in record.metrics:
                metrics_rows.append(
                    {
                        "run_id": record.run_id,
                        "orgnr": record.orgnr,
                        "metric_name": metric.metric_name,
                        "metric_value": metric.metric_value,
                        "metric_unit": metric.metric_unit,
                        "source": metric.source,
                        "year": metric.year,
                        "confidence": metric.confidence,
                    }
                )
            audit_rows.append(
                {
                    "run_id": record.run_id,
                    "orgnr": record.orgnr,
                    "module": record.audit.module,
                    "prompt": record.audit.prompt,
                    "response": record.audit.response,
                    "model": record.audit.model,
                    "latency_ms": record.audit.latency_ms,
                    "prompt_tokens": record.audit.prompt_tokens,
                    "completion_tokens": record.audit.completion_tokens,
                    "cost_usd": record.audit.cost_usd,
                }
            )

        if sections_rows:
            self._table(self.config.sections_table).upsert(sections_rows).execute()
        if metrics_rows:
            self._table(self.config.metrics_table).upsert(metrics_rows).execute()
        if audit_rows:
            self._table(self.config.audit_table).upsert(audit_rows).execute()

    def upsert_screening_results(self, results: Sequence[ScreeningResult]) -> None:
        """Persist screening results to Supabase."""
        if not results:
            return
        screening_rows = [
            {
                "run_id": result.run_id,
                "orgnr": result.orgnr,
                "company_name": result.company_name,
                "screening_score": result.screening_score,
                "risk_flag": result.risk_flag,
                "brief_summary": result.brief_summary,
                "created_at": _iso(result.analysis_generated_at),
            }
            for result in results
        ]
        self._table(self.config.screening_table).upsert(screening_rows, on_conflict="run_id,orgnr").execute()

        # Also store audit records for screening
        audit_rows = [
            {
                "run_id": result.run_id,
                "orgnr": result.orgnr,
                "module": result.audit.module,
                "prompt": result.audit.prompt,
                "response": result.audit.response,
                "model": result.audit.model,
                "latency_ms": result.audit.latency_ms,
                "prompt_tokens": result.audit.prompt_tokens,
                "completion_tokens": result.audit.completion_tokens,
                "cost_usd": result.audit.cost_usd,
            }
            for result in results
        ]
        if audit_rows:
            self._table(self.config.audit_table).upsert(audit_rows).execute()


class AgenticLLMAnalyzer:
    """Runs LLM analysis for a shortlist of target companies."""

    def __init__(
        self,
        config: AIAnalysisConfig,
        *,
        openai_client: Optional[OpenAI] = None,
        supabase_writer: Optional[SupabaseAnalysisWriter] = None,
    ) -> None:
        config.ensure_output_dir()
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key and openai_client is None:
            raise ValueError("OPENAI_API_KEY environment variable is required to run AI analysis.")
        self.config = config
        self.client = openai_client or OpenAI(api_key=api_key)
        self.supabase_writer = supabase_writer

    def run(
        self,
        shortlist: pd.DataFrame,
        *,
        limit: Optional[int] = None,
        run_id: Optional[str] = None,
        initiated_by: Optional[str] = None,
        filters: Optional[dict[str, Any]] = None,
    ) -> AIAnalysisBatch:
        if shortlist.empty:
            raise ValueError("Shortlist is empty; cannot run AI analysis.")

        df = shortlist.copy()
        if limit is not None:
            df = df.head(limit)

        run = AIAnalysisRun(
            id=run_id or str(uuid.uuid4()),
            initiated_by=initiated_by,
            model_version=self.config.model,
            started_at=datetime.utcnow(),
            filters=filters,
        )

        if self.supabase_writer is not None:
            self.supabase_writer.record_run_start(run)

        analyses: list[CompanyAnalysisRecord] = []
        errors: list[str] = []

        # For deep analysis, enrich companies with external data
        enrichment_data_map = {}
        if run.analysis_mode == 'deep':
            try:
                companies_for_enrichment = []
                for _, row in df.iterrows():
                    orgnr = self._coalesce(row, ["orgnr", "OrgNr", "organization_number"])
                    company_name = self._coalesce(row, ["company_name", "CompanyName", "legal_name", "name"])
                    homepage = row.get('homepage') or row.get('website')
                    
                    companies_for_enrichment.append({
                        'orgnr': orgnr,
                        'name': company_name,
                        'homepage': homepage
                    })
                
                # Enrich companies (this is async, so we need to handle it properly)
                import asyncio
                enrichment_results = asyncio.run(enrich_companies_for_analysis(companies_for_enrichment))
                
                # Format enrichment data for each company
                for orgnr, enrichment_data in enrichment_results.items():
                    formatted_enrichment = EnrichmentDataFormatter.format_for_ai_analysis(enrichment_data)
                    enrichment_data_map[orgnr] = formatted_enrichment
                    
            except Exception as e:
                logger.warning(f"Failed to enrich companies for deep analysis: {e}")

        for _, row in df.iterrows():
            try:
                orgnr = self._coalesce(row, ["orgnr", "OrgNr", "organization_number"])
                enrichment_data = enrichment_data_map.get(orgnr)
                record = self._analyze_row(row, run, enrichment_data)
                analyses.append(record)
                if self.supabase_writer is not None:
                    self.supabase_writer.upsert_company_results([record])
            except Exception as exc:  # pragma: no cover - defensive fallback
                errors.append(f"{row.get('orgnr', 'unknown')}: {exc}")
            if self.config.sleep_between_requests:
                time.sleep(self.config.sleep_between_requests)

        run.completed_at = datetime.utcnow()
        if errors:
            run.status = "completed_with_errors"
            run.error_message = "; ".join(errors)
        else:
            run.status = "completed"

        if self.supabase_writer is not None:
            self.supabase_writer.record_run_completion(run)

        batch = AIAnalysisBatch(run=run, companies=analyses, errors=errors)
        if self.config.write_to_disk and analyses:
            self._persist_to_disk(batch)
        return batch

    def run_screening(
        self,
        shortlist: pd.DataFrame,
        *,
        limit: Optional[int] = None,
        run_id: Optional[str] = None,
        initiated_by: Optional[str] = None,
        filters: Optional[dict[str, Any]] = None,
    ) -> ScreeningBatch:
        """Run rapid screening analysis on a list of companies."""
        if shortlist.empty:
            raise ValueError("Shortlist is empty; cannot run screening analysis.")

        df = shortlist.copy()
        if limit is not None:
            df = df.head(limit)

        run = AIAnalysisRun(
            id=run_id or str(uuid.uuid4()),
            initiated_by=initiated_by,
            model_version="gpt-4o-mini",  # Use mini model for cost efficiency
            analysis_mode="screening",
            started_at=datetime.utcnow(),
            filters=filters,
        )

        if self.supabase_writer is not None:
            self.supabase_writer.record_run_start(run)

        results: list[ScreeningResult] = []
        errors: list[str] = []

        # Process in batches for efficiency
        for i in range(0, len(df), self.config.batch_size):
            batch_df = df.iloc[i:i + self.config.batch_size]
            try:
                batch_results = self._analyze_screening_batch(batch_df, run)
                results.extend(batch_results)
                if self.supabase_writer is not None:
                    self.supabase_writer.upsert_screening_results(batch_results)
            except Exception as exc:
                errors.append(f"Batch {i//self.config.batch_size + 1}: {exc}")
            
            if self.config.sleep_between_requests:
                time.sleep(self.config.sleep_between_requests)

        run.completed_at = datetime.utcnow()
        if errors:
            run.status = "completed_with_errors"
            run.error_message = "; ".join(errors)
        else:
            run.status = "completed"

        if self.supabase_writer is not None:
            self.supabase_writer.record_run_completion(run)

        batch = ScreeningBatch(run=run, results=results, errors=errors)
        if self.config.write_to_disk and results:
            self._persist_screening_to_disk(batch)
        return batch

    def _persist_to_disk(self, batch: AIAnalysisBatch) -> None:
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        base_path = self.config.output_dir / f"{timestamp}_{self.config.output_prefix}_{batch.run.id}"
        batch.company_dataframe().to_csv(base_path.with_suffix("_companies.csv"), index=False)
        batch.sections_dataframe().to_csv(base_path.with_suffix("_sections.csv"), index=False)
        batch.metrics_dataframe().to_csv(base_path.with_suffix("_metrics.csv"), index=False)
        batch.audit_dataframe().to_csv(base_path.with_suffix("_audit.csv"), index=False)

    def _persist_screening_to_disk(self, batch: ScreeningBatch) -> None:
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        base_path = self.config.output_dir / f"{timestamp}_screening_{batch.run.id}"
        batch.results_dataframe().to_csv(base_path.with_suffix("_results.csv"), index=False)

    def _analyze_screening_batch(self, batch_df: pd.DataFrame, run: AIAnalysisRun) -> list[ScreeningResult]:
        """Analyze a batch of companies for screening."""
        # Convert batch to list of company data
        companies_data = []
        for _, row in batch_df.iterrows():
            company_data = {
                'orgnr': self._coalesce(row, ["orgnr", "OrgNr", "organization_number"]),
                'name': self._coalesce(row, ["company_name", "CompanyName", "legal_name", "name"]),
                'industry': row.get('segment_name') or row.get('industry_name', 'Unknown'),
                'financials': self._extract_financials(row)
            }
            companies_data.append(company_data)

        # Use batch screening prompt
        prompt = get_batch_screening_prompt(companies_data)
        response_json, raw_text, usage, latency_ms = self._invoke_screening_model(prompt)

        # Parse results
        results = []
        for i, result_data in enumerate(response_json):
            if i < len(companies_data):
                company_data = companies_data[i]
                audit = AnalysisAuditRecord(
                    module="screening_analysis",
                    prompt=prompt,
                    response=raw_text,
                    model="gpt-4o-mini",
                    latency_ms=latency_ms,
                    prompt_tokens=usage.get("input_tokens", 0) if usage else 0,
                    completion_tokens=usage.get("output_tokens", 0) if usage else 0,
                    cost_usd=self._estimate_screening_cost(usage),
                )

                result = ScreeningResult(
                    run_id=run.id,
                    orgnr=company_data['orgnr'],
                    company_name=company_data['name'],
                    screening_score=result_data.get("screening_score"),
                    risk_flag=result_data.get("risk_flag"),
                    brief_summary=result_data.get("brief_summary"),
                    analysis_generated_at=datetime.utcnow(),
                    audit=audit,
                    raw_json=result_data,
                )
                results.append(result)

        return results

    def _extract_financials(self, row: pd.Series) -> dict:
        """Extract financial data from a row for screening."""
        financials = {}
        # Look for revenue, profit, employees data
        if pd.notna(row.get('revenue')):
            financials['revenue'] = row.get('revenue')
        if pd.notna(row.get('profit')):
            financials['profit'] = row.get('profit')
        if pd.notna(row.get('employees')):
            financials['employees'] = row.get('employees')
        return financials

    def _invoke_screening_model(self, prompt: str) -> tuple[dict[str, Any], str, dict[str, Any], int]:
        """Invoke the screening model with optimized settings."""
        start_time = time.perf_counter()
        response = self.client.responses.create(
            model="gpt-4o-mini",
            temperature=0.1,  # Lower temperature for more consistent screening
            max_output_tokens=500,  # Smaller output for screening
            input=[
                {
                    "role": "system",
                    "content": [{"type": "text", "text": SCREENING_SYSTEM_PROMPT}],
                },
                {
                    "role": "user",
                    "content": [{"type": "text", "text": prompt}],
                },
            ],
            response_format={"type": "json_schema", "json_schema": _screening_analysis_schema()},
        )
        latency_ms = int((time.perf_counter() - start_time) * 1000)

        raw_text = getattr(response, "output_text", None)
        if not raw_text:
            try:
                raw_text = response.output[0].content[0].text  # type: ignore[index]
            except (AttributeError, IndexError):  # pragma: no cover - defensive fallback
                raw_text = "[]"

        try:
            parsed = json.loads(raw_text)
        except json.JSONDecodeError:
            parsed = []

        usage_dict: dict[str, Any] = {}
        usage = getattr(response, "usage", None)
        if usage:
            for key in ("input_tokens", "output_tokens", "total_tokens"):
                value = getattr(usage, key, None)
                if value is None and isinstance(usage, dict):
                    value = usage.get(key)
                if value is not None:
                    usage_dict[key] = value

        return parsed, raw_text, usage_dict, latency_ms

    def _estimate_screening_cost(self, usage: Optional[dict[str, Any]]) -> Optional[float]:
        """Estimate cost for screening analysis (using gpt-4o-mini rates)."""
        if not usage:
            return None
        prompt_tokens = usage.get("input_tokens") or 0
        completion_tokens = usage.get("output_tokens") or 0
        # GPT-4o-mini rates: $0.00015/1K input, $0.0006/1K output
        cost = (prompt_tokens / 1000) * 0.00015 + (completion_tokens / 1000) * 0.0006
        return round(cost, 4)

    def _analyze_row(self, row: pd.Series, run: AIAnalysisRun, enrichment_data: Optional[str] = None) -> CompanyAnalysisRecord:
        orgnr = self._coalesce(row, ["orgnr", "OrgNr", "organization_number"])
        company_name = self._coalesce(row, ["company_name", "CompanyName", "legal_name", "name"])
        payload = self._render_context(row, enrichment_data)
        response_json, raw_text, usage, latency_ms = self._invoke_model(payload)

        sections = [
            AnalysisSection(
                section_type=section.get("section_type") or section.get("type", "unspecified"),
                title=section.get("title"),
                content_md=section.get("content_md") or section.get("content", ""),
                supporting_metrics=section.get("supporting_metrics") or [],
                confidence=section.get("confidence"),
                tokens_used=section.get("tokens_used"),
            )
            for section in response_json.get("sections", [])
        ]

        metrics = [
            AnalysisMetric(
                metric_name=item.get("metric_name") or item.get("name", "metric"),
                metric_value=float(item.get("metric_value")),
                metric_unit=item.get("metric_unit"),
                source=item.get("source"),
                year=item.get("year"),
                confidence=item.get("confidence"),
            )
            for item in response_json.get("metrics", [])
            if item.get("metric_value") is not None
        ]

        audit = AnalysisAuditRecord(
            module="comprehensive_analysis",
            prompt=payload,
            response=raw_text,
            model=self.config.model,
            latency_ms=latency_ms,
            prompt_tokens=usage.get("input_tokens", 0) if usage else 0,
            completion_tokens=usage.get("output_tokens", 0) if usage else 0,
            cost_usd=self._estimate_cost(usage),
        )

        record = CompanyAnalysisRecord(
            run_id=run.id,
            orgnr=orgnr,
            company_name=company_name,
            summary=response_json.get("summary"),
            recommendation=response_json.get("recommendation"),
            confidence=response_json.get("confidence"),
            risk_score=response_json.get("risk_score"),
            financial_grade=response_json.get("financial_grade"),
            commercial_grade=response_json.get("commercial_grade"),
            operational_grade=response_json.get("operational_grade"),
            next_steps=response_json.get("next_steps") or [],
            analysis_generated_at=datetime.utcnow(),
            sections=sections,
            metrics=metrics,
            audit=audit,
            raw_json=response_json,
        )

        return record

    def _render_context(self, row: pd.Series, enrichment_data: Optional[str] = None) -> str:
        context_data: dict[str, Any] = {}
        for field in self.config.context_fields:
            value = row.get(field)
            if pd.isna(value):
                continue
            if isinstance(value, (datetime, pd.Timestamp)):
                context_data[field] = value.isoformat()
            else:
                context_data[field] = value

        structured_json = json.dumps(context_data, ensure_ascii=False, indent=2)
        
        base_prompt = textwrap.dedent(
            f"""
            Company profile and engineered metrics (JSON):
            {structured_json}
            """
        ).strip()
        
        if enrichment_data:
            base_prompt += f"\n\nExternal enrichment data:\n{enrichment_data}"
        
        base_prompt += "\n\nProduce a comprehensive acquisition due diligence brief. Include quantitative references where possible."
        
        return base_prompt

    def _invoke_model(self, prompt: str) -> tuple[dict[str, Any], str, dict[str, Any], int]:
        start_time = time.perf_counter()
        response = self.client.responses.create(
            model=self.config.model,
            temperature=self.config.temperature,
            max_output_tokens=self.config.max_output_tokens,
            input=[
                {
                    "role": "system",
                    "content": [{"type": "text", "text": self.config.system_prompt}],
                },
                {
                    "role": "user",
                    "content": [{"type": "text", "text": prompt}],
                },
            ],
            response_format={"type": "json_schema", "json_schema": self.config.response_schema},
        )
        latency_ms = int((time.perf_counter() - start_time) * 1000)

        raw_text = getattr(response, "output_text", None)
        if not raw_text:
            try:
                raw_text = response.output[0].content[0].text  # type: ignore[index]
            except (AttributeError, IndexError):  # pragma: no cover - defensive fallback
                raw_text = "{}"

        try:
            parsed = json.loads(raw_text)
        except json.JSONDecodeError:
            parsed = {}

        usage_dict: dict[str, Any] = {}
        usage = getattr(response, "usage", None)
        if usage:
            for key in ("input_tokens", "output_tokens", "total_tokens"):
                value = getattr(usage, key, None)
                if value is None and isinstance(usage, dict):
                    value = usage.get(key)
                if value is not None:
                    usage_dict[key] = value

        return parsed, raw_text, usage_dict, latency_ms

    def _estimate_cost(self, usage: Optional[dict[str, Any]]) -> Optional[float]:
        if not usage:
            return None
        prompt_tokens = usage.get("input_tokens") or 0
        completion_tokens = usage.get("output_tokens") or 0
        cost = 0.0
        if prompt_tokens:
            cost += (prompt_tokens / 1000) * self.config.prompt_cost_per_1k
        if completion_tokens:
            cost += (completion_tokens / 1000) * self.config.completion_cost_per_1k
        return round(cost, 4)

    @staticmethod
    def _coalesce(row: pd.Series, keys: Iterable[str]) -> Optional[str]:
        for key in keys:
            value = row.get(key)
            if pd.notna(value) and value != "":
                return str(value)
        return None


__all__ = [
    "AIAnalysisBatch",
    "AIAnalysisConfig",
    "AgenticLLMAnalyzer",
    "AnalysisMetric",
    "AnalysisSection",
    "ScreeningBatch",
    "ScreeningResult",
    "SupabaseAnalysisWriter",
]

