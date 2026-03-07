"""Retrieval service scaffold (no retrieval logic yet)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class RetrievalService:
    """Retrieval placeholder used for dependency wiring."""

    source: str = "postgres"

    def health(self) -> dict:
        return {"source": self.source, "ready": True}

