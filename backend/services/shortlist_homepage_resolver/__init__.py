"""Input-only homepage verification and bounded Tavily resolution for Stage 1 shortlists."""

from .resolver import (
    DEFAULT_MAJOR_NAME_KEYWORDS,
    DEFAULT_MAJOR_ORGNR_DENYLIST,
    ResolutionOutcome,
    homepage_domain_is_blocklisted,
    resolve_shortlist_rows,
)

__all__ = [
    "DEFAULT_MAJOR_NAME_KEYWORDS",
    "DEFAULT_MAJOR_ORGNR_DENYLIST",
    "ResolutionOutcome",
    "homepage_domain_is_blocklisted",
    "resolve_shortlist_rows",
]
