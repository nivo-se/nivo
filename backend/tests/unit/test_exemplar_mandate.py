"""Tests for loading screening exemplar mandate JSON from the repo."""

from __future__ import annotations

from pathlib import Path

from backend.services.exemplar_mandate import (
    clear_mandate_cache,
    exemplar_mandate_path,
    exemplar_mandate_version,
    load_screening_exemplar_mandate,
)


def test_load_mandate_contains_meta_and_patterns():
    clear_mandate_cache()
    data = load_screening_exemplar_mandate()
    assert isinstance(data, dict)
    assert "common_patterns" in data
    assert isinstance(data.get("common_patterns"), list)
    meta = data.get("_meta")
    assert isinstance(meta, dict)
    assert meta.get("version")


def test_exemplar_mandate_path_exists():
    p = exemplar_mandate_path()
    assert isinstance(p, Path)
    assert p.name == "screening_output.json"


def test_exemplar_mandate_version():
    v = exemplar_mandate_version({"_meta": {"version": "9.9.9"}})
    assert v == "9.9.9"
