"""Competitor profiling agent."""

from __future__ import annotations

import re
from dataclasses import dataclass

from .context import AgentContext, SourceChunkRecord, SourceRecord
from .schemas import (
    AgentClaim,
    CompetitorCandidate,
    CompetitorProfileData,
    CompetitorProfilingAgentOutput,
    SourceEvidence,
)

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


@dataclass(slots=True)
class CompetitorProfilingAgent:
    """Builds competitor profiles from discovered competitors and source evidence."""

    def _mention_sentences(self, context: AgentContext, competitor_name: str) -> list[str]:
        matches: list[str] = []
        needle = competitor_name.lower()
        for source in context.sources:
            text = f"{source.title or ''}. {source.content_text or ''}".strip()
            for sentence in SENTENCE_SPLIT.split(text):
                if needle in sentence.lower():
                    matches.append(sentence.strip())
        return matches

    def _first_evidence(
        self, context: AgentContext, competitor_name: str
    ) -> tuple[SourceRecord | None, SourceChunkRecord | None]:
        needle = competitor_name.lower()
        for source in context.sources:
            body = f"{source.title or ''} {source.content_text or ''}".lower()
            if needle in body:
                chunk = next((c for c in context.chunks if c.source_id == source.source_id), None)
                return source, chunk
        return context.primary_source(), context.primary_chunk()

    def run(
        self, context: AgentContext, competitors: list[CompetitorCandidate]
    ) -> CompetitorProfilingAgentOutput:
        profiles: list[CompetitorProfileData] = []
        claims: list[AgentClaim] = []

        strengths_map = {
            "Strong digital platform": ["platform", "software", "cloud", "automation"],
            "Enterprise relationships": ["enterprise", "corporate", "b2b"],
            "Scale advantages": ["global", "large", "leading", "market leader"],
        }
        weaknesses_map = {
            "Price/margin pressure": ["price pressure", "margin pressure", "discounting"],
            "Execution complexity": ["integration", "execution risk", "complexity"],
            "Regulatory exposure": ["compliance", "regulation", "regulatory"],
        }
        diff_map = {
            "Differentiates on product breadth": ["suite", "portfolio", "end-to-end"],
            "Differentiates on specialization": ["niche", "specialized", "vertical"],
            "Differentiates on service model": ["consulting", "managed service", "support"],
        }

        for competitor in competitors:
            sentences = self._mention_sentences(context, competitor.name)
            corpus = " ".join(sentences)[:5000]
            if not corpus:
                corpus = f"{competitor.name} referenced in research sources."
            profile_text = sentences[0] if sentences else corpus
            strengths = _extract_signals(corpus, strengths_map)
            weaknesses = _extract_signals(corpus, weaknesses_map)
            differentiation = _extract_signals(corpus, diff_map)

            source_ref, chunk_ref = self._first_evidence(context, competitor.name)
            source_ids = (
                list({source_ref.source_id}) if source_ref else competitor.source_ids
            )

            profiles.append(
                CompetitorProfileData(
                    name=competitor.name,
                    profile_text=profile_text,
                    strengths=strengths,
                    weaknesses=weaknesses,
                    differentiation=differentiation,
                    source_ids=source_ids,
                    metadata={"relation_score": competitor.relation_score},
                )
            )

            claims.append(
                AgentClaim(
                    claim_text=f"{competitor.name} has a profile derived from referenced market sources.",
                    claim_type="competitor_profile",
                    confidence=max(0.4, competitor.relation_score),
                    evidence=SourceEvidence(
                        source_id=source_ref.source_id if source_ref else None,
                        source_chunk_id=chunk_ref.chunk_id if chunk_ref else None,
                        source_url=source_ref.url if source_ref else None,
                        source_title=source_ref.title if source_ref else None,
                        excerpt=(chunk_ref.text[:280] if chunk_ref else profile_text[:280]),
                    ),
                )
            )

        return CompetitorProfilingAgentOutput(
            profiles=profiles,
            claims=claims,
            metadata={"profile_count": len(profiles)},
        )

