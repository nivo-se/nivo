"""Tests for sourcing filter humanization (A5)."""

from backend.analysis.stage1_filter import FilterCriteria, humanize_filter_criteria


def test_humanize_emptyish():
    c = FilterCriteria()
    out = humanize_filter_criteria(c)
    assert "No specific" in out or "full universe" in out.lower()


def test_humanize_structured():
    c = FilterCriteria(
        min_revenue=50_000_000,
        min_ebitda_margin=0.1,
        min_growth=0.05,
        industries=["62", "70"],
        description="B2B software in the Nordics.",
    )
    out = humanize_filter_criteria(c)
    assert "B2B software" in out
    assert "50.0 MSEK" in out or "MSEK" in out
    assert "10.0%" in out
    assert "5.0%" in out
    assert "62" in out and "70" in out
    assert "Active constraints" in out
