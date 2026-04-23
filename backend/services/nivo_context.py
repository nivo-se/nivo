"""Load versioned Nivo thesis context for LLM system prompts (Track A)."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional


@dataclass(frozen=True)
class NivoContext:
    version: str
    last_reviewed: str
    summary_for_llm: str
    canonical_doc: str
    raw: dict[str, Any]


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def load_nivo_context() -> NivoContext:
    """Load `backend/config/nivo_context.json`. Env NIVO_CONTEXT_PATH overrides path."""
    override = (os.environ.get("NIVO_CONTEXT_PATH") or "").strip()
    path = Path(override) if override else _repo_root() / "backend" / "config" / "nivo_context.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    return NivoContext(
        version=str(data.get("version", "unknown")),
        last_reviewed=str(data.get("last_reviewed", "")),
        summary_for_llm=str(data.get("summary_for_llm", "")).strip(),
        canonical_doc=str(data.get("canonical_doc", "")),
        raw=dict(data),
    )


def thesis_block_for_llm(ctx: Optional[NivoContext] = None) -> str:
    """Short block appended to system prompts for sourcing / analysis chat."""
    c = ctx or load_nivo_context()
    return (
        "## Nivo investment context (v"
        + c.version
        + ")\n"
        + c.summary_for_llm
        + "\n\nWhen suggesting filters, stay consistent with this mandate. Do not claim fake precision on fit."
    )
