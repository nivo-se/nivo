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
    Claim,
    Company,
    CompanyProfile,
    Competitor,
    CompetitorProfile,
    FinancialModel,
    MarketAnalysis,
    ReportSection,
    ReportVersion,
    RunNodeState,
    Source,
    SourceChunk,
    Strategy,
    Valuation,
    ValueCreation,
)
from backend.agents.context import AgentContext, SourceChunkRecord, SourceRecord
from backend.agents.schemas import AgentClaim, IdentityAgentOutput


def _safe_dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def _safe_list(value: Any) -> list:
    return value if isinstance(value, list) else []


def _json_field(value: Any) -> dict:
    if isinstance(value, dict):
        return value
    if isinstance(value, list):
        return {"items": value}
    return {}


def _json_safe(value: Any) -> Any:
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    return value


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

    def build_agent_context(self, run_id: uuid.UUID, company_id: uuid.UUID) -> AgentContext:
        company = self.session.get(Company, company_id)
        if company is None:
            raise ValueError(f"Company not found: {company_id}")

        source_rows = self.session.execute(
            select(Source)
            .where(Source.run_id == run_id, Source.company_id == company_id)
            .order_by(Source.created_at.desc())
        ).scalars()
        sources = list(source_rows)
        source_ids = [s.id for s in sources]
        chunks: list[SourceChunk] = []
        if source_ids:
            chunk_rows = self.session.execute(
                select(SourceChunk)
                .where(SourceChunk.source_id.in_(source_ids))
                .order_by(SourceChunk.source_id.asc(), SourceChunk.chunk_index.asc())
            ).scalars()
            chunks = list(chunk_rows)

        return AgentContext(
            company_id=company.id,
            company_name=company.name,
            orgnr=company.orgnr,
            website=company.website,
            sources=[
                SourceRecord(
                    source_id=s.id,
                    source_type=s.source_type,
                    title=s.title,
                    url=s.url,
                    content_text=s.content_text,
                    metadata=_safe_dict(s.extra),
                )
                for s in sources
            ],
            chunks=[
                SourceChunkRecord(
                    chunk_id=c.id,
                    source_id=c.source_id,
                    text=c.content_text,
                    token_count=c.token_count,
                )
                for c in chunks
            ],
        )

    def persist_identity(self, company_id: uuid.UUID, payload: IdentityAgentOutput | dict) -> None:
        data = payload.model_dump() if hasattr(payload, "model_dump") else _safe_dict(payload)
        company = self.session.get(Company, company_id)
        if company is None:
            return
        if data.get("canonical_name"):
            company.name = data["canonical_name"]
        if data.get("website"):
            company.website = data["website"]
        if data.get("orgnr"):
            company.orgnr = data["orgnr"]
        if data.get("headquarters"):
            company.headquarters = data["headquarters"]
        if data.get("industry"):
            company.industry = data["industry"]
        self.session.flush()

    def persist_claims(
        self,
        *,
        run_id: uuid.UUID,
        company_id: uuid.UUID,
        claims: list[AgentClaim] | list[dict],
        default_claim_type: str,
    ) -> list[uuid.UUID]:
        claim_ids: list[uuid.UUID] = []
        for item in claims:
            c = item.model_dump() if hasattr(item, "model_dump") else _safe_dict(item)
            evidence = _json_safe(_safe_dict(c.get("evidence")))
            source_chunk_id = evidence.get("source_chunk_id")
            parsed_source_chunk_id = (
                uuid.UUID(str(source_chunk_id)) if source_chunk_id else None
            )
            row = Claim(
                run_id=run_id,
                company_id=company_id,
                source_chunk_id=parsed_source_chunk_id,
                claim_text=c.get("claim_text") or "",
                claim_type=c.get("claim_type") or default_claim_type,
                confidence=c.get("confidence"),
                is_verified=bool(c.get("verified", False)),
                evidence=evidence,
            )
            self.session.add(row)
            self.session.flush()
            claim_ids.append(row.id)
        return claim_ids

    def list_claims_for_run(
        self, run_id: uuid.UUID, company_id: uuid.UUID | None = None
    ) -> list[Claim]:
        query = select(Claim).where(Claim.run_id == run_id)
        if company_id is not None:
            query = query.where(Claim.company_id == company_id)
        rows = self.session.execute(query.order_by(Claim.created_at.asc())).scalars()
        return list(rows)

    def apply_claim_verification(self, claim_updates: list[dict]) -> int:
        updated = 0
        for item in claim_updates:
            claim_id = item.get("claim_id")
            if not claim_id:
                continue
            try:
                parsed_id = uuid.UUID(str(claim_id))
            except ValueError:
                continue
            claim = self.session.get(Claim, parsed_id)
            if claim is None:
                continue
            claim.is_verified = bool(item.get("is_verified", False))
            updated += 1
        self.session.flush()
        return updated

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
        row.products_services = _json_field(data.get("products_services"))
        row.customer_segments = _json_field(data.get("customer_segments"))
        row.geographies = _json_field(data.get("geographies"))
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
        row.trends = _json_field(data.get("trends"))
        row.risks = _json_field(data.get("risks"))
        row.opportunities = _json_field(data.get("opportunities"))
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
                extra=_json_field(info.get("metadata")),
            )
            self.session.add(competitor)
            self.session.flush()
            profile = CompetitorProfile(
                competitor_id=competitor.id,
                profile_text=info.get("profile_text"),
                strengths=_json_field(info.get("strengths")),
                weaknesses=_json_field(info.get("weaknesses")),
                differentiation=_json_field(info.get("differentiation")),
                extra=_json_field(info.get("profile_metadata")),
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
        row.key_risks = _json_field(data.get("key_risks"))
        row.diligence_focus = _json_field(data.get("diligence_focus"))
        row.integration_themes = _json_field(data.get("integration_themes"))
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
        row.initiatives = _json_field(data.get("initiatives"))
        row.timeline = _json_field(data.get("timeline"))
        row.kpis = _json_field(data.get("kpis"))
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
        latest = self.session.execute(
            select(ReportVersion)
            .where(ReportVersion.run_id == run_id, ReportVersion.company_id == company_id)
            .order_by(ReportVersion.version_number.desc())
        ).scalars().first()
        next_version = (latest.version_number + 1) if latest else 1
        row = ReportVersion(
            run_id=run_id,
            company_id=company_id,
            version_number=next_version,
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

