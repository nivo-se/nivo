"""Source quality scoring for evidence ranking."""

from __future__ import annotations

import logging
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

DOMAIN_AUTHORITY_TIERS: dict[str, int] = {
    "company_site": 90,
    "government": 85,
    "trade_association": 80,
    "news_major": 75,
    "industry_report": 70,
    "news_regional": 60,
    "blog": 40,
    "unknown": 50,
}

KNOWN_HIGH_AUTHORITY_DOMAINS = {
    "reuters.com", "bloomberg.com", "ft.com", "wsj.com",
    "di.se", "svd.se", "dn.se", "breakit.se",
    "allabolag.se", "bolagsverket.se", "scb.se",
    "wikipedia.org", "linkedin.com",
}

KNOWN_GOVERNMENT_DOMAINS = {
    "bolagsverket.se", "scb.se", "skatteverket.se",
    "tillvaxtverket.se", "vinnova.se",
}


class SourceQualityScorer:
    """Scores sources on domain authority, recency, content length, and relevance."""

    def score(
        self,
        *,
        url: str,
        content_length: int | None = None,
        company_website: str | None = None,
        source_type: str | None = None,
    ) -> dict:
        """Return a quality assessment dict with overall score and breakdown."""
        domain = self._root_domain(url)

        domain_score = self._score_domain(domain, company_website)
        content_score = self._score_content_length(content_length)

        overall = int(domain_score * 0.6 + content_score * 0.4)

        return {
            "quality_score": overall,
            "domain_score": domain_score,
            "content_score": content_score,
            "domain_tier": self._classify_domain(domain, company_website),
            "domain": domain,
        }

    def _root_domain(self, url: str) -> str:
        try:
            host = urlparse(url).hostname or ""
            parts = host.split(".")
            if len(parts) >= 2:
                return ".".join(parts[-2:])
            return host
        except Exception:
            return ""

    def _classify_domain(self, domain: str, company_website: str | None) -> str:
        if company_website:
            company_domain = self._root_domain(company_website)
            if domain == company_domain:
                return "company_site"
        if domain in KNOWN_GOVERNMENT_DOMAINS:
            return "government"
        if domain in KNOWN_HIGH_AUTHORITY_DOMAINS:
            return "news_major"
        return "unknown"

    def _score_domain(self, domain: str, company_website: str | None) -> int:
        tier = self._classify_domain(domain, company_website)
        return DOMAIN_AUTHORITY_TIERS.get(tier, 50)

    def _score_content_length(self, length: int | None) -> int:
        if length is None or length == 0:
            return 20
        if length < 200:
            return 30
        if length < 1000:
            return 60
        if length < 5000:
            return 80
        return 90
