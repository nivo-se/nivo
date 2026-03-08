"""Source type taxonomy and provenance model for Deep Research."""

from __future__ import annotations

PROPRIETARY_SOURCE_TYPES = frozenset({
    "proprietary_investor_deck",
    "proprietary_cim",
    "proprietary_internal_notes",
    "proprietary_management_input",
    "proprietary_market_hint",
    "proprietary_dd_notes",
})

PUBLIC_SOURCE_TYPES = frozenset({
    "serpapi",
    "tavily",
    "direct",
    "web",
})

INTERNAL_DB_SOURCE_TYPES = frozenset({
    "internal_financials",
    "internal_crm",
})

ALL_VALID_SOURCE_TYPES = PROPRIETARY_SOURCE_TYPES | PUBLIC_SOURCE_TYPES | INTERNAL_DB_SOURCE_TYPES

PROVENANCE_VALUES = frozenset({"public", "proprietary", "internal_db"})


def classify_provenance(source_type: str) -> str:
    """Return provenance label for a given source_type."""
    if source_type in PROPRIETARY_SOURCE_TYPES:
        return "proprietary"
    if source_type in INTERNAL_DB_SOURCE_TYPES:
        return "internal_db"
    return "public"


def is_valid_source_type(source_type: str) -> bool:
    return source_type in ALL_VALID_SOURCE_TYPES
