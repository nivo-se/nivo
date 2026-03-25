"""Unit tests for GPT-about Layer2 runner helpers (scripts/screening_layer2_from_gpt_about_json.py)."""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT = REPO_ROOT / "scripts" / "screening_layer2_from_gpt_about_json.py"


@pytest.fixture(scope="module")
def mod():
    spec = importlib.util.spec_from_file_location("screening_layer2_from_gpt_about_json", SCRIPT)
    assert spec and spec.loader
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)  # type: ignore[union-attr]
    return m


def test_evidence_from_gpt_about_item(mod):
    s = mod.evidence_from_gpt_about_item(
        {
            "about_source_url": "https://example.com/about",
            "about_text": "We make widgets.",
            "source_note": "from search",
        }
    )
    assert "GPT_ABOUT" in s
    assert "https://example.com/about" in s
    assert "We make widgets." in s
    assert "SOURCE_NOTE: from search" in s


def test_layer2_batch_response_schema(mod):
    sch = mod.layer2_batch_response_schema()
    assert sch.get("type") == "object"
    assert sch.get("required") == ["items"]
    props = sch.get("properties") or {}
    assert "items" in props
    assert props["items"].get("type") == "array"
