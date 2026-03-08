"""Persistence adapter for storing retrieved sources and chunks."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.db.models.deep_research import AnalysisRun, Company, Source, SourceChunk
from backend.services.deep_research.source_taxonomy import classify_provenance

from .chunking import TextChunk
from .source_scoring import SourceQualityScorer


@dataclass(slots=True)
class SourceStorage:
    """Encapsulates DB writes for retrieval pipeline artifacts."""

    session: Session

    def resolve_company(
        self,
        *,
        company_id: uuid.UUID | None,
        orgnr: str | None,
        company_name: str,
        website: str | None,
    ) -> Company:
        if company_id:
            company = self.session.get(Company, company_id)
            if company:
                if website and not company.website:
                    company.website = website
                if orgnr and not company.orgnr:
                    company.orgnr = orgnr
                if company_name and not company.name:
                    company.name = company_name
                self.session.flush()
                return company

        if orgnr:
            existing = self.session.execute(
                select(Company).where(Company.orgnr == orgnr)
            ).scalar_one_or_none()
            if existing:
                if website and not existing.website:
                    existing.website = website
                if company_name and existing.name != company_name:
                    existing.name = company_name
                self.session.flush()
                return existing

        company = Company(
            orgnr=orgnr or f"tmp-{uuid.uuid4().hex[:20]}",
            name=company_name,
            website=website,
        )
        self.session.add(company)
        self.session.flush()
        return company

    def resolve_run(
        self,
        *,
        run_id: uuid.UUID | None,
        company_id: uuid.UUID,
        query: str,
    ) -> AnalysisRun:
        if run_id:
            run = self.session.get(AnalysisRun, run_id)
            if run:
                run.status = "running"
                run.started_at = run.started_at or datetime.utcnow()
                self.session.flush()
                return run
        run = AnalysisRun(
            id=run_id or uuid.uuid4(),
            company_id=company_id,
            status="running",
            query=query,
            started_at=datetime.utcnow(),
            extra={},
        )
        self.session.add(run)
        self.session.flush()
        return run

    def save_source(
        self,
        *,
        run_id: uuid.UUID,
        company_id: uuid.UUID | None,
        source_type: str,
        title: str | None,
        url: str | None,
        content_text: str | None,
        metadata: dict | None = None,
        provenance: str | None = None,
    ) -> Source:
        provenance = provenance or classify_provenance(source_type)
        extra = dict(metadata) if metadata else {}
        extra["provenance"] = provenance
        source = Source(
            run_id=run_id,
            company_id=company_id,
            source_type=source_type,
            title=title,
            url=url,
            content_text=content_text,
            extra=extra,
        )
        scorer = SourceQualityScorer()
        quality = scorer.score(
            url=url or "",
            content_length=len(content_text) if content_text else None,
        )
        if source.extra is None:
            source.extra = {}
        source.extra["quality_score"] = quality["quality_score"]
        source.extra["quality_breakdown"] = quality
        self.session.add(source)
        self.session.flush()
        return source

    def save_chunks(
        self,
        *,
        source_id: uuid.UUID,
        chunks: list[TextChunk],
        embedding_model: str | None,
    ) -> int:
        count = 0
        for chunk in chunks:
            row = SourceChunk(
                source_id=source_id,
                chunk_index=chunk.index,
                content_text=chunk.text,
                token_count=chunk.token_count,
                embedding_model=embedding_model,
            )
            self.session.add(row)
            count += 1
        self.session.flush()
        return count

    def complete_run(self, run_id: uuid.UUID, *, errors: list[str]) -> None:
        run = self.session.get(AnalysisRun, run_id)
        if not run:
            return
        run.completed_at = datetime.utcnow()
        if errors:
            run.status = "failed"
            run.error_message = "; ".join(errors)[:4000]
        else:
            run.status = "completed"
            run.error_message = None
        self.session.flush()

    def list_sources_for_run(self, run_id: uuid.UUID) -> list[Source]:
        rows = self.session.execute(
            select(Source).where(Source.run_id == run_id).order_by(Source.created_at.desc())
        ).scalars()
        return list(rows)

    def count_chunks_for_source_ids(self, source_ids: list[uuid.UUID]) -> int:
        if not source_ids:
            return 0
        rows = self.session.execute(
            select(SourceChunk).where(SourceChunk.source_id.in_(source_ids))
        ).scalars()
        return sum(1 for _ in rows)

    def chunk_counts_for_source_ids(self, source_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
        if not source_ids:
            return {}
        rows = self.session.execute(
            select(SourceChunk.source_id, func.count(SourceChunk.id))
            .where(SourceChunk.source_id.in_(source_ids))
            .group_by(SourceChunk.source_id)
        ).all()
        return {row[0]: int(row[1]) for row in rows}

