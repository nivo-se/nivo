"""Competitor discovery agent using source text semantic similarity."""

from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urlparse

from .context import AgentContext, SourceChunkRecord
from .schemas import (
    AgentClaim,
    CompetitorCandidate,
    CompetitorDiscoveryAgentOutput,
    SourceEvidence,
)
from .text_similarity import cosine_similarity

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


@dataclass(slots=True)
class CompetitorDiscoveryAgent:
    """Discovers competitor candidates from sources and chunks."""

    max_competitors: int = 5

    def _chunk_for_source(
        self, chunks: list[SourceChunkRecord], source_id
    ) -> SourceChunkRecord | None:
        for chunk in chunks:
            if chunk.source_id == source_id:
                return chunk
        return None

    def run(self, context: AgentContext) -> CompetitorDiscoveryAgentOutput:
        source_ids = [s.source_id for s in context.sources]
        target_domain = _root_domain(context.website)
        target_name = context.company_name.lower()
        target_profile = (
            f"{context.company_name} {context.website or ''} {context.joined_text(max_chars=6000)}"
        )

        candidates: dict[str, dict] = {}
        for source in context.sources:
            content = source.content_text or ""
            title = source.title or ""
            blob = f"{title}. {content}".strip()
            if not blob:
                continue

            sentences = SENTENCE_SPLIT.split(blob)
            for sentence in sentences:
                found = COMPANY_PATTERN.findall(sentence)
                for raw in found:
                    name = " ".join(raw.split())
                    lower_name = name.lower()
                    if lower_name == target_name or lower_name in target_name:
                        continue
                    if context.company_name.lower() in lower_name:
                        continue

                    chunk = self._chunk_for_source(context.chunks, source.source_id)
                    semantic = cosine_similarity(target_profile, sentence)
                    keyword_boost = 0.1 if "compet" in sentence.lower() else 0.0
                    relation_score = max(0.0, min(1.0, semantic + keyword_boost))
                    bucket = candidates.setdefault(
                        name,
                        {
                            "name": name,
                            "website": None,
                            "relation_score": 0.0,
                            "source_ids": set(),
                            "snippet": sentence[:280],
                            "source_ref": source,
                            "chunk_ref": chunk,
                            "mentions": 0,
                        },
                    )
                    bucket["mentions"] += 1
                    bucket["relation_score"] = max(bucket["relation_score"], relation_score)
                    bucket["source_ids"].add(source.source_id)

            source_domain = _root_domain(source.url)
            if source_domain and target_domain and source_domain != target_domain:
                host_name = source_domain.split(".")[0].replace("-", " ").title()
                if len(host_name) > 2 and host_name.lower() not in target_name:
                    bucket = candidates.setdefault(
                        host_name,
                        {
                            "name": host_name,
                            "website": source.url,
                            "relation_score": 0.25,
                            "source_ids": {source.source_id},
                            "snippet": (source.title or source.url or "")[:280],
                            "source_ref": source,
                            "chunk_ref": self._chunk_for_source(context.chunks, source.source_id),
                            "mentions": 1,
                        },
                    )
                    bucket["website"] = bucket["website"] or source.url

        ranked = sorted(
            candidates.values(),
            key=lambda x: (x["relation_score"] + min(0.2, x["mentions"] * 0.05)),
            reverse=True,
        )[: self.max_competitors]

        competitors: list[CompetitorCandidate] = []
        claims: list[AgentClaim] = []
        for item in ranked:
            competitor = CompetitorCandidate(
                name=item["name"],
                website=item.get("website"),
                relation_score=round(float(item.get("relation_score", 0.0)), 4),
                source_ids=list(item.get("source_ids", set())),
                metadata={"mentions": int(item.get("mentions", 1))},
            )
            competitors.append(competitor)

            source_ref = item.get("source_ref")
            chunk_ref = item.get("chunk_ref")
            claims.append(
                AgentClaim(
                    claim_text=f"{competitor.name} appears to be a potential competitor to {context.company_name}.",
                    claim_type="competitor_discovery",
                    confidence=max(0.35, min(0.9, competitor.relation_score)),
                    evidence=SourceEvidence(
                        source_id=source_ref.source_id if source_ref else None,
                        source_chunk_id=chunk_ref.chunk_id if chunk_ref else None,
                        source_url=source_ref.url if source_ref else None,
                        source_title=source_ref.title if source_ref else None,
                        excerpt=item.get("snippet"),
                    ),
                )
            )

        return CompetitorDiscoveryAgentOutput(
            competitors=competitors,
            source_ids=source_ids,
            claims=claims,
            metadata={
                "method": "semantic_similarity_heuristic",
                "candidate_count": len(candidates),
            },
        )

