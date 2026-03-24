"""Paragraph-based chunking for exemplar markdown (shared by indexer and tests)."""

from __future__ import annotations

import re


def chunk_exemplar_markdown(text: str, max_chars: int = 1200) -> list[str]:
    """Split on blank lines; merge small paragraphs up to max_chars."""
    paras = [p.strip() for p in re.split(r"\n\s*\n+", text) if p.strip()]
    chunks: list[str] = []
    buf = ""
    for p in paras:
        if len(buf) + len(p) + 2 <= max_chars:
            buf = f"{buf}\n\n{p}".strip() if buf else p
        else:
            if buf:
                chunks.append(buf)
            buf = p if len(p) <= max_chars else p[:max_chars]
    if buf:
        chunks.append(buf)
    return chunks
