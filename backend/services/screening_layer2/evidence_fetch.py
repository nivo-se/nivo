"""
Layer 2 evidence: default is **multi-source identity** (1–2 Tavily searches, domain clustering,
limited same-origin fetches + LinkedIn snippets). Legacy **homepage_known** keeps single-URL crawl.
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Literal, Optional, Sequence, Tuple
from urllib.parse import urljoin, urlparse

import httpx

from backend.services.screening_layer2.domain_identity import (
    TAVILY_QUERY_INDEX_IDENTITY,
    TAVILY_QUERY_INDEX_PRIMARY_SEMANTIC,
    TavilyHit,
    collect_supporting_domains_from_hits,
    compute_layer2_identity_low,
    group_hits_by_domain,
    is_supporting_domain,
    merge_tavily_result_hits,
    pick_linkedin_snippets,
    post_cluster_domain_blocked,
    rank_domains,
    registrable_domain,
    same_brand_family,
    secondary_identity_tavily_recommended,
    tavily_low_credit_primary_query,
    tavily_secondary_official_website_query,
)
from backend.services.web_intel.tavily_client import TavilySearchResult

TavilyClientStatus = Literal["ok", "import_failed", "no_api_key"]
Layer2RetrievalMode = Literal["homepage_known", "multi_source"]

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT = 12.0
MAX_CHARS_PER_PAGE = 12_000
MAX_PAGES_TOTAL = 3
MIN_TOTAL_CHARS_SUFFICIENT = 400
USER_AGENT = "NivoScreeningLayer2/1.1 (+https://nivogroup.se)"

# Raw Tavily search JSON artifacts (relative to Layer 2 run out_dir)
LAYER2_RAW_SUBDIR = "layer2_raw"


def _write_layer2_tavily_raw_envelope(
    raw_tavily_dir: Path,
    orgnr: str,
    company_name: str,
    query_role: str,
    query_index: int,
    query_string: str,
    search_depth_used: str,
    tavily_response: dict[str, Any],
) -> str:
    """Persist full Tavily search JSON (envelope + API body). Returns path relative to run out_dir."""
    raw_tavily_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{orgnr}__{query_role}.json"
    path = raw_tavily_dir / filename
    envelope = {
        "schema_version": 1,
        "orgnr": orgnr,
        "company_name": company_name,
        "query_role": query_role,
        "query_index": query_index,
        "query_string": query_string,
        "search_depth_used": search_depth_used,
        "tavily_response": tavily_response,
    }
    path.write_text(json.dumps(envelope, ensure_ascii=False, indent=2), encoding="utf-8")
    return f"{LAYER2_RAW_SUBDIR}/{filename}"


def _maybe_tavily_debug_dump(
    *,
    orgnr: str,
    company_name: str,
    raw_tavily_dir: Optional[Path],
    tavily_debug_output_dir: Optional[Path],
    tavily_debug_orgnr: Optional[str],
    tavily_debug_print_json: bool,
    queries: List[str],
    identity_response: Optional[dict[str, Any]],
    primary_response: Optional[dict[str, Any]],
    tavily_low_credit_debug: bool = False,
) -> None:
    """Single-org debug: write combined JSON and optionally print full payload to stdout."""
    out_dir = tavily_debug_output_dir or raw_tavily_dir
    if not out_dir or not tavily_debug_orgnr:
        return
    if orgnr.strip() != tavily_debug_orgnr.strip():
        return
    out_dir.mkdir(parents=True, exist_ok=True)
    if tavily_low_credit_debug:
        id_q = queries[1] if len(queries) > 1 else None
        prim_q = queries[0] if queries else None
    else:
        id_q = queries[TAVILY_QUERY_INDEX_IDENTITY] if len(queries) > TAVILY_QUERY_INDEX_IDENTITY else None
        prim_q = (
            queries[TAVILY_QUERY_INDEX_PRIMARY_SEMANTIC]
            if len(queries) > TAVILY_QUERY_INDEX_PRIMARY_SEMANTIC
            else None
        )
    payload = {
        "schema_version": 1,
        "orgnr": orgnr,
        "company_name": company_name,
        "queries": queries,
        "tavily_low_credit_mode": tavily_low_credit_debug,
        "identity_query": id_q,
        "primary_semantic_query": prim_q,
        "tavily_response_identity_search": identity_response or {},
        "tavily_response_primary_search": primary_response or {},
    }
    path = out_dir / f"{orgnr}__debug_tavily_queries.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"TAVILY_DEBUG orgnr={orgnr} wrote {path}",
        flush=True,
    )
    if tavily_debug_print_json:
        print(json.dumps(payload, ensure_ascii=False, indent=2), flush=True)

def _normalize_tavily_results_from_data(data: dict[str, Any]) -> list[TavilySearchResult]:
    results_raw = data.get("results") or []
    return [
        TavilySearchResult(
            url=(r.get("url") or "").strip(),
            title=(r.get("title") or "Untitled").strip(),
            content=r.get("content"),
            score=r.get("score"),
            metadata={"raw": r},
        )
        for r in results_raw
        if (r.get("url") or "").strip()
    ][:5]


def _try_load_cached_tavily_envelope(
    cache_dir: Path,
    orgnr: str,
    role: str,
    expected_query: str,
) -> Optional[dict[str, Any]]:
    """Load prior ``layer2_raw`` envelope; reuse only if ``query_string`` matches and results exist."""
    p = cache_dir / f"{orgnr}__{role}.json"
    if not p.is_file():
        return None
    try:
        env = json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None
    qs = (env.get("query_string") or "").strip()
    if qs != expected_query.strip():
        return None
    tr = env.get("tavily_response") or {}
    if not (tr.get("results") or []):
        return None
    return env


# Skip junk / aggregators when choosing an "official" URL from Tavily results
_BLOCKED_TAVILY_HOST_SUBSTR = (
    "linkedin.com",
    "facebook.com",
    "instagram.com",
    "google.",
    "wikipedia.org",
    "allabolag.se",
    "hitta.se",
    "bolagsfakta",
    "syna.se",
    "proff.se",
    "kreditrapport",
    "twitter.com",
    "x.com",
)

_ABOUT_RE = re.compile(
    r"about|om-oss|omoss|om\s+oss|company|företag|foretag|who-we|our-story|varum|historia",
    re.I,
)
_PRODUCT_RE = re.compile(
    r"product|produkt|produkter|service|services|tjanst|tjänst|tjanster|sortiment|"
    r"catalog|katalog|shop|butik|erbjud|offerings|solutions",
    re.I,
)


@dataclass
class RetrievalMeta:
    pages_fetched_count: int = 0
    homepage_used: Optional[str] = None
    tavily_used: bool = False
    evidence_urls: List[str] = field(default_factory=list)
    layer2_retrieval_mode: Layer2RetrievalMode = "multi_source"
    likely_first_party_domains: List[str] = field(default_factory=list)
    supporting_domains: List[str] = field(default_factory=list)
    layer2_identity_confidence_low: bool = False
    tavily_queries_run: int = 0
    domain_cluster_ranking: List[str] = field(default_factory=list)
    tavily_raw_artifacts: Dict[str, str] = field(default_factory=dict)
    tavily_api_calls: int = 0
    tavily_cache_hits: int = 0
    tavily_low_credit_mode: bool = False
    tavily_search_calls: int = 0
    tavily_search_time_ms: float = 0.0
    http_fetch_time_ms: float = 0.0
    openai_time_ms: float = 0.0
    total_row_time_ms: float = 0.0

    def as_dict(self) -> dict:
        return {
            "pages_fetched_count": self.pages_fetched_count,
            "homepage_used": self.homepage_used or "",
            "tavily_used": self.tavily_used,
            "evidence_urls": list(self.evidence_urls),
            "layer2_retrieval_mode": self.layer2_retrieval_mode,
            "likely_first_party_domains": list(self.likely_first_party_domains),
            "supporting_domains": list(self.supporting_domains),
            "layer2_identity_confidence_low": self.layer2_identity_confidence_low,
            "tavily_queries_run": self.tavily_queries_run,
            "domain_cluster_ranking": list(self.domain_cluster_ranking),
            "tavily_raw_artifacts": dict(self.tavily_raw_artifacts),
            "tavily_api_calls": self.tavily_api_calls,
            "tavily_cache_hits": self.tavily_cache_hits,
            "tavily_low_credit_mode": self.tavily_low_credit_mode,
            "tavily_search_calls": self.tavily_search_calls,
            "tavily_search_time_ms": round(self.tavily_search_time_ms, 1),
            "http_fetch_time_ms": round(self.http_fetch_time_ms, 1),
            "openai_time_ms": round(self.openai_time_ms, 1),
            "total_row_time_ms": round(self.total_row_time_ms, 1),
        }


@dataclass
class RetrievalDebugInfo:
    """Per-row diagnostics for Layer 2 retrieval (logging / audit; not LLM output)."""

    homepage_present: bool
    homepage_fetch_ok: bool
    substantive_text_chars: int
    fallback_reason: Literal["none", "missing_homepage", "homepage_failed", "thin_evidence"]
    tavily_fallback_entered: bool
    tavily_used: bool
    layer2_retrieval_mode: Layer2RetrievalMode = "multi_source"
    layer2_identity_confidence_low: bool = False
    likely_first_party_domains: List[str] = field(default_factory=list)

    def log_row(self, orgnr: str) -> None:
        logger.info(
            "Layer2 retrieval row orgnr=%s mode=%s identity_low=%s domains=%s "
            "homepage_present=%s homepage_fetch_ok=%s substantive_text_chars=%s "
            "fallback_reason=%s tavily_fallback_entered=%s tavily_used=%s",
            orgnr,
            self.layer2_retrieval_mode,
            self.layer2_identity_confidence_low,
            self.likely_first_party_domains,
            self.homepage_present,
            self.homepage_fetch_ok,
            self.substantive_text_chars,
            self.fallback_reason,
            self.tavily_fallback_entered,
            self.tavily_used,
        )


def resolve_tavily_client() -> Tuple[Optional[object], TavilyClientStatus]:
    """
    Return (client, status). Prefer TAVILY_API_KEY from environment (runner loads dotenv first).
    """
    try:
        from backend.services.web_intel.tavily_client import TavilyClient
    except ImportError:
        return None, "import_failed"
    key = (os.getenv("TAVILY_API_KEY") or "").strip() or None
    client = TavilyClient(api_key=key)
    if not client.api_key:
        return client, "no_api_key"
    return client, "ok"


def log_layer2_tavily_startup() -> None:
    """Log Tavily readiness once at runner startup (after dotenv)."""
    key_env = bool((os.getenv("TAVILY_API_KEY") or "").strip())
    try:
        from backend.services.web_intel.tavily_client import TavilyClient  # noqa: F401
    except ImportError as e:
        logger.warning("tavily_unavailable_import_failed startup error=%s", str(e)[:200])
        logger.info(
            "Layer2 startup tavily_import_ok=False tavily_api_key_env_present=%s tavily_available=False",
            key_env,
        )
        return
    _, status = resolve_tavily_client()
    logger.info(
        "Layer2 startup tavily_import_ok=True tavily_api_key_env_present=%s tavily_available=%s",
        key_env,
        status == "ok",
    )


def normalize_homepage(raw: Optional[str]) -> Optional[str]:
    s = (raw or "").strip()
    if not s:
        return None
    if not s.startswith(("http://", "https://")):
        s = "https://" + s
    p = urlparse(s)
    if not p.netloc:
        return None
    return s


def _norm_host(netloc: str) -> str:
    h = netloc.lower().split("@")[-1].split(":")[0]
    return h[4:] if h.startswith("www.") else h


def _same_site(a: str, b: str) -> bool:
    return _norm_host(a) == _norm_host(b)


def _verify_top_cluster_homepage(
    client: httpx.Client,
    domain: str,
    _hits: Sequence[TavilyHit],
    fetch_fn: Optional[Callable[..., Tuple[Optional[str], Optional[str], str]]] = None,
) -> Tuple[Optional[str], Optional[str]]:
    """
    homepage_used may only come from the top-ranked first-party cluster.
    Try ``https://{domain}/`` and ``https://www.{domain}/`` only (no Tavily in-cluster URL fallbacks).
    Returns (final_url_after_redirects, html) or (None, None) if nothing verifies.
    """
    fn = fetch_fn or _fetch_html
    for root in (f"https://{domain}/", f"https://www.{domain}/"):
        htm, err, fin = fn(client, root)
        if htm and not err:
            return fin, htm
    return None, None


def _strip_html_to_text(html: str, max_chars: int) -> str:
    try:
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        text = soup.get_text(separator="\n", strip=True)
    except Exception:
        text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > max_chars:
        text = text[:max_chars] + "…"
    return text


def _fetch_html(
    client: httpx.Client, url: str
) -> Tuple[Optional[str], Optional[str], str]:
    """Returns (html_body, error, final_url)."""
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


def _page_text_from_html(html: str) -> str:
    return _strip_html_to_text(html, MAX_CHARS_PER_PAGE)


def _internal_link_candidates(
    html: str, base_url: str, official_netloc: str
) -> List[Tuple[str, str]]:
    """(absolute_url, anchor_text) same-site only, http(s) only."""
    try:
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "html.parser")
    except Exception:
        return []
    out: List[Tuple[str, str]] = []
    seen: set[str] = set()
    for a in soup.find_all("a", href=True):
        href = (a.get("href") or "").strip()
        if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
            continue
        if href.lower().endswith((".pdf", ".zip", ".jpg", ".png", ".gif")):
            continue
        abs_url = urljoin(base_url, href)
        p = urlparse(abs_url)
        if p.scheme not in ("http", "https"):
            continue
        if not _same_site(p.netloc, official_netloc):
            continue
        key = abs_url.split("#")[0].rstrip("/")
        if key in seen:
            continue
        seen.add(key)
        label = a.get_text(separator=" ", strip=True) or ""
        out.append((abs_url, label))
    return out


def _score_about(href: str, label: str) -> int:
    s = f"{href} {label}"
    return 3 if _ABOUT_RE.search(s) else 0


def _score_product(href: str, label: str) -> int:
    s = f"{href} {label}"
    return 3 if _PRODUCT_RE.search(s) else 0


def _pick_best(
    candidates: List[Tuple[str, str]],
    scorer: Callable[[str, str], int],
    exclude_urls: set[str],
) -> Optional[str]:
    best: Optional[str] = None
    best_score = 0
    for url, label in candidates:
        u = url.split("#")[0].rstrip("/")
        if u in exclude_urls:
            continue
        sc = scorer(url, label)
        if sc > best_score:
            best_score = sc
            best = url
    return best if best_score > 0 else None


def _name_tokens(company_name: str) -> List[str]:
    parts = re.split(r"[^\wåäöÅÄÖ]+", company_name, flags=re.I)
    return [p.lower() for p in parts if len(p) >= 4]


def _blocked_host(host: str) -> bool:
    h = host.lower()
    return any(b in h for b in _BLOCKED_TAVILY_HOST_SUBSTR)


def _pick_official_from_tavily(
    results: list, company_name: str, tokens: List[str]
) -> Optional[str]:
    best: Optional[str] = None
    best_sc = -1.0
    for r in results:
        url = getattr(r, "url", "") or ""
        if not url.startswith("http"):
            continue
        p = urlparse(url)
        if _blocked_host(p.netloc):
            continue
        title = (getattr(r, "title", "") or "").lower()
        path = (p.path or "").lower()
        sc = float(getattr(r, "score", None) or 0)
        if p.netloc.endswith(".se"):
            sc += 2.0
        for t in tokens:
            if t in path or t in title:
                sc += 1.5
        if sc > best_sc:
            best_sc = sc
            best = url
    return best


def _append_chunk(chunks: List[str], label: str, url: str, text: str) -> None:
    if not text.strip():
        return
    chunks.append(f"=== {label}: {url} ===\n{text.strip()}")


def _substantive_body_chars(chunks: List[str]) -> int:
    """Chars from fetched HTML pages and Tavily snippets (homepage-missing mode)."""
    total = 0
    for c in chunks:
        if c.startswith("=== PAGE:") or c.startswith("=== TAVILY_EXTRACT:") or c.startswith(
            "=== TAVILY_SNIPPET:"
        ) or c.startswith("=== LINKEDIN_SNIPPET:"):
            parts = c.split("\n", 1)
            if len(parts) > 1:
                total += len(parts[1].strip())
    return total


def effective_retrieval_mode(
    homepage: Optional[str],
    retrieval_mode: Literal["auto", "homepage_known", "homepage_missing", "multi_source"],
) -> Layer2RetrievalMode:
    """Default (auto / homepage_missing) uses multi-source identity; only homepage_known keeps legacy crawl."""
    if retrieval_mode == "homepage_known":
        return "homepage_known"
    return "multi_source"


def _build_evidence_pack_multi_source(
    orgnr: str,
    company_name: str,
    homepage: Optional[str],
    meta: RetrievalMeta,
    *,
    raw_tavily_dir: Optional[Path] = None,
    tavily_raw_cache_dir: Optional[Path] = None,
    tavily_debug_output_dir: Optional[Path] = None,
    tavily_debug_orgnr: Optional[str] = None,
    tavily_debug_print_json: bool = False,
) -> Tuple[str, RetrievalMeta, RetrievalDebugInfo]:
    """
    Tavily: primary search always; second ``official website`` query when primary-only identity is
    ambiguous or borderline (precision over call count — wrong domain costs more than an extra search).
    """
    meta.layer2_retrieval_mode = "multi_source"
    meta.tavily_low_credit_mode = True
    intro = (
        "=== RETRIEVAL_MODE: multi_source_identity_efficient ===\n"
        "Built from 1–2 Tavily searches (product/semantic primary + official-website query when identity "
        "is ambiguous or borderline), domain clustering, and limited same-origin HTTP fetches on a "
        "canonical homepage only when first-party identity is clear (no Tavily extract).\n"
    )
    chunks: List[str] = [intro]
    hint = normalize_homepage(homepage)
    meta.homepage_present = bool(hint)

    raw_lists: list = []
    identity_raw: Optional[dict[str, Any]] = None
    primary_raw: Optional[dict[str, Any]] = None
    queries_executed: List[str] = []
    primary_fp: Optional[str] = None
    home_f_p: Optional[str] = None
    home_h_p: Optional[str] = None

    tavily_client, tav_status = resolve_tavily_client()
    if tav_status == "import_failed":
        logger.warning(
            "tavily_unavailable_import_failed orgnr=%s (TavilyClient import failed; check pydantic-settings / PYTHONPATH)",
            orgnr,
        )
    elif tav_status == "no_api_key":
        logger.warning("tavily_unavailable_no_api_key orgnr=%s", orgnr)
    else:
        meta.tavily_used = True
        cache_dir = tavily_raw_cache_dir or raw_tavily_dir
        q_primary = tavily_low_credit_primary_query(company_name)
        q_secondary = tavily_secondary_official_website_query(company_name)

        def _one_search(
            query: str,
            role: str,
            query_index: int,
        ) -> Tuple[list, dict[str, Any]]:
            raw_json: dict[str, Any] = {}
            rlist: list = []
            t0 = time.perf_counter()
            if cache_dir:
                env = _try_load_cached_tavily_envelope(cache_dir, orgnr, role, query)
                if env is not None:
                    tr = env.get("tavily_response") or {}
                    rlist = _normalize_tavily_results_from_data(tr)
                    if rlist:
                        meta.tavily_cache_hits += 1
                        raw_json = tr
                        meta.tavily_search_time_ms += (time.perf_counter() - t0) * 1000
                        return rlist, raw_json
            try:
                rlist, raw_json = tavily_client.search_and_raw_response(
                    query,
                    max_results=5,
                    search_depth="basic",
                    max_retries=0,
                )
            except Exception as e:
                logger.warning(
                    "tavily_query_failed orgnr=%s role=%s err=%s",
                    orgnr,
                    role,
                    str(e)[:160],
                )
                meta.tavily_search_time_ms += (time.perf_counter() - t0) * 1000
                return [], {}
            meta.tavily_search_time_ms += (time.perf_counter() - t0) * 1000
            meta.tavily_search_calls += 1
            if rlist:
                meta.tavily_api_calls += 1
            if raw_tavily_dir and raw_json:
                rel = _write_layer2_tavily_raw_envelope(
                    raw_tavily_dir,
                    orgnr,
                    company_name,
                    role,
                    query_index,
                    query,
                    "basic",
                    raw_json,
                )
                meta.tavily_raw_artifacts[role] = rel
            return rlist, raw_json

        r1, primary_raw = _one_search(q_primary, "primary_search", TAVILY_QUERY_INDEX_PRIMARY_SEMANTIC)
        queries_executed = [q_primary]
        raw_lists = [r1 or []]

        merged_primary = merge_tavily_result_hits([r1 or []], max_hits=15)
        grouped_p = group_hits_by_domain(merged_primary)
        ranked_p = rank_domains(
            grouped_p,
            company_name,
            homepage_hint=hint,
            blocked_substrings=_BLOCKED_TAVILY_HOST_SUBSTR,
        )
        ranked_no_block_p = [r for r in ranked_p if not post_cluster_domain_blocked(r[0])]
        ranked_fp_only_p = [r for r in ranked_no_block_p if not is_supporting_domain(r[0])]

        primary_fp = ranked_fp_only_p[0][0] if ranked_fp_only_p else None
        http_ms_verify = 0.0

        def fetch_timed(cl: httpx.Client, url: str) -> Tuple[Optional[str], Optional[str], str]:
            nonlocal http_ms_verify
            t0 = time.perf_counter()
            res = _fetch_html(cl, url)
            http_ms_verify += (time.perf_counter() - t0) * 1000
            return res

        with httpx.Client(
            timeout=REQUEST_TIMEOUT,
            headers={"User-Agent": USER_AGENT},
            limits=httpx.Limits(max_connections=5),
        ) as client:
            if primary_fp:
                home_f_p, home_h_p = _verify_top_cluster_homepage(
                    client, primary_fp, [], fetch_fn=fetch_timed
                )
            home_verified_p = bool(home_f_p and home_h_p)
            if secondary_identity_tavily_recommended(
                ranked_fp_only_p,
                ranked_no_block_p,
                company_name,
                homepage_verified=home_verified_p,
            ):
                r2, identity_raw = _one_search(q_secondary, "identity_search", TAVILY_QUERY_INDEX_IDENTITY)
                queries_executed.append(q_secondary)
                raw_lists = [r1 or [], r2 or []]

        meta.tavily_queries_run = len(raw_lists)
        meta.http_fetch_time_ms += http_ms_verify

        _maybe_tavily_debug_dump(
            orgnr=orgnr,
            company_name=company_name,
            raw_tavily_dir=raw_tavily_dir,
            tavily_debug_output_dir=tavily_debug_output_dir,
            tavily_debug_orgnr=tavily_debug_orgnr,
            tavily_debug_print_json=tavily_debug_print_json,
            queries=list(queries_executed),
            identity_response=identity_raw,
            primary_response=primary_raw,
            tavily_low_credit_debug=True,
        )

    merged = merge_tavily_result_hits(raw_lists, max_hits=15)
    grouped = group_hits_by_domain(merged)
    ranked = rank_domains(
        grouped,
        company_name,
        homepage_hint=hint,
        blocked_substrings=_BLOCKED_TAVILY_HOST_SUBSTR,
    )
    ranked_no_block = [r for r in ranked if not post_cluster_domain_blocked(r[0])]
    ranked_fp_only = [r for r in ranked_no_block if not is_supporting_domain(r[0])]

    likely_domains: List[str] = []
    if ranked_fp_only:
        likely_domains.append(ranked_fp_only[0][0])
        for d, _sc, _hs in ranked_fp_only[1:]:
            if same_brand_family(ranked_fp_only[0][0], d, company_name):
                likely_domains.append(d)
                break

    meta.likely_first_party_domains = list(likely_domains)
    meta.supporting_domains = collect_supporting_domains_from_hits(merged)

    rank_lines = [f"- {dom}: score={sc:.2f} hits={len(hs)}" for dom, sc, hs in ranked_fp_only[:5]]
    meta.domain_cluster_ranking = list(rank_lines)
    chunks.append(
        "=== DOMAIN_CLUSTER_RANKING (top 5, first-party candidates post-cluster) ===\n"
        + ("\n".join(rank_lines) if rank_lines else "(none)")
    )
    if meta.supporting_domains:
        chunks.append(
            "=== SUPPORTING_DOMAINS (non-homepage) ===\n" + ", ".join(meta.supporting_domains)
        )

    for h in merged[:12]:
        snip = (h.content or "").strip()[:2500]
        if snip:
            _append_chunk(chunks, "TAVILY_SNIPPET", h.url, snip)

    for h in pick_linkedin_snippets(merged):
        snip = (h.content or "").strip()[:3000]
        if snip:
            _append_chunk(chunks, "LINKEDIN_SNIPPET", h.url, snip)

    pages = 0
    homepage_fetch_ok = False

    def record_page(url: str) -> None:
        nonlocal pages
        pages += 1
        if url not in meta.evidence_urls:
            meta.evidence_urls.append(url)
        meta.pages_fetched_count = pages

    with httpx.Client(
        timeout=REQUEST_TIMEOUT,
        headers={"User-Agent": USER_AGENT},
        limits=httpx.Limits(max_connections=5),
    ) as client:
        homepage_verified = False
        meta.homepage_used = None
        http_ms_fetch = 0.0

        def fetch_timed(cl: httpx.Client, url: str) -> Tuple[Optional[str], Optional[str], str]:
            nonlocal http_ms_fetch
            t0 = time.perf_counter()
            res = _fetch_html(cl, url)
            http_ms_fetch += (time.perf_counter() - t0) * 1000
            return res

        did_secondary = len(raw_lists) > 1

        top_dom = ranked_fp_only[0][0] if ranked_fp_only else None
        home_final: Optional[str] = None
        home_html: Optional[str] = None

        if top_dom and not did_secondary and primary_fp and top_dom == primary_fp and home_f_p and home_h_p:
            home_final, home_html = home_f_p, home_h_p
        elif top_dom:
            home_final, home_html = _verify_top_cluster_homepage(
                client, top_dom, [], fetch_fn=fetch_timed
            )
            if not home_html and len(ranked_fp_only) > 1:
                d2 = ranked_fp_only[1][0]
                home_final, home_html = _verify_top_cluster_homepage(
                    client, d2, [], fetch_fn=fetch_timed
                )

        homepage_verified = bool(home_final and home_html)
        meta.layer2_identity_confidence_low = compute_layer2_identity_low(
            ranked_fp_only,
            ranked_no_block,
            company_name,
            homepage_verified=homepage_verified,
            had_top_fp_candidate=bool(ranked_fp_only),
        )
        # Never treat a weak or ambiguous cluster as canonical homepage_used — prefer unresolved over wrong.
        use_canonical_homepage = bool(
            home_final
            and home_html
            and not meta.layer2_identity_confidence_low
        )
        if use_canonical_homepage:
            meta.homepage_used = home_final.split("#")[0].rstrip("/")
            homepage_fetch_ok = True
            tx = _page_text_from_html(home_html)
            if tx:
                _append_chunk(chunks, "PAGE", home_final, tx)
                record_page(home_final)
            off = urlparse(home_final).netloc
            if pages < MAX_PAGES_TOTAL:
                cands = _internal_link_candidates(home_html, home_final, off)
                excl = {home_final.split("#")[0].rstrip("/")}
                about_u = _pick_best(cands, _score_about, excl)
                if about_u:
                    excl.add(about_u.split("#")[0].rstrip("/"))
                prod_u = _pick_best(cands, _score_product, excl)
                for u in (about_u, prod_u):
                    if not u or pages >= MAX_PAGES_TOTAL:
                        continue
                    t_inner = time.perf_counter()
                    h2, e2, f2 = _fetch_html(client, u)
                    http_ms_fetch += (time.perf_counter() - t_inner) * 1000
                    if h2 and not e2:
                        t2 = _page_text_from_html(h2)
                        if t2:
                            _append_chunk(chunks, "PAGE", f2, t2)
                            record_page(f2)
        else:
            meta.homepage_used = None

        meta.http_fetch_time_ms += http_ms_fetch

        if meta.layer2_identity_confidence_low:
            chunks.append(
                "=== IDENTITY_LOW_CONFIDENCE ===\n"
                "First-party identity is uncertain or not clearly confirmed — no canonical homepage PAGE "
                "lines were included as ground truth for this legal entity. Rely on snippets/metadata only; "
                "classify conservatively (lower fit_confidence / downweight product claims) but still output JSON.\n"
            )

    subs_final = _substantive_body_chars(chunks)
    fb: Literal["none", "missing_homepage", "homepage_failed", "thin_evidence"] = (
        "missing_homepage" if not merged else "none"
    )
    dbg = RetrievalDebugInfo(
        homepage_present=meta.homepage_present,
        homepage_fetch_ok=homepage_fetch_ok,
        substantive_text_chars=subs_final,
        fallback_reason=fb,
        tavily_fallback_entered=True,
        tavily_used=meta.tavily_used,
        layer2_retrieval_mode="multi_source",
        layer2_identity_confidence_low=meta.layer2_identity_confidence_low,
        likely_first_party_domains=list(meta.likely_first_party_domains),
    )
    return "\n\n".join(chunks).strip(), meta, dbg


def build_evidence_pack(
    orgnr: str,
    company_name: str,
    homepage: Optional[str],
    *,
    retrieval_mode: Literal["auto", "homepage_known", "homepage_missing", "multi_source"] = "auto",
    raw_tavily_dir: Optional[Path] = None,
    tavily_raw_cache_dir: Optional[Path] = None,
    tavily_debug_output_dir: Optional[Path] = None,
    tavily_debug_orgnr: Optional[str] = None,
    tavily_debug_print_json: bool = False,
) -> Tuple[str, RetrievalMeta, RetrievalDebugInfo]:
    """
    Multi-source identity (default) or legacy homepage-first crawl (homepage_known only).

    ``raw_tavily_dir``: if set (e.g. ``out_dir / "layer2_raw"``), persist full Tavily search JSON
    for the identity + primary semantic queries (multi-source) or the single fallback query (homepage_known).
    ``tavily_debug_output_dir``: optional; defaults to ``raw_tavily_dir`` for ``--debug-tavily-orgnr`` dumps.
    """
    eff = effective_retrieval_mode(homepage, retrieval_mode)
    meta = RetrievalMeta(layer2_retrieval_mode=eff)
    if eff == "multi_source":
        return _build_evidence_pack_multi_source(
            orgnr,
            company_name,
            homepage,
            meta,
            raw_tavily_dir=raw_tavily_dir,
            tavily_raw_cache_dir=tavily_raw_cache_dir,
            tavily_debug_output_dir=tavily_debug_output_dir,
            tavily_debug_orgnr=tavily_debug_orgnr,
            tavily_debug_print_json=tavily_debug_print_json,
        )
    chunks: List[str] = []
    pages = 0
    external_pages = 0
    official_host: Optional[str] = None
    homepage_present = bool(normalize_homepage(homepage))
    homepage_fetch_ok = False

    def record_page(url: str) -> None:
        nonlocal pages
        pages += 1
        if url not in meta.evidence_urls:
            meta.evidence_urls.append(url)
        meta.pages_fetched_count = pages

    home_input = normalize_homepage(homepage)

    t_http0 = time.perf_counter()
    with httpx.Client(
        timeout=REQUEST_TIMEOUT,
        headers={"User-Agent": USER_AGENT},
        limits=httpx.Limits(max_connections=5),
    ) as client:
        # --- Phase A: direct homepage + link-follow (same origin only) ---
        home_html: Optional[str] = None
        home_final: Optional[str] = None
        home_err: Optional[str] = None

        if home_input:
            html, err, final = _fetch_html(client, home_input)
            home_final = final
            if html and not err:
                homepage_fetch_ok = True
                home_html = html
                meta.homepage_used = final.split("#")[0].rstrip("/")
                official_host = urlparse(final).netloc
                text = _page_text_from_html(html)
                if text:
                    _append_chunk(chunks, "PAGE", final, text)
                    record_page(final)
            else:
                home_err = err or "empty"
                chunks.append(f"=== NOTE: homepage fetch failed ({home_input}) ===\n{home_err}")

        exclude: set[str] = set()
        if home_final:
            exclude.add(home_final.split("#")[0].rstrip("/"))

        if home_html and official_host and pages < MAX_PAGES_TOTAL:
            cands = _internal_link_candidates(home_html, home_final or home_input or "", official_host)
            about_u = _pick_best(cands, _score_about, exclude)
            if about_u:
                exclude.add(about_u.split("#")[0].rstrip("/"))
            prod_u = _pick_best(cands, _score_product, exclude)

            for u in (about_u, prod_u):
                if not u or pages >= MAX_PAGES_TOTAL:
                    continue
                html2, err2, fin2 = _fetch_html(client, u)
                if html2 and not err2:
                    t2 = _page_text_from_html(html2)
                    if t2:
                        _append_chunk(chunks, "PAGE", fin2, t2)
                        record_page(fin2)
                elif err2:
                    chunks.append(f"=== NOTE: linked page failed ===\n{u}: {err2}")

        sufficient = (
            _substantive_body_chars(chunks) >= MIN_TOTAL_CHARS_SUFFICIENT and bool(meta.homepage_used)
        )

        # --- Phase B: Tavily (missing / dead / insufficient) — before return / OpenAI ---
        need_tavily = (not home_input) or (home_input and (not meta.homepage_used or home_err)) or (
            not sufficient
        )

        if not need_tavily:
            fallback_reason: Literal[
                "none", "missing_homepage", "homepage_failed", "thin_evidence"
            ] = "none"
        elif not home_input:
            fallback_reason = "missing_homepage"
        elif not meta.homepage_used or home_err:
            fallback_reason = "homepage_failed"
        else:
            fallback_reason = "thin_evidence"

        tavily_client = None
        results: list = []

        if need_tavily:
            logger.info(
                "Layer2 tavily_fallback_enter orgnr=%s reason=%s substantive_pre=%s pages_pre=%s",
                orgnr,
                fallback_reason,
                _substantive_body_chars(chunks),
                pages,
            )
            tavily_client, tav_status = resolve_tavily_client()
            if tav_status == "import_failed":
                logger.warning(
                    "tavily_unavailable_import_failed orgnr=%s (TavilyClient import failed; check pydantic-settings / PYTHONPATH)",
                    orgnr,
                )
            elif tav_status == "no_api_key":
                logger.warning("tavily_unavailable_no_api_key orgnr=%s", orgnr)
            else:
                meta.tavily_used = True
                q = tavily_low_credit_primary_query(company_name)
                t_ts = time.perf_counter()
                results, raw_json = tavily_client.search_and_raw_response(
                    q, max_results=5, search_depth="basic"
                )
                meta.tavily_search_time_ms += (time.perf_counter() - t_ts) * 1000
                meta.tavily_search_calls += 1
                if results:
                    meta.tavily_api_calls += 1
                meta.tavily_queries_run = 1
                if raw_tavily_dir and raw_json:
                    meta.tavily_raw_artifacts["primary_search"] = _write_layer2_tavily_raw_envelope(
                        raw_tavily_dir,
                        orgnr,
                        company_name,
                        "primary_search",
                        TAVILY_QUERY_INDEX_PRIMARY_SEMANTIC,
                        q,
                        "basic",
                        raw_json,
                    )
                _maybe_tavily_debug_dump(
                    orgnr=orgnr,
                    company_name=company_name,
                    raw_tavily_dir=raw_tavily_dir,
                    tavily_debug_output_dir=tavily_debug_output_dir,
                    tavily_debug_orgnr=tavily_debug_orgnr,
                    tavily_debug_print_json=tavily_debug_print_json,
                    queries=[q],
                    identity_response=None,
                    primary_response=raw_json if raw_json else None,
                )

            if results:
                tokens = _name_tokens(company_name)
                official_url = _pick_official_from_tavily(results, company_name, tokens)

                # Snippets from top results (not counted as page fetches)
                for r in results[:3]:
                    u = getattr(r, "url", "")
                    snip = (getattr(r, "content", None) or "").strip()
                    if snip:
                        snip = snip[:2500]
                        _append_chunk(chunks, "TAVILY_SNIPPET", u, snip)
                        if u and u not in meta.evidence_urls:
                            meta.evidence_urls.append(u)

                # If we still lack a working official homepage fetch, try Tavily pick
                if official_url and pages < MAX_PAGES_TOTAL:
                    if not meta.homepage_used:
                        html3, err3, fin3 = _fetch_html(client, official_url)
                        if html3 and not err3:
                            meta.homepage_used = fin3.split("#")[0].rstrip("/")
                            official_host = urlparse(fin3).netloc
                            t3 = _page_text_from_html(html3)
                            if t3:
                                _append_chunk(chunks, "PAGE", fin3, t3)
                                record_page(fin3)
                                home_html = html3
                                home_final = fin3
                        elif err3:
                            chunks.append(f"=== NOTE: Tavily candidate fetch failed ===\n{official_url}: {err3}")

                # Optional external corroboration (HTTP only), same total page cap
                if official_host and pages < MAX_PAGES_TOTAL and external_pages < 1:
                    ext_url: Optional[str] = None
                    for r in results:
                        u = getattr(r, "url", "") or ""
                        if not u.startswith("http"):
                            continue
                        if _blocked_host(urlparse(u).netloc):
                            continue
                        if _same_site(urlparse(u).netloc, official_host):
                            continue
                        ext_url = u
                        break

                    if ext_url and pages < MAX_PAGES_TOTAL:
                        html_e, err_e, fin_e = _fetch_html(client, ext_url)
                        if html_e and not err_e:
                            te = _page_text_from_html(html_e)
                            if te:
                                _append_chunk(chunks, "PAGE", fin_e, te)
                                record_page(fin_e)
                                external_pages += 1

                # Optional: follow about/product on newly discovered home (same origin)
                if home_html and home_final and official_host and pages < MAX_PAGES_TOTAL:
                    cands2 = _internal_link_candidates(home_html, home_final, official_host)
                    ex2: set[str] = {u.split("#")[0].rstrip("/") for u in meta.evidence_urls}
                    about2 = _pick_best(cands2, _score_about, ex2)
                    if about2:
                        ex2.add(about2.split("#")[0].rstrip("/"))
                    prod2 = _pick_best(cands2, _score_product, ex2)
                    for u in (about2, prod2):
                        if not u or pages >= MAX_PAGES_TOTAL:
                            continue
                        h2, e2, f2 = _fetch_html(client, u)
                        if h2 and not e2:
                            tx = _page_text_from_html(h2)
                            if tx:
                                _append_chunk(chunks, "PAGE", f2, tx)
                                record_page(f2)

    meta.http_fetch_time_ms += (time.perf_counter() - t_http0) * 1000

    subs_final = _substantive_body_chars(chunks)
    dbg = RetrievalDebugInfo(
        homepage_present=homepage_present,
        homepage_fetch_ok=homepage_fetch_ok,
        substantive_text_chars=subs_final,
        fallback_reason=fallback_reason,
        tavily_fallback_entered=need_tavily,
        tavily_used=meta.tavily_used,
        layer2_retrieval_mode="homepage_known",
        layer2_identity_confidence_low=False,
        likely_first_party_domains=[],
    )
    return "\n\n".join(chunks).strip(), meta, dbg
