"""
Homepage-first, input-driven evidence for Layer 2 (no path guessing).

1. Use homepage from input/DB only (no name-based web search as primary).
2. Fetch homepage; parse same-origin links; at most one About + one Products/Services page.
3. Tavily only if homepage missing, dead, or text still insufficient — bounded (1 search, ≤1 external page).
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Callable, List, Optional, Tuple
from urllib.parse import urljoin, urlparse

import httpx

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT = 12.0
MAX_CHARS_PER_PAGE = 12_000
MAX_PAGES_TOTAL = 4
MIN_TOTAL_CHARS_SUFFICIENT = 400
USER_AGENT = "NivoScreeningLayer2/1.1 (+https://nivogroup.se)"

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

    def as_dict(self) -> dict:
        return {
            "pages_fetched_count": self.pages_fetched_count,
            "homepage_used": self.homepage_used or "",
            "tavily_used": self.tavily_used,
            "evidence_urls": list(self.evidence_urls),
        }


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


def _tavily_client():
    try:
        from backend.services.web_intel.tavily_client import TavilyClient

        return TavilyClient()
    except ImportError:
        logger.debug("TavilyClient unavailable (import path); set PYTHONPATH to repo root.")
        return None


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
    """Chars from fetched HTML pages / Tavily extract only (not NOTES or snippets)."""
    total = 0
    for c in chunks:
        if c.startswith("=== PAGE:") or c.startswith("=== TAVILY_EXTRACT:"):
            parts = c.split("\n", 1)
            if len(parts) > 1:
                total += len(parts[1].strip())
    return total


def _run_tavily_search(company_name: str, orgnr: str, meta: RetrievalMeta) -> list:
    client = _tavily_client()
    if not client or not client.api_key:
        return []
    meta.tavily_used = True
    q = f'"{company_name}" Sweden organisationsnummer {orgnr} official website'
    return client.search(q, max_results=5, search_depth="basic")


def build_evidence_pack(
    orgnr: str,
    company_name: str,
    homepage: Optional[str],
) -> Tuple[str, RetrievalMeta]:
    """
    Input-driven evidence only. Optional bounded Tavily when homepage missing/dead/thin.
    """
    meta = RetrievalMeta()
    chunks: List[str] = []
    pages = 0
    external_pages = 0
    official_host: Optional[str] = None

    def record_page(url: str) -> None:
        nonlocal pages
        pages += 1
        if url not in meta.evidence_urls:
            meta.evidence_urls.append(url)
        meta.pages_fetched_count = pages

    home_input = normalize_homepage(homepage)

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

        # --- Phase B: Tavily (missing / dead / insufficient) ---
        need_tavily = (not home_input) or (home_input and (not meta.homepage_used or home_err)) or (
            not sufficient
        )

        if need_tavily:
            results = _run_tavily_search(company_name, orgnr, meta)
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

                # One external corroboration page (Tavily extract), same total page cap
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

                    if ext_url:
                        tv = _tavily_client()
                        if tv and tv.api_key:
                            extracted = tv.extract([ext_url], chunks_per_source=2, extract_depth="basic")
                            for ex in extracted:
                                if ex.failed or not (ex.raw_content or "").strip():
                                    continue
                                body = _strip_html_to_text(ex.raw_content, MAX_CHARS_PER_PAGE)
                                if body:
                                    _append_chunk(chunks, "TAVILY_EXTRACT", ex.url, body)
                                    record_page(ex.url)
                                    external_pages += 1
                                break
                        if external_pages == 0 and pages < MAX_PAGES_TOTAL:
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

    return "\n\n".join(chunks).strip(), meta
