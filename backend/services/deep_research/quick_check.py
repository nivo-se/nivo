"""Quick check: minimal Tavily-based lookup for company website before full pipeline.

When user provides minimal input (company name or orgnr only), we run 1-2 Tavily
searches to try to find the official website. If found, we update the company and
proceed. If not found, we stop early and return a user-friendly suggestion.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from urllib.parse import urlparse

from backend.services.web_intel.source_normalizer import BLOCKED_DOMAINS
from backend.services.web_intel.tavily_client import TavilyClient

logger = logging.getLogger(__name__)

# Additional domains to skip for quick check (beyond BLOCKED_DOMAINS)
SKIP_DOMAINS_EXTRA = frozenset({
    "wikipedia.org", "facebook.com", "twitter.com", "x.com",
    "crunchbase.com", "bloomberg.com", "reuters.com", "dn.se", "svd.se", "di.se",
})
SKIP_DOMAINS = BLOCKED_DOMAINS | SKIP_DOMAINS_EXTRA


@dataclass(slots=True)
class QuickCheckResult:
    """Result of quick check for company website."""

    found: bool
    website: str | None = None
    suggestion_message: str | None = None
    queries_tried: list[str] = ()
    sources_checked: int = 0


def _extract_domain(url: str) -> str | None:
    """Extract domain from URL, normalized to lowercase."""
    try:
        parsed = urlparse(url if url.startswith("http") else f"https://{url}")
        domain = (parsed.netloc or parsed.path).lower().strip()
        if domain and "." in domain:
            return domain
    except Exception:
        pass
    return None


def _is_likely_official_site(url: str, company_name: str, orgnr: str | None) -> bool:
    """Heuristic: is this URL likely the company's official site?"""
    domain = _extract_domain(url)
    if not domain or domain in SKIP_DOMAINS:
        return False
    # Skip subdomains of known aggregators
    for skip in SKIP_DOMAINS:
        if domain.endswith(f".{skip}"):
            return False
    # Prefer short domains (often company sites)
    parts = domain.replace("www.", "").split(".")
    base = parts[0] if parts else ""
    if len(base) < 3:
        return False
    # Company name tokens (simplified)
    name_tokens = set(re.findall(r"[a-z0-9]+", (company_name or "").lower()))
    if name_tokens and base in name_tokens:
        return True
    # Generic company TLDs
    if domain.endswith((".se", ".com", ".io", ".co", ".net")):
        return True
    return True  # Allow if not in skip list


def run_quick_check(
    *,
    company_name: str | None = None,
    orgnr: str | None = None,
    max_queries: int = 2,
) -> QuickCheckResult:
    """Run 1-2 Tavily searches to find company website.

    Returns QuickCheckResult with found=True and website if found, else
    found=False and suggestion_message for the user.
    """
    client = TavilyClient()
    if not client.api_key:
        return QuickCheckResult(
            found=False,
            suggestion_message=(
                "Web search is not configured. Please provide the company website URL manually "
                "to enable research."
            ),
            queries_tried=[],
            sources_checked=0,
        )

    display_name = company_name or (f"orgnr {orgnr}" if orgnr else "this company")
    queries: list[str] = []

    if company_name:
        queries.append(f'"{company_name}" official website Sweden')
    if orgnr and orgnr and not orgnr.startswith("tmp-"):
        queries.append(f"Swedish company orgnr {orgnr} homepage")
    if not queries:
        return QuickCheckResult(
            found=False,
            suggestion_message=(
                "Please provide either company name or organization number (orgnr) to start research."
            ),
            queries_tried=[],
            sources_checked=0,
        )

    queries = queries[:max_queries]
    candidates: list[tuple[str, str, float]] = []  # (url, title, score)

    for q in queries:
        try:
            results = client.search(q, max_results=5, search_depth="basic")
            for r in results:
                if r.url and r.url.startswith("http"):
                    domain = _extract_domain(r.url)
                    if domain and domain not in SKIP_DOMAINS:
                        score = r.score or 0.5
                        candidates.append((r.url, r.title or "", score))
        except Exception as e:
            logger.warning("Quick check Tavily search failed: %s", e)

    # Dedupe by domain, keep best score
    seen_domains: set[str] = set()
    for url, title, score in sorted(candidates, key=lambda x: -x[2]):
        domain = _extract_domain(url)
        if domain and domain not in seen_domains:
            seen_domains.add(domain)
            if _is_likely_official_site(url, company_name or "", orgnr):
                # Normalize to https
                clean = url.split("?")[0].rstrip("/")
                if not clean.startswith("http"):
                    clean = f"https://{clean}"
                return QuickCheckResult(
                    found=True,
                    website=clean,
                    queries_tried=queries,
                    sources_checked=len(candidates),
                )

    # Not found: build suggestion
    suggestion = _build_suggestion(display_name, orgnr, company_name)
    return QuickCheckResult(
        found=False,
        suggestion_message=suggestion,
        queries_tried=queries,
        sources_checked=len(candidates),
    )


def _build_suggestion(
    display_name: str,
    orgnr: str | None,
    company_name: str | None,
) -> str:
    """Build user-friendly suggestion when quick check finds nothing."""
    parts = [
        f"We couldn't automatically find the official website for {display_name}.",
        "To get the best research results, please add the company website URL.",
    ]
    if orgnr and not orgnr.startswith("tmp-"):
        parts.append(
            f"You can look up the company at allabolag.se or bolagsverket.se using orgnr {orgnr}."
        )
    if company_name:
        parts.append(
            "Try searching for the company name plus 'official site' or 'hemsida' to find the URL."
        )
    return " ".join(parts)
