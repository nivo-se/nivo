"""Embedding wrapper for retrieval chunks."""

from __future__ import annotations

import logging
from dataclasses import dataclass

from backend.config import AppSettings

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class EmbeddingResult:
    model: str
    vectors: list[list[float]]


class EmbeddingService:
    """Optional embedding generator for chunked text."""

    def __init__(self, settings: AppSettings) -> None:
        self.settings = settings
        self.model = settings.retrieval_embedding_model
        self._client = None
        if settings.openai_api_key:
            try:
                from openai import OpenAI

                self._client = OpenAI(api_key=settings.openai_api_key)
            except Exception as exc:  # pragma: no cover - import/runtime environment
                logger.warning("Failed to initialize OpenAI client for embeddings: %s", exc)

    def embed_texts(self, texts: list[str]) -> EmbeddingResult:
        if not texts:
            return EmbeddingResult(model="none", vectors=[])
        if self._client is None:
            return EmbeddingResult(model="none", vectors=[])
        try:
            response = self._client.embeddings.create(
                model=self.model,
                input=texts,
            )
            vectors = [item.embedding for item in response.data]
            return EmbeddingResult(model=self.model, vectors=vectors)
        except Exception as exc:  # pragma: no cover - network dependent
            logger.warning("Embedding call failed: %s", exc)
            return EmbeddingResult(model="none", vectors=[])

