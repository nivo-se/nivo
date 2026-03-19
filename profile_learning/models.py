"""
Constants and allowed values for profile-learning validation and config mapping.

Source: docs/deep_research/profile_learning/MVP_FILE_SCHEMAS_AND_TEMPLATES.md
"""

# Variable source fields accepted by Layer 1 profile-weighted score (Universe row fields)
ALLOWED_VARIABLE_SOURCES = frozenset({
    "revenue_latest",
    "ebitda_margin_latest",
    "revenue_cagr_3y",
    "employees_latest",
    "data_quality_score",
    "fit_score",
    "ops_upside_score",
    "nivo_total_score",
    "research_feasibility_score",
})

# Normalize methods for variables
ALLOWED_NORMALIZE = frozenset({"min_max", "linear"})

# Exclusion rule: allowed field names (must match backend _EXCLUSION_FIELD_TYPES)
ALLOWED_EXCLUSION_FIELDS = frozenset({
    "revenue_latest",
    "ebitda_margin_latest",
    "revenue_cagr_3y",
    "employees_latest",
    "data_quality_score",
    "fit_score",
    "ops_upside_score",
    "nivo_total_score",
    "research_feasibility_score",
})

# Exclusion rule: allowed operators
ALLOWED_EXCLUSION_OPS = frozenset({"=", ">=", "<=", "between"})

# Fields treated as percent (ratio, e.g. 0.05 not 5)
EXCLUSION_PERCENT_FIELDS = frozenset({"ebitda_margin_latest", "revenue_cagr_3y"})

# Archetype criteria: allowed field names (numeric + segment_tier, name for string comparison)
ALLOWED_ARCHETYPE_CRITERIA_FIELDS = frozenset({
    "revenue_latest",
    "ebitda_margin_latest",
    "revenue_cagr_3y",
    "employees_latest",
    "data_quality_score",
    "fit_score",
    "ops_upside_score",
    "nivo_total_score",
    "research_feasibility_score",
    "segment_tier",
    "name",
})

# String comparison fields (only eq, gte, lte valid)
ARCHETYPE_STRING_CRITERIA_FIELDS = frozenset({"segment_tier", "name"})

# Valid user labels in manifest and extraction
VALID_USER_LABELS = frozenset({"strong", "maybe", "weak", "reject"})
