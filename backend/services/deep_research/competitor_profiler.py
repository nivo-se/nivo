"""Workstream 3: Build compact canonical profiles for accepted competitors."""

from __future__ import annotations

import re
from dataclasses import dataclass

from .competitor_market_schemas import (
    CompetitorProfileW3,
    VerifiedCompetitor,
)
from .evidence_loader import EvidenceRecord


SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")


def _extract_signals(text: str, mapping: dict[str, list[str]], limit: int = 4) -> list[str]:
    lower = text.lower()
    out: list[str] = []
    for label, keys in mapping.items():
        if any(k in lower for k in keys):
            out.append(label)
        if len(out) >= limit:
            break
    return out


def _gather_evidence_text(
    competitor: VerifiedCompetitor,
    evidence: list[EvidenceRecord],
) -> str:
    """Collect all evidence text mentioning this competitor."""
    ev_ids = {r.web_evidence_id for r in competitor.evidence_refs if r.web_evidence_id}
    ev_by_id = {e.id: e for e in evidence if e.id}
    parts: list[str] = []
    for eid in ev_ids:
        if eid in ev_by_id:
            ev = ev_by_id[eid]
            parts.append(ev.claim or "")
            if ev.supporting_text:
                parts.append(ev.supporting_text)
    return " ".join(parts)


@dataclass(slots=True)
class CompetitorProfiler:
    """Build canonical competitor profiles from verified competitors and evidence."""

    def profile(
        self,
        verified: list[VerifiedCompetitor],
        evidence: list[EvidenceRecord],
    ) -> list[CompetitorProfileW3]:
        """Build compact profiles for accepted (non-rejected) competitors only."""
        accepted = [v for v in verified if v.verification_status != "rejected"]
        profiles: list[CompetitorProfileW3] = []

        product_focus_map = {
            "Software/SaaS": ["software", "saas", "cloud", "platform", "api"],
            "Services": ["service", "consulting", "managed", "support"],
            "Hardware": ["hardware", "device", "equipment"],
            "Marketplace": ["marketplace", "platform", "aggregator"],
        }
        scale_map = {
            "Enterprise scale": ["enterprise", "global", "fortune", "large"],
            "Mid-market": ["mid-market", "sme", "growing"],
            "Startup/emerging": ["startup", "emerging", "early-stage"],
        }

        for v in accepted:
            text = _gather_evidence_text(v, evidence)
            if not text.strip():
                text = f"{v.name} referenced in validated evidence."

            product_focus = _extract_signals(text, product_focus_map, limit=3)
            scale_signal = None
            for label, keys in scale_map.items():
                if any(k in text.lower() for k in keys):
                    scale_signal = label
                    break

            # Description: first substantive sentence or truncated text
            sentences = SENTENCE_SPLIT.split(text)
            description = None
            for s in sentences:
                s = s.strip()
                if len(s) > 30 and v.name.lower() in s.lower():
                    description = s[:500]
                    break
            if not description:
                description = text[:400] + "..." if len(text) > 400 else text

            # Confidence: higher when more evidence
            n_refs = len(v.evidence_refs)
            confidence = min(0.9, 0.4 + n_refs * 0.1)

            profiles.append(
                CompetitorProfileW3(
                    company_name=v.name,
                    description=description,
                    product_focus=product_focus,
                    target_customers=[],
                    geographies=[],
                    business_model=None,
                    positioning_summary=None,
                    estimated_scale_signal=scale_signal,
                    evidence_refs=v.evidence_refs,
                    profile_confidence=round(confidence, 2),
                    verification_status=v.verification_status,
                    metadata=v.metadata,
                )
            )
        return profiles
