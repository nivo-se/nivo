"""Text chunking utilities for source storage and embeddings."""

from __future__ import annotations

from dataclasses import dataclass

from backend.config import AppSettings


@dataclass(slots=True)
class TextChunk:
    index: int
    text: str
    token_count: int


class Chunker:
    """Character-based chunker with optional token counting."""

    def __init__(self, settings: AppSettings) -> None:
        self.settings = settings
        self._encoding = None
        try:
            import tiktoken  # type: ignore

            self._encoding = tiktoken.get_encoding("cl100k_base")
        except Exception:
            self._encoding = None

    def _token_count(self, text: str) -> int:
        if self._encoding is None:
            # Fallback approximation (roughly 4 chars/token).
            return max(1, len(text) // 4)
        return len(self._encoding.encode(text))

    def split(self, text: str) -> list[TextChunk]:
        size = self.settings.retrieval_chunk_size_chars
        overlap = self.settings.retrieval_chunk_overlap_chars
        if size <= 0:
            return []
        if overlap >= size:
            overlap = max(0, size // 4)

        chunks: list[TextChunk] = []
        start = 0
        index = 0
        while start < len(text):
            end = min(len(text), start + size)
            chunk_text = text[start:end].strip()
            if chunk_text:
                chunks.append(
                    TextChunk(
                        index=index,
                        text=chunk_text,
                        token_count=self._token_count(chunk_text),
                    )
                )
                index += 1
            if end >= len(text):
                break
            start = max(0, end - overlap)
        return chunks

