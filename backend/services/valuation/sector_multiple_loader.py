"""Load sector EV/EBITDA sanity ranges from sector_multiple_reference table."""

from __future__ import annotations

import logging
from dataclasses import dataclass

from sqlalchemy import text

logger = logging.getLogger(__name__)

# Fallback when DB unavailable or sector not found (VALUATION_INTELLIGENCE_SPEC)
DEFAULT_EV_EBITDA_LOW = 4.1
DEFAULT_EV_EBITDA_HIGH = 8.0

# Sector name normalization: map common industry labels to sector_multiple_reference.sector
SECTOR_ALIASES: dict[str, str] = {
    "industrial": "Industrial",
    "industri": "Industrial",
    "manufacturing": "Industrial",
    "consumer": "Consumer",
    "konsument": "Consumer",
    "furniture": "Furniture/design",
    "design": "Furniture/design",
    "möbler": "Furniture/design",
    "saas": "SaaS",
    "software": "SaaS",
    "tech": "SaaS",
    "services": "Services",
    "tjänster": "Services",
    "consulting": "Services",
}


@dataclass(slots=True)
class SectorRange:
    sector: str
    ev_ebitda_low: float
    ev_ebitda_high: float


def _normalize_sector(industry: str | None) -> str | None:
    """Map industry string to sector_multiple_reference.sector."""
    if not industry or not industry.strip():
        return None
    lower = industry.strip().lower()
    for alias, sector in SECTOR_ALIASES.items():
        if alias in lower:
            return sector
    if lower in ("industrial", "consumer", "furniture/design", "saas", "services", "general"):
        return lower.title().replace("/", "/")
    return industry.strip()


def load_sector_range(session, industry: str | None) -> SectorRange:
    """
    Load EV/EBITDA range for sector from sector_multiple_reference.
    Falls back to General or defaults if not found.
    """
    sector = _normalize_sector(industry) or "General"
    try:
        row = session.execute(
            text(
                "SELECT sector, ev_ebitda_low, ev_ebitda_high "
                "FROM public.sector_multiple_reference WHERE sector = :sector LIMIT 1"
            ),
            {"sector": sector},
        ).fetchone()
        if row:
            return SectorRange(
                sector=str(row[0]),
                ev_ebitda_low=float(row[1]),
                ev_ebitda_high=float(row[2]),
            )
        row = session.execute(
            text(
                "SELECT sector, ev_ebitda_low, ev_ebitda_high "
                "FROM public.sector_multiple_reference WHERE sector = 'General' LIMIT 1"
            )
        ).fetchone()
        if row:
            return SectorRange(
                sector=str(row[0]),
                ev_ebitda_low=float(row[1]),
                ev_ebitda_high=float(row[2]),
            )
    except Exception as e:
        logger.warning("sector_multiple_reference lookup failed: %s", e)
    return SectorRange(
        sector="General",
        ev_ebitda_low=DEFAULT_EV_EBITDA_LOW,
        ev_ebitda_high=DEFAULT_EV_EBITDA_HIGH,
    )
