"""Source normalization and domain classification for web intelligence."""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlparse

# NEVER use these for company research — aggregators, registries, financial platforms.
# Prefer the company's own website (e.g. texstar.se over krafman.se).
BLOCKED_DOMAINS = frozenset({
    "allabolag.se", "krafman.se", "koll.se", "ratsit.se", "merinfo.se",
    "solidinfo.se", "bolagsverket.se", "verifiera.se", "uc.se",
    "indeed.com", "linkedin.com", "glassdoor.com", "monster.com",
    "arbetsformedlingen.se", "jobb.blocket.se", "careerjet.se",
    "jobbmaskinen.se", "jobbland.se", "stepstone.com", "xing.com",
})

# Domain sets for classification (plan: company_site, news, database, public_authority, industry_report, marketplace, unknown)
KNOWN_PUBLIC_AUTHORITY_DOMAINS = frozenset({
    "bolagsverket.se", "scb.se", "skatteverket.se",
    "tillvaxtverket.se", "vinnova.se", "europa.eu",
})

KNOWN_NEWS_DOMAINS = frozenset({
    "reuters.com", "bloomberg.com", "ft.com", "wsj.com",
    "di.se", "svd.se", "dn.se", "breakit.se", "affarsvarlden.se",
    "wikipedia.org", "linkedin.com",
})

KNOWN_DATABASE_DOMAINS = frozenset({
    "allabolag.se", "ratsit.se", "solidinfo.se",
})

# Industry/trade patterns (partial match)
INDUSTRY_DOMAIN_PATTERNS = ("industry", "trade", "association", "bransch", "forening")

# Marketplace/e-commerce patterns
MARKETPLACE_PATTERNS = ("amazon.", "ebay.", "alibaba.", "marketplace", "shop.", "store.")


@dataclass(slots=True)
class NormalizedSource:
    """Normalized source with domain and classified type."""

    url: str
    domain: str
    source_type: str
    title: str | None = None


def normalize_domain(url: str) -> str:
    """Extract root domain (e.g. example.com) from URL."""
    try:
        host = urlparse(url).hostname or ""
        parts = host.split(".")
        if len(parts) >= 2:
            return ".".join(parts[-2:]).lower()
        return host.lower()
    except Exception:
        return ""


def is_blocked_domain(url: str) -> bool:
    """True if URL is from a blocked domain (aggregators, registries) — never use for research."""
    domain = normalize_domain(url)
    if not domain:
        return False
    return domain in BLOCKED_DOMAINS or any(
        domain == d or domain.endswith(f".{d}") for d in BLOCKED_DOMAINS
    )


def classify_source_type(url: str, company_website: str | None = None) -> str:
    """Classify source type: company_site, news, database, public_authority, industry_report, marketplace, unknown."""
    domain = normalize_domain(url)
    if not domain:
        return "unknown"

    if company_website:
        company_domain = normalize_domain(company_website)
        if company_domain and domain == company_domain:
            return "company_site"

    if domain in KNOWN_PUBLIC_AUTHORITY_DOMAINS:
        return "public_authority"
    if domain in KNOWN_NEWS_DOMAINS:
        return "news"
    if domain in KNOWN_DATABASE_DOMAINS:
        return "database"

    domain_lower = domain.lower()
    for pat in INDUSTRY_DOMAIN_PATTERNS:
        if pat in domain_lower:
            return "industry_report"
    for pat in MARKETPLACE_PATTERNS:
        if pat in domain_lower:
            return "marketplace"

    return "unknown"


def normalize_source(
    url: str,
    title: str | None = None,
    company_website: str | None = None,
) -> NormalizedSource:
    """Return NormalizedSource for a URL."""
    domain = normalize_domain(url)
    source_type = classify_source_type(url, company_website)
    return NormalizedSource(url=url, domain=domain, source_type=source_type, title=title)
