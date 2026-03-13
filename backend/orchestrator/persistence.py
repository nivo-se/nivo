"""Persistence helpers for orchestrator run and node states."""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from backend.db.models.deep_research import (
    AnalysisRun,
    Claim,
    ClaimVerification,
    Company,
    CompanyProfile,
    ReportSpecPersistence,
    Competitor,
    CompetitorCandidate,
    CompetitorProfile,
    FinancialModel,
    MarketAnalysis,
    MarketModel,
    MarketSynthesis,
    PositioningAnalysis,
    ReportSection,
    ReportVersion,
    RunNodeState,
    Source,
    SourceChunk,
    Strategy,
    Valuation,
    ValueCreation,
    WebEvidence,
    WebEvidenceRejected,
    WebSearchSession,
)
from backend.agents.context import AgentContext, SourceChunkRecord, SourceRecord
from backend.agents.schemas import AgentClaim, IdentityAgentOutput

logger = logging.getLogger(__name__)


class CompanyResolutionError(Exception):
    """Raised when a company cannot be resolved from the main database."""


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


def _resolve_from_main_db(
    orgnr: str | None, company_name: str | None
) -> tuple[str, str, str | None, str, float] | None:
    """Resolve company identity from public.companies.

    Returns (orgnr, company_name, homepage, source, confidence) or None.
    """
    try:
        from backend.services.db_factory import get_database_service
        db = get_database_service()
    except Exception:
        logger.debug("Main DB service unavailable for company resolution")
        return None

    try:
        if orgnr and not orgnr.startswith("tmp-"):
            rows = db.run_raw_query(
                "SELECT orgnr, company_name, homepage FROM companies WHERE orgnr = %s LIMIT 1",
                params=[orgnr],
            )
            if rows:
                r = rows[0]
                return (r["orgnr"], r["company_name"], r.get("homepage"), "main_db_by_orgnr", 1.0)

        if company_name:
            normalized = company_name.strip()
            rows = db.run_raw_query(
                "SELECT orgnr, company_name, homepage FROM companies "
                "WHERE lower(trim(company_name)) = lower(trim(%s)) LIMIT 1",
                params=[normalized],
            )
            if rows:
                r = rows[0]
                return (r["orgnr"], r["company_name"], r.get("homepage"), "main_db_by_name", 0.9)
    except Exception as exc:
        logger.warning("Main DB company resolution failed: %s", exc)

    return None


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
        # Step 1: if resuming by company_id, return existing deep-research row
        if company_id:
            company = self.session.get(Company, company_id)
            if company:
                upgraded = self._upgrade_company_from_main_db(company, company_name, website)
                if upgraded:
                    self.session.flush()
                return company

        # Step 2: resolve real identity from public.companies
        main_result = _resolve_from_main_db(orgnr, company_name)
        if main_result:
            real_orgnr, real_name, real_homepage, source, confidence = main_result
            logger.info(
                "Company resolved: orgnr=%s source=%s confidence=%.1f name=%s",
                real_orgnr, source, confidence, real_name,
            )
            orgnr = real_orgnr
            company_name = company_name or real_name
            website = website or real_homepage

        # Step 3: look up existing deep-research company by resolved orgnr
        company: Company | None = None
        if orgnr and not orgnr.startswith("tmp-"):
            company = self.session.execute(
                select(Company).where(Company.orgnr == orgnr)
            ).scalar_one_or_none()

        # Step 4: fall back to name lookup in deep-research
        if not company and company_name:
            company = self.session.execute(
                select(Company)
                .where(Company.name == company_name)
                .order_by(Company.created_at.desc())
            ).scalars().first()

        # Step 5: if found, upgrade tmp-orgnr and fill missing fields
        if company:
            if company_name:
                company.name = company_name
            if website and not company.website:
                company.website = website
            if orgnr and not orgnr.startswith("tmp-") and company.orgnr.startswith("tmp-"):
                logger.info(
                    "Upgrading company orgnr from %s to %s", company.orgnr, orgnr,
                )
                company.orgnr = orgnr
            self.session.flush()
            return company

        # Step 6: create new deep-research company — require real orgnr
        if not orgnr or orgnr.startswith("tmp-"):
            raise CompanyResolutionError(
                f"Company not found in main DB: name={company_name!r} orgnr={orgnr!r}. "
                "Deep Research requires companies that exist in the main database."
            )

        company = Company(
            orgnr=orgnr,
            name=company_name or f"Company {orgnr}",
            website=website,
        )
        self.session.add(company)
        self.session.flush()
        logger.info(
            "Created deep-research company: orgnr=%s name=%s", orgnr, company.name,
        )
        return company

    def _upgrade_company_from_main_db(
        self, company: Company, company_name: str | None, website: str | None,
    ) -> bool:
        """If the company has a tmp-orgnr, try to resolve the real one from main DB."""
        changed = False
        if company.orgnr.startswith("tmp-"):
            main_result = _resolve_from_main_db(None, company_name or company.name)
            if main_result:
                real_orgnr, real_name, real_homepage, source, confidence = main_result
                logger.info(
                    "Upgrading existing company from tmp- to real orgnr: %s -> %s (source=%s)",
                    company.orgnr, real_orgnr, source,
                )
                company.orgnr = real_orgnr
                if real_homepage and not company.website:
                    company.website = real_homepage
                changed = True
        if company_name and company_name != company.name:
            company.name = company_name
            changed = True
        if website and not company.website:
            company.website = website
            changed = True
        return changed

    def create_or_resume_run(
        self,
        *,
        run_id: uuid.UUID | None,
        company_id: uuid.UUID,
        query: str,
        initial_status: str = "running",
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
            status=initial_status,
            query=query,
            started_at=datetime.utcnow() if initial_status == "running" else None,
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

    def finalize_run(
        self,
        run_id: uuid.UUID,
        *,
        status: str,
        error: str | None = None,
        run_diagnostics: dict | None = None,
    ) -> None:
        """Finalize run and optionally persist run diagnostics to run.extra."""
        run = self.session.get(AnalysisRun, run_id)
        if not run:
            return
        run.status = status
        run.completed_at = datetime.utcnow()
        run.error_message = error
        if run_diagnostics:
            extra = dict(run.extra) if isinstance(run.extra, dict) else {}
            extra["run_diagnostics"] = run_diagnostics
            run.extra = extra
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

    def clear_run_analysis_data(self, run_id: uuid.UUID) -> None:
        """Remove all analysis data for a run so it can be restarted from scratch.
        Preserves the run and company records. Call before re-enqueuing a failed/pending run."""
        # Delete in FK order: children before parents
        # ReportSection -> ReportVersion
        self.session.execute(
            delete(ReportSection).where(
                ReportSection.report_version_id.in_(
                    select(ReportVersion.id).where(ReportVersion.run_id == run_id)
                )
            )
        )
        self.session.execute(delete(ReportVersion).where(ReportVersion.run_id == run_id))
        # WebEvidence references session_id, source_id — delete before WebSearchSession, Source
        self.session.execute(delete(WebEvidence).where(WebEvidence.run_id == run_id))
        self.session.execute(delete(WebEvidenceRejected).where(WebEvidenceRejected.run_id == run_id))
        self.session.execute(delete(WebSearchSession).where(WebSearchSession.run_id == run_id))
        # SourceChunk -> Source
        self.session.execute(
            delete(SourceChunk).where(
                SourceChunk.source_id.in_(select(Source.id).where(Source.run_id == run_id))
            )
        )
        self.session.execute(delete(Source).where(Source.run_id == run_id))
        # ClaimVerification -> Claim
        self.session.execute(
            delete(ClaimVerification).where(
                ClaimVerification.claim_id.in_(select(Claim.id).where(Claim.run_id == run_id))
            )
        )
        self.session.execute(delete(Claim).where(Claim.run_id == run_id))
        # Run-scoped tables (CompetitorProfile cascades when Competitor is deleted)
        for model in (
            CompetitorCandidate,
            MarketModel,
            PositioningAnalysis,
            MarketSynthesis,
            MarketAnalysis,
            CompanyProfile,
            Competitor,
            Strategy,
            ValueCreation,
            FinancialModel,
            Valuation,
            RunNodeState,
        ):
            self.session.execute(delete(model).where(model.run_id == run_id))
        self.session.flush()

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
        extra = _safe_dict(data.get("metadata"))
        # Persist first-class company understanding fields for QueryPlanner and gating
        if data.get("market_niche") is not None:
            extra["market_niche"] = data.get("market_niche")
        if data.get("confidence_score") is not None:
            extra["confidence_score"] = data.get("confidence_score")
        if data.get("company_description") is not None:
            extra["company_description"] = data.get("company_description")
        if data.get("source_refs"):
            extra["source_refs"] = data.get("source_refs")
        row.extra = extra
        self.session.flush()

    def persist_web_search_session(
        self,
        run_id: uuid.UUID,
        company_id: uuid.UUID,
        query_group: str,
        queries: list,
        provider: str = "tavily",
        metadata: dict | None = None,
    ) -> uuid.UUID:
        """Persist a web search session; return session id."""
        row = WebSearchSession(
            run_id=run_id,
            company_id=company_id,
            query_group=query_group,
            queries=queries if isinstance(queries, dict) else {"items": queries},
            provider=provider,
            extra=_safe_dict(metadata),
        )
        self.session.add(row)
        self.session.flush()
        return row.id

    def persist_web_evidence(
        self,
        run_id: uuid.UUID,
        company_id: uuid.UUID,
        session_id: uuid.UUID | None,
        evidence_items: list,
        source_id_map: dict | None = None,
    ) -> list[uuid.UUID]:
        """Persist accepted evidence; create Source records for build_agent_context. Return evidence ids."""
        source_id_map = source_id_map or {}
        ids: list[uuid.UUID] = []
        for item in evidence_items:
            source_id = source_id_map.get(item.source_url)
            if not source_id:
                src = Source(
                    run_id=run_id,
                    company_id=company_id,
                    source_type=f"tavily_{item.query_group}",
                    title=item.source_title,
                    url=item.source_url,
                    content_text=item.supporting_text,
                    extra={
                        "claim": item.claim,
                        "claim_type": item.claim_type,
                        "value": item.value,
                        "unit": item.unit,
                        "overall_score": item.overall_score,
                        "verification_status": item.verification_status,
                        "provenance": "public",
                    },
                )
                self.session.add(src)
                self.session.flush()
                source_id = src.id

            row = WebEvidence(
                run_id=run_id,
                company_id=company_id,
                session_id=session_id,
                source_id=source_id,
                claim=item.claim,
                claim_type=item.claim_type,
                value=item.value,
                unit=item.unit,
                source_url=item.source_url,
                source_title=item.source_title,
                source_domain=item.source_domain,
                source_type=item.source_type,
                supporting_text=item.supporting_text,
                confidence=item.confidence,
                overall_score=item.overall_score,
                verification_status=item.verification_status,
                extra={"query_group": item.query_group, "query": item.query},
            )
            self.session.add(row)
            self.session.flush()
            ids.append(row.id)
        return ids

    def persist_web_evidence_rejected(
        self,
        run_id: uuid.UUID,
        company_id: uuid.UUID,
        items_with_reasons: list[tuple],
    ) -> None:
        """Persist rejected evidence with rejection reasons."""
        for item, reason in items_with_reasons:
            snapshot = {
                "claim": getattr(item, "claim", ""),
                "claim_type": getattr(item, "claim_type", ""),
                "source_url": getattr(item, "source_url", ""),
            }
            row = WebEvidenceRejected(
                run_id=run_id,
                company_id=company_id,
                evidence_snapshot=snapshot,
                rejection_reason=str(reason),
            )
            self.session.add(row)
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

    def persist_competitor_candidates(
        self,
        run_id: uuid.UUID,
        company_id: uuid.UUID,
        candidates: list,
        verified_results: list,
    ) -> None:
        """Persist competitor candidates and their verification status (Workstream 3)."""
        verified_by_name = {v.name: v for v in verified_results if hasattr(v, "name")}
        for c in candidates:
            v = verified_by_name.get(getattr(c, "name", ""))
            status = getattr(v, "verification_status", "pending") if v else "pending"
            rejection = getattr(v, "rejection_reason", None) if v else None
            refs = _json_safe([r.model_dump() if hasattr(r, "model_dump") else r for r in getattr(c, "evidence_refs", [])])
            row = CompetitorCandidate(
                run_id=run_id,
                company_id=company_id,
                candidate_name=getattr(c, "name", "Unknown"),
                candidate_type=getattr(c, "candidate_type", "adjacent"),
                inclusion_rationale=getattr(c, "inclusion_rationale", None),
                evidence_refs=refs,
                verification_status=status,
                rejection_reason=rejection,
                extra=_safe_dict(getattr(c, "metadata", {})),
            )
            self.session.add(row)
        self.session.flush()

    def persist_market_model(self, run_id: uuid.UUID, company_id: uuid.UUID, payload: dict) -> None:
        """Persist market model (Workstream 3)."""
        data = _safe_dict(payload)
        row = self.session.execute(
            select(MarketModel).where(
                MarketModel.run_id == run_id, MarketModel.company_id == company_id
            )
        ).scalar_one_or_none()
        if row is None:
            row = MarketModel(run_id=run_id, company_id=company_id)
            self.session.add(row)
        row.market_label = data.get("market_label") or row.market_label or "Unspecified"
        row.market_subsegment = data.get("market_subsegment")
        row.geography_scope = data.get("geography_scope")
        row.customer_segment = data.get("customer_segment")
        row.buying_model = data.get("buying_model")
        row.demand_drivers = _json_field(data.get("demand_drivers"))
        row.market_growth_signal = data.get("market_growth_signal")
        row.concentration_signal = data.get("concentration_signal")
        row.fragmentation_signal = data.get("fragmentation_signal")
        row.market_maturity_signal = data.get("market_maturity_signal")
        row.cyclicality_signal = data.get("cyclicality_signal")
        row.regulatory_signal = data.get("regulatory_signal")
        row.evidence_refs = _json_safe(data.get("evidence_refs", []))
        row.confidence_score = data.get("confidence_score")
        row.extra = _safe_dict(data.get("metadata", {}))
        self.session.flush()

    def persist_positioning_analysis(
        self, run_id: uuid.UUID, company_id: uuid.UUID, payload: dict
    ) -> None:
        """Persist positioning analysis (Workstream 3)."""
        data = _safe_dict(payload)
        row = self.session.execute(
            select(PositioningAnalysis).where(
                PositioningAnalysis.run_id == run_id,
                PositioningAnalysis.company_id == company_id,
            )
        ).scalar_one_or_none()
        if row is None:
            row = PositioningAnalysis(run_id=run_id, company_id=company_id)
            self.session.add(row)
        row.differentiated_axes = _json_field(data.get("differentiated_axes"))
        row.parity_axes = _json_field(data.get("parity_axes"))
        row.disadvantage_axes = _json_field(data.get("disadvantage_axes"))
        row.unclear_axes = _json_field(data.get("unclear_axes"))
        row.positioning_summary = data.get("positioning_summary")
        row.evidence_refs = _json_safe(data.get("evidence_refs", []))
        row.extra = _safe_dict(data.get("metadata", {}))
        self.session.flush()

    def persist_market_synthesis(
        self, run_id: uuid.UUID, company_id: uuid.UUID, payload: dict
    ) -> None:
        """Persist market synthesis (Workstream 3)."""
        data = _safe_dict(payload)
        row = self.session.execute(
            select(MarketSynthesis).where(
                MarketSynthesis.run_id == run_id,
                MarketSynthesis.company_id == company_id,
            )
        ).scalar_one_or_none()
        if row is None:
            row = MarketSynthesis(run_id=run_id, company_id=company_id)
            self.session.add(row)
        row.market_attractiveness_score = data.get("market_attractiveness_score")
        row.competition_intensity_score = data.get("competition_intensity_score")
        row.niche_defensibility_score = data.get("niche_defensibility_score")
        row.growth_support_score = data.get("growth_support_score")
        row.synthesis_summary = data.get("synthesis_summary") or ""
        row.key_supporting_claims = _json_field(data.get("key_supporting_claims"))
        row.key_uncertainties = _json_field(data.get("key_uncertainties"))
        row.evidence_refs = _json_safe(data.get("evidence_refs", []))
        row.confidence_score = data.get("confidence_score")
        row.extra = _safe_dict(data.get("metadata", {}))
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

    def persist_claim_verifications(
        self,
        *,
        run_id: uuid.UUID,
        claim_updates: list[dict],
    ) -> int:
        """Write per-claim verification rows to claim_verifications table."""
        count = 0
        for item in claim_updates:
            claim_id_str = item.get("claim_id")
            if not claim_id_str:
                continue
            try:
                claim_id = uuid.UUID(str(claim_id_str))
            except ValueError:
                continue
            claim = self.session.get(Claim, claim_id)
            if claim is None:
                continue

            row = ClaimVerification(
                run_id=run_id,
                claim_id=claim_id,
                status=item.get("verification_status", "UNCERTAIN"),
                confidence_score=float(claim.confidence) if claim.confidence is not None else None,
                source_ids=_json_safe([str(claim.source_chunk_id)] if claim.source_chunk_id else []),
                notes=None,
            )
            self.session.add(row)
            count += 1
        self.session.flush()
        return count

    def list_claim_verifications(self, run_id: uuid.UUID) -> list[ClaimVerification]:
        rows = self.session.execute(
            select(ClaimVerification)
            .where(ClaimVerification.run_id == run_id)
            .order_by(ClaimVerification.created_at.asc())
        ).scalars()
        return list(rows)

