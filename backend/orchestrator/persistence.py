"""Persistence helpers for orchestrator run and node states."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.db.models.deep_research import (
    AnalysisRun,
    Company,
    CompanyProfile,
    Competitor,
    CompetitorProfile,
    FinancialModel,
    MarketAnalysis,
    ReportSection,
    ReportVersion,
    RunNodeState,
    Strategy,
    Valuation,
    ValueCreation,
)


def _safe_dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def _safe_list(value: Any) -> list:
    return value if isinstance(value, list) else []


@dataclass(slots=True)
class RunStateRepository:
    """Repository for orchestrator-related persistence operations."""

    session: Session

    def resolve_company(
        self,
        *,
        company_id: uuid.UUID | None,
        orgnr: str | None,
        company_name: str | None,
        website: str | None,
    ) -> Company:
        company: Company | None = None
        if company_id:
            company = self.session.get(Company, company_id)
        if not company and orgnr:
            company = self.session.execute(
                select(Company).where(Company.orgnr == orgnr)
            ).scalar_one_or_none()
        if company:
            if company_name:
                company.name = company_name
            if website and not company.website:
                company.website = website
            self.session.flush()
            return company

        company = Company(
            orgnr=orgnr or f"tmp-{uuid.uuid4().hex[:20]}",
            name=company_name or f"Company {orgnr or 'Unknown'}",
            website=website,
        )
        self.session.add(company)
        self.session.flush()
        return company

    def create_or_resume_run(
        self,
        *,
        run_id: uuid.UUID | None,
        company_id: uuid.UUID,
        query: str,
    ) -> AnalysisRun:
        run = self.session.get(AnalysisRun, run_id) if run_id else None
        if run:
            run.status = "running"
            run.started_at = run.started_at or datetime.utcnow()
            run.completed_at = None
            run.error_message = None
            self.session.flush()
            return run
        run = AnalysisRun(
            id=run_id or uuid.uuid4(),
            company_id=company_id,
            status="running",
            query=query,
            started_at=datetime.utcnow(),
            extra={"orchestrator": "langgraph"},
        )
        self.session.add(run)
        self.session.flush()
        return run

    def upsert_node_state(
        self,
        *,
        run_id: uuid.UUID,
        node_name: str,
        status: str,
        input_json: dict | None = None,
        output_json: dict | None = None,
        error_message: str | None = None,
    ) -> None:
        row = self.session.execute(
            select(RunNodeState).where(
                RunNodeState.run_id == run_id, RunNodeState.node_name == node_name
            )
        ).scalar_one_or_none()
        if row is None:
            row = RunNodeState(
                run_id=run_id,
                node_name=node_name,
                status=status,
                started_at=datetime.utcnow(),
                input_json=_safe_dict(input_json),
                output_json=_safe_dict(output_json),
                error_message=error_message,
            )
            self.session.add(row)
        else:
            row.status = status
            row.input_json = _safe_dict(input_json) or row.input_json
            row.output_json = _safe_dict(output_json)
            row.error_message = error_message
            if row.started_at is None:
                row.started_at = datetime.utcnow()
        if status in {"completed", "failed", "skipped"}:
            row.completed_at = datetime.utcnow()
        row.updated_at = datetime.utcnow()
        self.session.flush()

    def finalize_run(self, run_id: uuid.UUID, *, status: str, error: str | None = None) -> None:
        run = self.session.get(AnalysisRun, run_id)
        if not run:
            return
        run.status = status
        run.completed_at = datetime.utcnow()
        run.error_message = error
        self.session.flush()

    def list_node_states(self, run_id: uuid.UUID) -> list[RunNodeState]:
        rows = self.session.execute(
            select(RunNodeState)
            .where(RunNodeState.run_id == run_id)
            .order_by(RunNodeState.created_at.asc())
        ).scalars()
        return list(rows)

    def persist_company_profile(self, run_id: uuid.UUID, company_id: uuid.UUID, payload: dict) -> None:
        row = self.session.execute(
            select(CompanyProfile).where(
                CompanyProfile.run_id == run_id, CompanyProfile.company_id == company_id
            )
        ).scalar_one_or_none()
        data = _safe_dict(payload)
        if row is None:
            row = CompanyProfile(run_id=run_id, company_id=company_id)
            self.session.add(row)
        row.summary = data.get("summary")
        row.business_model = data.get("business_model")
        row.products_services = _safe_dict(data.get("products_services"))
        row.customer_segments = _safe_dict(data.get("customer_segments"))
        row.geographies = _safe_dict(data.get("geographies"))
        row.extra = _safe_dict(data.get("metadata"))
        self.session.flush()

    def persist_market_analysis(self, run_id: uuid.UUID, company_id: uuid.UUID, payload: dict) -> None:
        row = self.session.execute(
            select(MarketAnalysis).where(
                MarketAnalysis.run_id == run_id, MarketAnalysis.company_id == company_id
            )
        ).scalar_one_or_none()
        data = _safe_dict(payload)
        if row is None:
            row = MarketAnalysis(run_id=run_id, company_id=company_id)
            self.session.add(row)
        row.market_size = data.get("market_size")
        row.growth_rate = data.get("growth_rate")
        row.trends = _safe_dict(data.get("trends"))
        row.risks = _safe_dict(data.get("risks"))
        row.opportunities = _safe_dict(data.get("opportunities"))
        row.extra = _safe_dict(data.get("metadata"))
        self.session.flush()

    def persist_competitors(self, run_id: uuid.UUID, company_id: uuid.UUID, payload: dict) -> None:
        data = _safe_dict(payload)
        items = _safe_list(data.get("competitors"))
        for item in items:
            info = _safe_dict(item)
            competitor = Competitor(
                run_id=run_id,
                company_id=company_id,
                competitor_name=info.get("name") or "Unknown competitor",
                website=info.get("website"),
                relation_score=info.get("relation_score"),
                extra=_safe_dict(info.get("metadata")),
            )
            self.session.add(competitor)
            self.session.flush()
            profile = CompetitorProfile(
                competitor_id=competitor.id,
                profile_text=info.get("profile_text"),
                strengths=_safe_dict(info.get("strengths")),
                weaknesses=_safe_dict(info.get("weaknesses")),
                differentiation=_safe_dict(info.get("differentiation")),
                extra=_safe_dict(info.get("profile_metadata")),
            )
            self.session.add(profile)
        self.session.flush()

    def persist_strategy(self, run_id: uuid.UUID, company_id: uuid.UUID, payload: dict) -> Strategy:
        row = self.session.execute(
            select(Strategy).where(Strategy.run_id == run_id, Strategy.company_id == company_id)
        ).scalar_one_or_none()
        data = _safe_dict(payload)
        if row is None:
            row = Strategy(run_id=run_id, company_id=company_id)
            self.session.add(row)
        row.investment_thesis = data.get("investment_thesis")
        row.acquisition_rationale = data.get("acquisition_rationale")
        row.key_risks = _safe_dict(data.get("key_risks"))
        row.diligence_focus = _safe_dict(data.get("diligence_focus"))
        row.integration_themes = _safe_dict(data.get("integration_themes"))
        row.extra = _safe_dict(data.get("metadata"))
        self.session.flush()
        return row

    def persist_value_creation(
        self, run_id: uuid.UUID, company_id: uuid.UUID, strategy_id: uuid.UUID | None, payload: dict
    ) -> None:
        row = self.session.execute(
            select(ValueCreation).where(
                ValueCreation.run_id == run_id, ValueCreation.company_id == company_id
            )
        ).scalar_one_or_none()
        data = _safe_dict(payload)
        if row is None:
            row = ValueCreation(run_id=run_id, company_id=company_id, strategy_id=strategy_id)
            self.session.add(row)
        row.strategy_id = strategy_id
        row.initiatives = _safe_dict(data.get("initiatives"))
        row.timeline = _safe_dict(data.get("timeline"))
        row.kpis = _safe_dict(data.get("kpis"))
        row.extra = _safe_dict(data.get("metadata"))
        self.session.flush()

    def persist_financial_model(self, run_id: uuid.UUID, company_id: uuid.UUID, payload: dict) -> FinancialModel:
        data = _safe_dict(payload)
        model_version = data.get("model_version") or "v1"
        row = self.session.execute(
            select(FinancialModel).where(
                FinancialModel.run_id == run_id,
                FinancialModel.company_id == company_id,
                FinancialModel.model_version == model_version,
            )
        ).scalar_one_or_none()
        if row is None:
            row = FinancialModel(
                run_id=run_id,
                company_id=company_id,
                model_version=model_version,
            )
            self.session.add(row)
        row.assumption_set = _safe_dict(data.get("assumption_set"))
        row.forecast = _safe_dict(data.get("forecast"))
        row.sensitivity = _safe_dict(data.get("sensitivity"))
        row.extra = _safe_dict(data.get("metadata"))
        self.session.flush()
        return row

    def persist_valuation(
        self,
        run_id: uuid.UUID,
        company_id: uuid.UUID,
        financial_model_id: uuid.UUID | None,
        payload: dict,
    ) -> None:
        data = _safe_dict(payload)
        row = Valuation(
            run_id=run_id,
            company_id=company_id,
            financial_model_id=financial_model_id,
            method=data.get("method") or "comps",
            enterprise_value=data.get("enterprise_value"),
            equity_value=data.get("equity_value"),
            valuation_range_low=data.get("valuation_range_low"),
            valuation_range_high=data.get("valuation_range_high"),
            currency=data.get("currency") or "SEK",
            extra=_safe_dict(data.get("metadata")),
        )
        self.session.add(row)
        self.session.flush()

    def persist_report(self, run_id: uuid.UUID, company_id: uuid.UUID, payload: dict) -> ReportVersion:
        data = _safe_dict(payload)
        row = ReportVersion(
            run_id=run_id,
            company_id=company_id,
            version_number=1,
            status=data.get("status") or "draft",
            title=data.get("title"),
            generated_by="langgraph-orchestrator",
            extra=_safe_dict(data.get("metadata")),
        )
        self.session.add(row)
        self.session.flush()

        sections = _safe_list(data.get("sections"))
        for idx, section in enumerate(sections):
            sec = _safe_dict(section)
            row_section = ReportSection(
                report_version_id=row.id,
                section_key=sec.get("section_key") or f"section_{idx}",
                heading=sec.get("heading"),
                content_md=sec.get("content_md") or "",
                sort_order=sec.get("sort_order", idx),
                extra=_safe_dict(sec.get("metadata")),
            )
            self.session.add(row_section)
        self.session.flush()
        return row

