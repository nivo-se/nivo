"""Workstream 3: Competitor candidate discovery from company profile and validated evidence."""

from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urlparse

from .competitor_market_schemas import (
    CandidateType,
    CompetitorCandidateW3,
    EvidenceRef,
)
from .evidence_loader import EvidenceRecord


COMPANY_PATTERN = re.compile(
    r"\b([A-Z][A-Za-z0-9&.\- ]{2,80}(?:AB|ASA|AS|Inc|Ltd|PLC|Group|Corp|Corporation|Technologies|Technology|Systems|Solutions))\b"
)
SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")


def _root_domain(url: str | None) -> str | None:
    if not url:
        return None
    host = urlparse(url).netloc.lower().strip()
    if host.startswith("www."):
        host = host[4:]
    if not host:
        return None
    parts = host.split(".")
    if len(parts) < 2:
        return host
    return ".".join(parts[-2:])


def _classify_candidate_type(
    candidate_name: str,
    company_profile: dict,
    evidence_text: str,
) -> CandidateType:
    """Classify candidate as direct, adjacent, or substitute based on overlap signals."""
    lower = evidence_text.lower()

    # Direct: same/similar offering, same customer segment
    direct_signals = ["competitor", "competes", "rival", "competing", "same market", "direct competitor"]
    if any(s in lower for s in direct_signals):
        return "direct"

    # Substitute: alternative solution
    substitute_signals = ["alternative", "substitute", "instead of", "replacement"]
    if any(s in lower for s in substitute_signals):
        return "substitute"

    # Adjacent: partial overlap, default
    return "adjacent"


@dataclass(slots=True)
class CompetitorDiscoveryService:
    """Discovers competitor candidates from company profile and validated web evidence."""

    max_candidates: int = 15

    def discover(
        self,
        *,
        company_name: str,
        company_profile: dict,
        evidence: list[EvidenceRecord],
        company_website: str | None = None,
    ) -> list[CompetitorCandidateW3]:
        """Generate competitor candidate universe with inclusion rationale and evidence refs."""
        target_name = company_name.lower()
        target_domain = _root_domain(company_website)
        seen: dict[str, CompetitorCandidateW3] = {}

        # 1. Extract from competitor_mention evidence
        for ev in evidence:
            if ev.claim_type != "competitor_mention":
                continue
            text = f"{ev.claim} {ev.supporting_text or ''}".strip()
            if not text or len(text) < 20:
                continue
            for sentence in SENTENCE_SPLIT.split(text):
                found = COMPANY_PATTERN.findall(sentence)
                for raw in found:
                    name = " ".join(raw.split()).strip()
                    if len(name) < 3:
                        continue
                    lower_name = name.lower()
                    if lower_name == target_name or target_name in lower_name:
                        continue
                    if company_name.lower() in lower_name:
                        continue

                    candidate_type = _classify_candidate_type(
                        name, company_profile, sentence
                    )
                    rationale = f"Mentioned in evidence: {sentence[:200]}..."
                    ref = EvidenceRef(
                        web_evidence_id=ev.id,
                        source_url=ev.source_url,
                        source_id=ev.source_id,
                        excerpt=ev.supporting_text[:280] if ev.supporting_text else None,
                    )
                    if name not in seen:
                        seen[name] = CompetitorCandidateW3(
                            name=name,
                            website=None,
                            candidate_type=candidate_type,
                            inclusion_rationale=rationale,
                            evidence_refs=[ref],
                            relation_score=0.6 + (0.2 if candidate_type == "direct" else 0),
                            metadata={"source": "evidence"},
                        )
                    else:
                        existing = seen[name]
                        existing.evidence_refs.append(ref)
                        if candidate_type == "direct" and existing.candidate_type != "direct":
                            existing.candidate_type = "direct"

        # 2. Extract from source domains (competitor evidence URLs)
        for ev in evidence:
            if ev.claim_type != "competitor_mention" and ev.query_group != "competitors":
                continue
            url = ev.source_url
            if not url:
                continue
            domain = _root_domain(url)
            if not domain or domain == target_domain:
                continue
            host_name = domain.split(".")[0].replace("-", " ").title()
            if len(host_name) < 3 or host_name.lower() == target_name:
                continue
            if host_name not in seen:
                ref = EvidenceRef(
                    web_evidence_id=ev.id,
                    source_url=ev.source_url,
                    source_id=ev.source_id,
                    excerpt=ev.supporting_text[:280] if ev.supporting_text else None,
                )
                seen[host_name] = CompetitorCandidateW3(
                    name=host_name,
                    website=ev.source_url,
                    candidate_type="adjacent",
                    inclusion_rationale=f"Source domain from competitor evidence: {domain}",
                    evidence_refs=[ref],
                    relation_score=0.4,
                    metadata={"source": "domain"},
                )

        # 3. Rank and limit
        ranked = sorted(
            seen.values(),
            key=lambda c: (c.relation_score, len(c.evidence_refs)),
            reverse=True,
        )[: self.max_candidates]
        return ranked
