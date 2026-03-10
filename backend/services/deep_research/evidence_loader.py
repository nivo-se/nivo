"""Load validated WebEvidence for a run. Used by Workstream 3 competitor/market services."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import select

from backend.db.models.deep_research import WebEvidence


@dataclass(slots=True)
class EvidenceRecord:
    """Structured evidence record for Workstream 3 services."""

    id: uuid.UUID
    claim: str
    claim_type: str
    value: str | None
    unit: str | None
    source_url: str | None
    source_title: str | None
    source_domain: str | None
    source_type: str | None
    source_id: uuid.UUID | None
    supporting_text: str | None
    confidence: float | None
    overall_score: float | None
    verification_status: str | None
    query_group: str | None
    query: str | None


def load_validated_evidence(
    session,
    run_id: uuid.UUID,
    company_id: uuid.UUID | None = None,
    query_groups: list[str] | None = None,
) -> list[EvidenceRecord]:
    """Load accepted WebEvidence for a run.

    Args:
        session: SQLAlchemy session
        run_id: Analysis run ID
        company_id: Optional company filter (None = all for run)
        query_groups: Optional filter by query_group (e.g. ["market", "competitors"])

    Returns:
        List of EvidenceRecord for downstream services.
    """
    q = select(WebEvidence).where(WebEvidence.run_id == run_id)
    if company_id is not None:
        q = q.where(WebEvidence.company_id == company_id)

    rows = list(session.execute(q.order_by(WebEvidence.created_at.asc())).scalars().all())
    if query_groups:
        rows = [r for r in rows if (r.extra or {}).get("query_group") in query_groups]
    records: list[EvidenceRecord] = []
    for row in rows:
        extra = row.extra if isinstance(row.extra, dict) else {}
        records.append(
            EvidenceRecord(
                id=row.id,
                claim=row.claim or "",
                claim_type=row.claim_type or "company_fact",
                value=row.value,
                unit=row.unit,
                source_url=row.source_url,
                source_title=row.source_title,
                source_domain=row.source_domain,
                source_type=row.source_type,
                source_id=row.source_id,
                supporting_text=row.supporting_text,
                confidence=float(row.confidence) if row.confidence is not None else None,
                overall_score=float(row.overall_score) if row.overall_score is not None else None,
                verification_status=row.verification_status,
                query_group=extra.get("query_group"),
                query=extra.get("query"),
            )
        )
    return records
