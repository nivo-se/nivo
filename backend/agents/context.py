"""Source context structures used by core research agents."""

from __future__ import annotations

import uuid
from dataclasses import dataclass


@dataclass(slots=True)
class SourceRecord:
    source_id: uuid.UUID
    source_type: str
    title: str | None
    url: str | None
    content_text: str | None
    metadata: dict


@dataclass(slots=True)
class SourceChunkRecord:
    chunk_id: uuid.UUID
    source_id: uuid.UUID
    text: str
    token_count: int | None


@dataclass(slots=True)
class AgentContext:
    company_id: uuid.UUID
    company_name: str
    orgnr: str | None
    website: str | None
    sources: list[SourceRecord]
    chunks: list[SourceChunkRecord]

    def joined_text(self, max_chars: int = 10000) -> str:
        chunk_text = " ".join(c.text for c in self.chunks if c.text)
        source_text = " ".join(s.content_text or "" for s in self.sources)
        text = f"{chunk_text} {source_text}".strip()
        return text[:max_chars]

    def primary_source(self) -> SourceRecord | None:
        return self.sources[0] if self.sources else None

    def primary_chunk(self) -> SourceChunkRecord | None:
        return self.chunks[0] if self.chunks else None

