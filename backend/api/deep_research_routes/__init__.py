"""Deep Research router modules."""

from .analysis import router as analysis_router
from .companies import router as companies_router
from .competitors import router as competitors_router
from .recompute import router as recompute_router
from .reports import router as reports_router
from .sources import router as sources_router
from .verification import router as verification_router

__all__ = [
    "analysis_router",
    "companies_router",
    "reports_router",
    "competitors_router",
    "verification_router",
    "sources_router",
    "recompute_router",
]

