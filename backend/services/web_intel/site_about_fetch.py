"""
Same-origin homepage + About / Om oss fetch (plain text, capped).

Shared by Layer 2 evidence_fetch and offline website-research batch jobs.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable, List, Literal, Optional, Set, Tuple
from urllib.parse import urljoin, urlparse

import httpx

REQUEST_TIMEOUT = 12.0
MAX_CHARS_PER_PAGE = 12_000
MAX_PAGES_TOTAL = 3
USER_AGENT = "NivoScreeningLayer2/1.1 (+https://nivogroup.se)"

ABOUT_RE = re.compile(
    r"about|om-oss|omoss|om\s+oss|company|företag|foretag|who-we|our-story|varum|historia",
    re.I,
)
PRODUCT_RE = re.compile(
    r"product|produkt|produkter|service|services|tjanst|tjänst|tjanster|sortiment|"
    r"catalog|katalog|shop|butik|erbjud|offerings|solutions",
    re.I,
)

SiteAboutFetchStatus = Literal[
    "ok",
    "no_url",
    "http_error",
    "non_html",
    "timeout",
    "empty_text",
    "home_only",
]


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


def same_site(a: str, b: str) -> bool:
    return _norm_host(a) == _norm_host(b)


def strip_html_to_text(html: str, max_chars: int) -> str:
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


def fetch_html(client: httpx.Client, url: str) -> Tuple[Optional[str], Optional[str], str]:
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
    except httpx.TimeoutException as e:
        return None, f"timeout:{type(e).__name__}", url
    except Exception as e:
        return None, str(e)[:200], url


def page_text_from_html(html: str) -> str:
    return strip_html_to_text(html, MAX_CHARS_PER_PAGE)


def internal_link_candidates(html: str, base_url: str, official_netloc: str) -> List[Tuple[str, str]]:
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
        if not same_site(p.netloc, official_netloc):
            continue
        key = abs_url.split("#")[0].rstrip("/")
        if key in seen:
            continue
        seen.add(key)
        label = a.get_text(separator=" ", strip=True) or ""
        out.append((abs_url, label))
    return out


def score_about(href: str, label: str) -> int:
    s = f"{href} {label}"
    return 3 if ABOUT_RE.search(s) else 0


def score_product(href: str, label: str) -> int:
    s = f"{href} {label}"
    return 3 if PRODUCT_RE.search(s) else 0


def pick_best(
    candidates: List[Tuple[str, str]],
    scorer: Callable[[str, str], int],
    exclude_urls: Set[str],
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


def _classify_fetch_error(err: Optional[str]) -> SiteAboutFetchStatus:
    if not err:
        return "http_error"
    el = err.lower()
    if "non-html" in el or err == "non-html":
        return "non_html"
    if "timeout" in el or "timed out" in el:
        return "timeout"
    if err.startswith("HTTP "):
        return "http_error"
    return "http_error"


@dataclass
class SiteAboutFetchResult:
    status: SiteAboutFetchStatus
    final_home_url: str = ""
    about_page_chosen_url: str = ""
    home_text: str = ""
    section_text: str = ""
    text_for_llm: str = ""
    pages_fetched: int = 0
    error_detail: Optional[str] = None


def fetch_home_and_about(
    url: Optional[str],
    *,
    fetch_about_page: bool = True,
    client: Optional[httpx.Client] = None,
) -> SiteAboutFetchResult:
    """
    GET homepage, optional same-origin About/Om oss follow (one extra page max for this helper).

    Layer 2 ``homepage_known`` path also follows a "product" page; set ``fetch_about_page=True``
    and this helper only adds the About link (not product).

    ``client``: optional shared ``httpx.Client`` (timeout/headers); if None, a client is created.
    """
    home_input = normalize_homepage(url)
    if not home_input:
        return SiteAboutFetchResult(status="no_url")

    def run(cl: httpx.Client) -> SiteAboutFetchResult:
        html, err, final = fetch_html(cl, home_input)
        if not html or err:
            st = _classify_fetch_error(err)
            return SiteAboutFetchResult(
                status=st,
                error_detail=err,
                final_home_url=final if final else home_input,
            )

        final_home = final.split("#")[0].rstrip("/")
        official_host = urlparse(final).netloc
        home_plain = page_text_from_html(html)
        if not home_plain.strip():
            return SiteAboutFetchResult(
                status="empty_text",
                final_home_url=final_home,
                error_detail=err or "empty homepage text",
            )

        pages = 1
        section_plain = ""
        about_url = ""
        if fetch_about_page and pages < MAX_PAGES_TOTAL:
            cands = internal_link_candidates(html, final, official_host)
            excl: Set[str] = {final.split("#")[0].rstrip("/")}
            about_u = pick_best(cands, score_about, excl)
            if about_u:
                h2, e2, f2 = fetch_html(cl, about_u)
                if h2 and not e2:
                    t2 = page_text_from_html(h2)
                    if t2.strip():
                        section_plain = t2
                        about_url = f2.split("#")[0].rstrip("/")
                        pages += 1

        parts = [f"=== HOME ===\n{home_plain}"]
        if section_plain.strip():
            parts.append(f"=== ABOUT ===\n{section_plain}")
        combined = "\n\n".join(parts)

        if section_plain.strip():
            status: SiteAboutFetchStatus = "ok"
        else:
            status = "home_only"

        return SiteAboutFetchResult(
            status=status,
            final_home_url=final_home,
            about_page_chosen_url=about_url,
            home_text=home_plain,
            section_text=section_plain,
            text_for_llm=combined,
            pages_fetched=pages,
        )

    if client is not None:
        return run(client)
    with httpx.Client(
        timeout=REQUEST_TIMEOUT,
        headers={"User-Agent": USER_AGENT},
        limits=httpx.Limits(max_connections=5),
    ) as cl:
        return run(cl)
