"""Tests for exemplar manifest loading and markdown chunking."""

from __future__ import annotations

from pathlib import Path

from backend.services.exemplar_chunking import chunk_exemplar_markdown
from backend.services.exemplar_manifest import (
    clear_exemplar_reports_manifest_cache,
    exemplar_manifest_version,
    list_manifest_reports,
    load_exemplar_reports_manifest,
    stable_chunk_id,
)


def test_stable_chunk_id_format():
    assert stable_chunk_id("1.0.0", "Fladen", 3) == "exemplar:1.0.0:Fladen:3"


def test_chunk_exemplar_markdown_splits_paragraphs():
    text = "A\n\nB\n\nC"
    chunks = chunk_exemplar_markdown(text, max_chars=10)
    assert len(chunks) >= 1
    assert "A" in chunks[0]


def test_load_manifest_reports_repo():
    clear_exemplar_reports_manifest_cache()
    data = load_exemplar_reports_manifest()
    assert isinstance(data, dict)
    v = exemplar_manifest_version(data)
    assert v is not None or data == {}
    reports = list_manifest_reports()
    if reports:
        assert "slug" in reports[0]
        assert "file" in reports[0]
        p = Path(__file__).resolve().parents[3] / "docs" / "deep_research" / "screening_exemplars" / reports[0]["file"]
        assert p.is_file(), f"Manifest file missing: {p}"
