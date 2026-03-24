"""Tests for validate_proposed_filters (Phase B)."""

import os
import sys


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")))

from backend.api.universe import validate_proposed_filters  # noqa: E402


def test_unknown_field_reported():
    out = validate_proposed_filters(
        [
            {"field": "revenue_latest", "op": ">=", "value": 1e7, "type": "number"},
            {"field": "not_a_real_field", "op": ">=", "value": 1, "type": "number"},
        ]
    )
    assert len(out["filters"]) == 1
    assert out["filters"][0]["field"] == "revenue_latest"
    assert any(e.get("field") == "not_a_real_field" for e in out["errors"])


def test_nace_excludes_prefixes():
    out = validate_proposed_filters(
        [
            {
                "field": "nace_codes",
                "op": "excludes_prefixes",
                "value": ["49", "64"],
                "type": "nace",
            }
        ]
    )
    assert len(out["filters"]) == 1
    assert out["errors"] == []
