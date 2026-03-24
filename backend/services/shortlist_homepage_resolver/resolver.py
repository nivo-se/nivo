"""
Resolve and verify official homepages for rows already present in a shortlist CSV.

- No company discovery: only input rows.
- Tavily: single tight query per row when needed; small candidate set.
"""

from __future__ import annotations

import logging
import os
import re
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Literal, MutableMapping, Optional, Sequence, Tuple
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT = 12.0
USER_AGENT = "NivoShortlistHomepageResolver/1.0 (+https://nivogroup.se)"
# Stricter than v1: prefer unresolved over weak third-party / directory matches.
VERIFY_SCORE_MIN = 0.42
TAVILY_SCORE_MIN = 0.40
MAX_TAVILY_CANDIDATES_TO_FETCH = 5

HomepageStatus = Literal[
    "manual_curated",
    "verified_existing",
    "resolved_tavily",
    "unresolved",
    "rejected_mismatch",
    "dead_original",
]
ResolutionMethod = Literal["manual_csv", "existing_verified", "tavily_resolved", "none"]

ExclusionReason = Literal[
    "excluded_out_of_scope_major_company",
    "excluded_global_group",
    "excluded_manual_denylist",
]

# Major listed / global industrials — exclude from Layer 2 prep runs (orgnr digits only).
DEFAULT_MAJOR_ORGNR_DENYLIST: frozenset[str] = frozenset(
    {
        "5560197460",  # Sandvik AB
        "5560069463",  # Alfa Laval Corporate AB
        "5560000841",  # Atlas Copco AB
        "5560003468",  # Volvo AB
        "5560296968",  # Getinge AB
        "5560168616",  # Elekta AB
        "5567370431",  # SCA
    }
)

# Substring match on normalized legal name (conservative phrases).
DEFAULT_MAJOR_NAME_KEYWORDS: Tuple[str, ...] = (
    "sandvik ab",
    "alfa laval",
    "atlas copco",
    "volvo ab",
    "getinge ab",
    "elekta ab",
    "sca hygiene",
    "sca forest products",
    "ssab ab",
    "ericsson",
    "astrazeneca",
    "nordea bank",
)

# Never use as homepage_resolved: directories, aggregators, social profiles, registries, news/investor sites.
_BLOCKED_CANDIDATE_HOST_SUBSTR: Tuple[str, ...] = (
    "northdata.com",
    "merit500.com",
    "reco.se",
    "infoisinfo",
    "inderes",
    "rocketreach.co",
    "linkedin.com",
    "facebook.com",
    "instagram.com",
    "wikipedia.org",
    "wikimedia.org",
    "bloomberg.com",
    "reuters.com",
    "kompass.com",
    "allabolag.se",
    "hitta.se",
    "ratsit.se",
    "bolagsfakta",
    "syna.se",
    "proff.se",
    "amazon.",
    "ebay.",
    "tradera.",
    "blocket.",
    "indeed.com",
    "glassdoor.",
    "crunchbase.com",
    "pitchbook.com",
    "twitter.com",
    "x.com",
    "google.",
    "youtube.com",
    "apple.com/app",
    "news.",
    "medium.com",
    "reddit.com",
    "trustpilot.",
    "g2.com",
    "capterra.com",
    "zoominfo.",
    "apollo.io",
    "seamless.ai",
    "dealroom.co",
    "funderbeam.com",
    "nasdaq.com",
    "nyse.com",
    "marketscreener.com",
    "finance.yahoo",
    "ft.com",
    "cnbc.com",
    "morningstar.com",
    "simplywall.st",
    "dnb.com",
    "bisnode",
    "creditsafe",
    "uc.se",
    "solidinfo",
    "merinfo.se",
    "kreditrapporten",
    "bygghandel.se",
    "prnewswire.com",
    "businesswire.com",
)

_STOP_TOKENS = frozenset(
    {
        "ab",
        "aktiebolag",
        "bolag",
        "the",
        "inc",
        "corp",
        "corporation",
        "ltd",
        "limited",
        "group",
        "holding",
        "sverige",
        "sweden",
    }
)


@dataclass
class ResolutionOutcome:
    homepage_original: str
    homepage_resolved: str
    status: HomepageStatus
    method: ResolutionMethod
    confidence: float
    notes: str


def _norm_orgnr(raw: str) -> str:
    return re.sub(r"\D", "", (raw or "").strip())


def _bump(d: Optional[MutableMapping[str, int]], key: str, n: int = 1) -> None:
    if d is None:
        return
    d[key] = d.get(key, 0) + n


def collect_tavily_startup_diagnostics() -> Dict[str, Any]:
    """
    One-shot probe for logging / summary: import, env, and effective API key (env or settings).
    """
    out: Dict[str, Any] = {
        "tavily_import_ok": False,
        "tavily_import_error": None,
        "tavily_api_key_env_present": bool((os.getenv("TAVILY_API_KEY") or "").strip()),
        "tavily_api_key_configured": False,
        "tavily_available": False,
    }
    try:
        from backend.services.web_intel.tavily_client import TavilyClient  # noqa: F401
    except ImportError as e:
        out["tavily_import_error"] = str(e)
        return out
    out["tavily_import_ok"] = True
    tv = _tavily_client()
    configured = bool(tv and getattr(tv, "api_key", None))
    out["tavily_api_key_configured"] = configured
    out["tavily_available"] = configured
    return out


def _normalize_url(raw: Optional[str]) -> Optional[str]:
    s = (raw or "").strip()
    if not s:
        return None
    if not s.startswith(("http://", "https://")):
        s = "https://" + s
    p = urlparse(s)
    if not p.netloc:
        return None
    return s


def row_needs_homepage_tavily_lookup(row: Dict[str, Any]) -> bool:
    """True when there is no usable homepage URL in the row (Tavily or verify path required)."""
    hp = row.get("homepage")
    if hp is not None and not isinstance(hp, str):
        hp = str(hp)
    return _normalize_url(hp) is None


def _name_tokens(company_name: str) -> List[str]:
    parts = re.split(r"[^\wåäöÅÄÖ]+", company_name, flags=re.I)
    return [
        p.lower()
        for p in parts
        if len(p) >= 3 and p.lower() not in _STOP_TOKENS
    ]


def _domain_slug(host: str) -> str:
    h = host.lower().split("@")[-1].split(":")[0]
    if h.startswith("www."):
        h = h[4:]
    base = h.split(".")[0] if h else ""
    return re.sub(r"[^a-z0-9åäö]", "", base)


def _strip_html_to_text(html: str, max_chars: int) -> Tuple[str, str]:
    title = ""
    try:
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "html.parser")
        t = soup.find("title")
        if t:
            title = t.get_text(separator=" ", strip=True)
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        text = soup.get_text(separator="\n", strip=True)
    except Exception:
        text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > max_chars:
        text = text[:max_chars] + "…"
    return title[:300], text


def _blocked_host(host: str) -> bool:
    """Aggregator / profile / directory hosts — never accept as official company homepage."""
    h = (host or "").lower()
    if h == "av.se" or h.endswith(".av.se"):
        return True
    return any(b in h for b in _BLOCKED_CANDIDATE_HOST_SUBSTR)


def homepage_domain_is_blocklisted(host: str) -> bool:
    """Public alias for pipeline QA (same rule as Tavily / resolver)."""
    return _blocked_host(host)


def _url_path_segment_count(path: str) -> int:
    return len([s for s in (path or "").split("/") if s])


def _url_hard_registry_directory(url: str) -> bool:
    """
    Third-party registry / listing URL shapes (not first-party corporate subpages).
    First-party /about, /investors etc. are handled by root upgrade, not listed here.
    """
    low = url.lower()
    if "orgnr=" in low:
        return True
    path = (urlparse(url).path or "").lower()
    if "/company/" in path or "/companies/" in path:
        return True
    if "/profile" in path or "/profiles/" in path:
        return True
    if "/detail" in path or "/details/" in path:
        return True
    if "/listing" in path or "/listings/" in path:
        return True
    if re.search(r"/review(?:/|$)", path) or "/reviews/" in path:
        if "preview" not in path:
            return True
    return False


def _domain_plausible_for_company(host: str, company_name: str) -> bool:
    """Require a brand/name token to appear in the registrable host (anti third-party)."""
    h = (host or "").lower().split("@")[0].split(":")[0]
    if not h:
        return False
    slug = re.sub(r"[^a-z0-9åäö]", "", h)
    tokens = [t for t in _name_tokens(company_name) if len(t) >= 4]
    if not tokens:
        tokens = _name_tokens(company_name)
    for t in tokens:
        if len(t) >= 4 and t in slug:
            return True
    for t in tokens:
        if len(t) == 3 and t in slug:
            return True
    return False


def _verify_page_match(
    company_name: str,
    orgnr: str,
    url: str,
    html: Optional[str],
) -> Tuple[float, str]:
    """Return (score 0..1, note)."""
    if not html:
        return 0.0, "no_html"
    title, body = _strip_html_to_text(html, 10_000)
    blob = f"{title} {body}".lower()
    tokens = _name_tokens(company_name)
    if not tokens:
        return 0.15, "no_name_tokens"
    hits = sum(1 for t in tokens if t in blob)
    token_score = min(1.0, hits / max(len(tokens), 1))
    org_digits = _norm_orgnr(orgnr)
    org_bonus = 0.15 if org_digits and org_digits in blob.replace(" ", "") else 0.0
    p = urlparse(url)
    host_slug = _domain_slug(p.netloc)
    dom_bonus = 0.0
    for t in tokens:
        if len(t) >= 4 and t in host_slug:
            dom_bonus = 0.2
            break
    score = min(1.0, token_score * 0.75 + org_bonus + dom_bonus)
    note = f"tokens_hit={hits}/{len(tokens)} title_len={len(title)}"
    return score, note


def _accept_homepage_candidate(
    client: httpx.Client,
    company_name: str,
    orgnr: str,
    final_url: str,
    html: Optional[str],
    min_score: float,
    diag: Optional[MutableMapping[str, int]],
) -> Optional[Tuple[str, float, str]]:
    """
    Enforce first-party + content match. Non-root URLs only count if the site root
    verifies; deep paths are never returned as homepage_resolved.
    """
    if not html:
        return None
    netloc = urlparse(final_url).netloc.lower()
    if _blocked_host(netloc):
        _bump(diag, "rejected_directory_candidates")
        return None
    if _url_hard_registry_directory(final_url):
        _bump(diag, "rejected_directory_candidates")
        return None
    if not _domain_plausible_for_company(netloc, company_name):
        _bump(diag, "rejected_directory_candidates")
        return None
    score, note = _verify_page_match(company_name, orgnr, final_url, html)
    if score < min_score:
        return None

    path = urlparse(final_url).path or ""
    if _url_path_segment_count(path) == 0:
        norm = final_url.split("#")[0].rstrip("/")
        return (norm, score, note)

    scheme = urlparse(final_url).scheme or "https"
    root = f"{scheme}://{netloc}/"
    html_r, err_r, final_r = _fetch_html(client, root)
    if not html_r or err_r:
        _bump(diag, "rejected_directory_candidates")
        return None
    nl = urlparse(final_r).netloc.lower()
    if _blocked_host(nl) or _url_hard_registry_directory(final_r):
        _bump(diag, "rejected_directory_candidates")
        return None
    if not _domain_plausible_for_company(nl, company_name):
        _bump(diag, "rejected_directory_candidates")
        return None
    score_r, note_r = _verify_page_match(company_name, orgnr, final_r, html_r)
    if score_r < min_score:
        _bump(diag, "rejected_directory_candidates")
        return None
    norm = final_r.split("#")[0].rstrip("/")
    return (norm, score_r, f"root_upgrade {note_r}")


def _se_fallback_urls_from_netloc(netloc: str) -> List[str]:
    """
    If the CSV has a simple international .com host, try the same label on .se
    (common for Swedish SMEs: wrong TLD in source data). Only single-label + .com.
    """
    h = (netloc or "").lower().split("@")[-1].split(":")[0]
    if not re.match(r"^(www\.)?[\w-]+\.com$", h):
        return []
    stem = h[4:-4] if h.startswith("www.") else h[:-4]
    if not stem or stem.endswith("."):
        return []
    return [f"https://{stem}.se/", f"https://www.{stem}.se/"]


def _probe_verified_homepage(
    client: httpx.Client,
    company_name: str,
    orgnr: str,
    urls: Sequence[str],
    homepage_original: str,
    notes_prefix: str,
    diag: Optional[MutableMapping[str, int]] = None,
) -> Optional[ResolutionOutcome]:
    for u in urls:
        html, err, final = _fetch_html(client, u)
        if not html or err:
            continue
        acc = _accept_homepage_candidate(client, company_name, orgnr, final, html, VERIFY_SCORE_MIN, diag)
        if acc:
            return ResolutionOutcome(
                homepage_original=homepage_original,
                homepage_resolved=acc[0],
                status="verified_existing",
                method="existing_verified",
                confidence=round(acc[1], 3),
                notes=f"{notes_prefix}: {acc[2]}",
            )
    return None


def _fetch_html(client: httpx.Client, url: str) -> Tuple[Optional[str], Optional[str], str]:
    try:
        r = client.get(url, follow_redirects=True)
        final = str(r.url)
        if r.status_code >= 400:
            return None, f"HTTP {r.status_code}", final
        ctype = (r.headers.get("content-type") or "").lower()
        if "html" not in ctype and "text" not in ctype:
            return None, "non-html", final
        return r.text, None, final
    except Exception as e:
        return None, str(e)[:200], url


def _tavily_client():
    try:
        from backend.services.web_intel.tavily_client import TavilyClient
    except ImportError:
        return None
    key = (os.getenv("TAVILY_API_KEY") or "").strip() or None
    return TavilyClient(api_key=key)


def _tavily_search(
    company_name: str,
    orgnr: str,
    *,
    diag: Optional[MutableMapping[str, int]] = None,
    row_key: Optional[str] = None,
) -> list:
    _bump(diag, "tavily_search_calls")
    if diag is not None and row_key is not None:
        lk = "_tavily_last_row_key"
        if diag.get(lk) != row_key:
            diag[lk] = row_key
            _bump(diag, "tavily_attempted_rows")
    tv = _tavily_client()
    if not tv or not tv.api_key:
        _bump(diag, "tavily_search_skipped_no_client_or_key")
        return []
    q = f'"{company_name}" Sweden organisationsnummer {orgnr} official website'
    results = tv.search(q, max_results=5, search_depth="basic")
    if results:
        _bump(diag, "tavily_search_calls_with_results")
    _bump(diag, "tavily_result_items_returned", len(results))
    return results


def classify_exclusion(
    orgnr: str,
    company_name: str,
    row: Dict[str, Any],
    *,
    manual_orgnrs: frozenset[str],
    name_keywords: Sequence[str],
    min_revenue_column: Optional[str],
    min_revenue_threshold: Optional[float],
) -> Optional[ExclusionReason]:
    o = _norm_orgnr(orgnr)
    if o in manual_orgnrs:
        return "excluded_manual_denylist"
    low = (company_name or "").lower().strip()
    for kw in name_keywords:
        if kw and kw.lower() in low:
            return "excluded_global_group"
    if min_revenue_column and min_revenue_threshold is not None:
        raw = row.get(min_revenue_column)
        if raw is not None and str(raw).strip() != "":
            try:
                v = float(str(raw).replace(",", "."))
                if v >= min_revenue_threshold:
                    return "excluded_out_of_scope_major_company"
            except ValueError:
                pass
    return None


def resolve_row_homepage(
    orgnr: str,
    company_name: str,
    homepage_input: Optional[str],
    client: httpx.Client,
    *,
    diag: Optional[MutableMapping[str, int]] = None,
) -> ResolutionOutcome:
    original_raw = (homepage_input or "").strip()
    homepage_original = original_raw
    # Shortlist CSV: non-empty `homepage` cell is treated as manually curated; never overwritten.
    if original_raw:
        url_manual = _normalize_url(homepage_input)
        if url_manual:
            return ResolutionOutcome(
                homepage_original=homepage_original,
                homepage_resolved=url_manual.split("#")[0].rstrip("/"),
                status="manual_curated",
                method="manual_csv",
                confidence=1.0,
                notes="manual_curated_from_shortlist_csv",
            )

    url0 = _normalize_url(homepage_input)

    # --- Existing URL path ---
    if url0:
        html, err, final = _fetch_html(client, url0)
        if html and not err:
            acc = _accept_homepage_candidate(client, company_name, orgnr, final, html, VERIFY_SCORE_MIN, diag)
            if acc:
                return ResolutionOutcome(
                    homepage_original=homepage_original,
                    homepage_resolved=acc[0],
                    status="verified_existing",
                    method="existing_verified",
                    confidence=round(acc[1], 3),
                    notes=f"verified_existing: {acc[2]}",
                )
            # Wrong TLD in source (e.g. fladenfishing.com vs fladenfishing.se)
            se_try = _se_fallback_urls_from_netloc(urlparse(url0).netloc)
            probed = _probe_verified_homepage(
                client,
                company_name,
                orgnr,
                se_try,
                homepage_original,
                "se_tld_fallback_after_mismatch",
                diag=diag,
            )
            if probed:
                return probed
            # Mismatch: try Tavily
            results = _tavily_search(company_name, orgnr, diag=diag, row_key=orgnr)
            best = _pick_and_verify_tavily_candidates(
                client, company_name, orgnr, results, skip_url=final, diag=diag
            )
            if best:
                return ResolutionOutcome(
                    homepage_original=homepage_original,
                    homepage_resolved=best[0],
                    status="resolved_tavily",
                    method="tavily_resolved",
                    confidence=round(best[1], 3),
                    notes=f"after_mismatch: {best[2]}",
                )
            return ResolutionOutcome(
                homepage_original=homepage_original,
                homepage_resolved="",
                status="rejected_mismatch",
                method="none",
                confidence=0.0,
                notes="mismatch_no_tavily_candidate",
            )
        # Dead fetch: try .se sibling of a simple *.com before Tavily
        se_try = _se_fallback_urls_from_netloc(urlparse(url0).netloc)
        probed = _probe_verified_homepage(
            client,
            company_name,
            orgnr,
            se_try,
            homepage_original,
            "se_tld_fallback_after_dead_com",
            diag=diag,
        )
        if probed:
            return probed
        results = _tavily_search(company_name, orgnr, diag=diag, row_key=orgnr)
        best = _pick_and_verify_tavily_candidates(client, company_name, orgnr, results, skip_url=None, diag=diag)
        if best:
            return ResolutionOutcome(
                homepage_original=homepage_original,
                homepage_resolved=best[0],
                status="resolved_tavily",
                method="tavily_resolved",
                confidence=round(best[1], 3),
                notes=f"after_dead_original: {best[2]}",
            )
        return ResolutionOutcome(
            homepage_original=homepage_original,
            homepage_resolved="",
            status="dead_original",
            method="none",
            confidence=0.0,
            notes=f"dead_original: {err or 'unknown'}",
        )

    # --- No original URL ---
    _bump(diag, "rows_entered_no_input_url_branch")
    results = _tavily_search(company_name, orgnr, diag=diag, row_key=orgnr)
    best = _pick_and_verify_tavily_candidates(client, company_name, orgnr, results, skip_url=None, diag=diag)
    if best:
        return ResolutionOutcome(
            homepage_original=homepage_original,
            homepage_resolved=best[0],
            status="resolved_tavily",
            method="tavily_resolved",
            confidence=round(best[1], 3),
            notes=best[2],
        )
    return ResolutionOutcome(
        homepage_original=homepage_original,
        homepage_resolved="",
        status="unresolved",
        method="none",
        confidence=0.0,
        notes="no_input_url_and_no_tavily_candidate",
    )


def _pick_and_verify_tavily_candidates(
    client: httpx.Client,
    company_name: str,
    orgnr: str,
    results: list,
    *,
    skip_url: Optional[str],
    diag: Optional[MutableMapping[str, int]] = None,
) -> Optional[Tuple[str, float, str]]:
    if not results:
        _bump(diag, "tavily_pick_with_empty_results")
        return None
    skip_norm = skip_url.split("#")[0].rstrip("/").lower() if skip_url else ""
    best: Optional[Tuple[str, float, str]] = None
    checked = 0
    for r in results:
        if checked >= MAX_TAVILY_CANDIDATES_TO_FETCH:
            break
        u = (getattr(r, "url", None) or "").strip()
        if not u.startswith("http"):
            continue
        p = urlparse(u)
        if _blocked_host(p.netloc):
            _bump(diag, "rejected_directory_candidates")
            continue
        if _url_hard_registry_directory(u):
            _bump(diag, "rejected_directory_candidates")
            continue
        nu = u.split("#")[0].rstrip("/")
        if skip_norm and nu.lower() == skip_norm:
            continue
        html, err, final = _fetch_html(client, u)
        checked += 1
        _bump(diag, "tavily_candidate_http_fetches")
        if not html or err:
            continue
        acc = _accept_homepage_candidate(client, company_name, orgnr, final, html, TAVILY_SCORE_MIN, diag)
        if acc:
            url, score, note = acc
            _bump(diag, "tavily_candidates_passed_verify")
            logger.debug("tavily_candidate ok url=%s score=%s %s", url, score, note)
            if best is None or score > best[1]:
                best = (url, score, f"tavily_verified score={score:.2f} {note}")
    if not best:
        _bump(diag, "tavily_pick_no_candidate_passed_verify")
        return None
    return best[0], best[1], best[2]


def resolve_shortlist_rows(
    rows: List[Dict[str, Any]],
    *,
    manual_orgnrs: frozenset[str],
    name_keywords: Sequence[str],
    min_revenue_column: Optional[str] = None,
    min_revenue_threshold: Optional[float] = None,
    pause_seconds: float = 0.0,
    tavily_startup: Optional[Dict[str, Any]] = None,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, Any]]:
    """
    Process only the given rows. Returns (resolved_rows, excluded_rows, stats).

    Each resolved row: original keys + resolution columns + `homepage` set to homepage_resolved for Layer 2.
    Each excluded row: original keys + exclusion_reason.

    ``stats`` includes homepage_status_counts, Tavily call counters, and ``tavily_startup`` diagnostics.
    """
    resolved: List[Dict[str, Any]] = []
    excluded: List[Dict[str, Any]] = []
    tavily_diag: MutableMapping[str, int] = {}
    startup = tavily_startup if tavily_startup is not None else collect_tavily_startup_diagnostics()
    stats: Dict[str, Any] = {
        "manual_curated": 0,
        "verified_existing": 0,
        "resolved_tavily": 0,
        "unresolved": 0,
        "rejected_mismatch": 0,
        "dead_original": 0,
        "excluded": 0,
    }

    with httpx.Client(
        timeout=REQUEST_TIMEOUT,
        headers={"User-Agent": USER_AGENT},
        limits=httpx.Limits(max_connections=5),
    ) as client:
        for row in rows:
            orgnr = str(row.get("orgnr", "")).strip()
            name = str(row.get("company_name", "")).strip()
            if not orgnr or not name:
                ex = {**row, "exclusion_reason": "excluded_manual_denylist"}
                excluded.append(ex)
                stats["excluded"] += 1
                continue

            reason = classify_exclusion(
                orgnr,
                name,
                row,
                manual_orgnrs=manual_orgnrs,
                name_keywords=name_keywords,
                min_revenue_column=min_revenue_column,
                min_revenue_threshold=min_revenue_threshold,
            )
            if reason:
                excluded.append({**row, "exclusion_reason": reason})
                stats["excluded"] += 1
                continue

            if row_needs_homepage_tavily_lookup(row):
                _bump(tavily_diag, "eligible_rows_without_homepage_url")
            else:
                _bump(tavily_diag, "eligible_rows_with_homepage_url")

            hp_in = row.get("homepage")
            if hp_in is not None and not isinstance(hp_in, str):
                hp_in = str(hp_in)
            out = resolve_row_homepage(orgnr, name, hp_in, client, diag=tavily_diag)
            if out.status in stats:
                stats[out.status] += 1
            logger.info(
                "Homepage row orgnr=%s status=%s method=%s resolved=%s",
                orgnr,
                out.status,
                out.method,
                (out.homepage_resolved or "")[:70],
            )

            new_row = dict(row)
            new_row["homepage_original"] = out.homepage_original
            new_row["homepage_resolved"] = out.homepage_resolved
            new_row["homepage_status"] = out.status
            new_row["homepage_resolution_method"] = out.method
            new_row["homepage_resolution_confidence"] = out.confidence
            new_row["homepage_resolution_notes"] = out.notes
            # Drop-in for Layer 2
            new_row["homepage"] = out.homepage_resolved
            resolved.append(new_row)
            if pause_seconds > 0:
                time.sleep(pause_seconds)

    tavily_diag.pop("_tavily_last_row_key", None)
    stats["tavily_startup"] = startup
    stats["tavily_runtime_counts"] = dict(tavily_diag)
    stats["rejected_directory_candidates"] = int(tavily_diag.get("rejected_directory_candidates", 0))
    stats["accepted_first_party_domains"] = (
        int(stats["manual_curated"])
        + int(stats["verified_existing"])
        + int(stats["resolved_tavily"])
    )
    stats["unresolved_rows"] = int(stats["unresolved"])
    stats["tavily_attempted_rows"] = int(tavily_diag.get("tavily_attempted_rows", 0))
    return resolved, excluded, stats
