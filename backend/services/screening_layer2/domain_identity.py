"""
Multi-query Tavily → domain clustering → first-party candidates for Layer 2.

Does not require a single pre-resolved homepage; optional CSV homepage boosts matching domain.
"""

from __future__ import annotations

import logging
import re
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Tuple
from urllib.parse import urlparse

from backend.services.shortlist_homepage_resolver.resolver import homepage_domain_is_blocklisted

logger = logging.getLogger(__name__)

# Extra hosts (beyond resolver blocklist) — data/research/vendor surfaces that must not rank as first-party.
_LAYER2_POST_CLUSTER_EXTRA_SUBSTR: Tuple[str, ...] = (
    "globaldata.com",
    "globaldata.",
    "ibisworld.com",
    "news-medical.net",
    "encyclopedia.com",
    "contentstack.com",
    "imit.se",
)

# Not the company site: media, PR, regional portals, supplier/exhibitor marketplaces, distributors we never treat as home.
_SUPPORTING_DOMAIN_SUBSTR: Tuple[str, ...] = (
    "linkedin.com",
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "x.com",
    "youtube.com",
    "mfn.se",
    "mynewsdesk.com",
    "fraktlogistik.se",
    "qimtek.se",
    "gnosjoregion.se",
    "tribotec.se",
    "kompass.com",
    "rocketreach.co",
    "glassdoor.",
    "indeed.com",
    "dealroom.co",
    "funderbeam.com",
)

# Product / industry hints (English + Swedish) for domain scoring
_PRODUCT_INDUSTRY_RE = re.compile(
    r"\b(product|produkt|produkter|manufactur|tillverk|industr|oem|brand|varum|"
    r"machine|maskin|component|komponent|solution|system|b2b|export)\b",
    re.I,
)

_STOP_NAME_PARTS = frozenset(
    {"aktiebolag", "bolag", "ab", "holding", "group", "sverige", "sweden", "the", "inc", "ltd"}
)


@dataclass
class TavilyHit:
    url: str
    title: str
    content: str
    score: float


def _name_tokens(company_name: str) -> List[str]:
    parts = re.split(r"[^\wåäöÅÄÖ]+", company_name, flags=re.I)
    return [
        p.lower()
        for p in parts
        if len(p) >= 3 and p.lower() not in _STOP_NAME_PARTS
    ]


def registrable_domain(netloc: str) -> str:
    """Collapse www.foo.bar.se → bar.se (simple two-label TLD heuristic for Nordic SMEs)."""
    h = (netloc or "").lower().split("@")[0].split(":")[0]
    if h.startswith("www."):
        h = h[4:]
    parts = [x for x in h.split(".") if x]
    if len(parts) < 2:
        return h
    return ".".join(parts[-2:])


# Query index metadata for ``layer2_raw`` envelopes (secondary / primary roles).
TAVILY_QUERY_INDEX_IDENTITY = 0
TAVILY_QUERY_INDEX_PRIMARY_SEMANTIC = 1

_LEGAL_NAME_SUFFIX_RE = re.compile(
    r"\s*,?\s*(AB|Aktiebolag|A\.B\.|Ltd\.?|Limited|Inc\.?|Corp\.?|Corporation|Group|Holding)\s*$",
    re.I,
)


def company_name_core(company_name: str) -> str:
    """Strip common legal suffixes for short product/identity queries."""
    s = (company_name or "").strip()
    if not s:
        return ""
    s = _LEGAL_NAME_SUFFIX_RE.sub("", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s or (company_name or "").strip()


def tavily_low_credit_primary_query(company_name: str) -> str:
    """Primary Tavily query (always run in efficient Layer 2)."""
    core = company_name_core(company_name)
    return f'"{core}" what does the company do products Sweden'


def tavily_secondary_official_website_query(company_name: str) -> str:
    """Optional second Tavily query when first-party signal or homepage verification is weak."""
    core = company_name_core(company_name)
    return f'"{core}" official website'


def merge_tavily_result_hits(
    raw_lists: Sequence[list],
    max_hits: int = 15,
) -> List[TavilyHit]:
    """Dedupe by URL; keep highest Tavily score; cap total."""
    by_url: Dict[str, TavilyHit] = {}
    for results in raw_lists:
        for r in results or []:
            url = (getattr(r, "url", None) or "").strip()
            if not url.startswith("http"):
                continue
            title = (getattr(r, "title", None) or "").strip()
            content = (getattr(r, "content", None) or "").strip()
            sc = float(getattr(r, "score", None) or 0.0)
            nu = url.split("#")[0].rstrip("/")
            if nu not in by_url or sc > by_url[nu].score:
                by_url[nu] = TavilyHit(url=url, title=title, content=content, score=sc)
    merged = sorted(by_url.values(), key=lambda h: -h.score)
    return merged[:max_hits]


def group_hits_by_domain(hits: Sequence[TavilyHit]) -> Dict[str, List[TavilyHit]]:
    g: Dict[str, List[TavilyHit]] = defaultdict(list)
    for h in hits:
        host = urlparse(h.url).netloc
        if not host:
            continue
        dom = registrable_domain(host)
        g[dom].append(h)
    return dict(g)


def _blocked_first_party_domain(domain: str, blocked_substrings: Tuple[str, ...]) -> bool:
    d = domain.lower()
    return any(b in d for b in blocked_substrings)


def score_domain_cluster(
    domain: str,
    hits: Sequence[TavilyHit],
    company_name: str,
    *,
    homepage_hint_domain: Optional[str],
    blocked_substrings: Tuple[str, ...],
) -> float:
    """
    Score a domain cluster: frequency, name/title/content match, product keywords, Tavily scores.
    """
    if _blocked_first_party_domain(domain, blocked_substrings):
        return -1e9
    n = len(hits)
    if n == 0:
        return -1e9
    freq = min(1.0, n / 5.0)
    tokens = [t for t in _name_tokens(company_name) if len(t) >= 4]
    blob = " ".join(
        f"{h.title} {h.content}".lower() for h in hits
    )
    name_hits = sum(1 for t in tokens if t in blob)
    name_score = min(1.0, name_hits / max(len(tokens), 1)) if tokens else 0.2
    prod_bonus = 0.35 if _PRODUCT_INDUSTRY_RE.search(blob) else 0.0
    avg_tav = sum(h.score for h in hits) / max(n, 1)
    # Do not let CSV/homepage hints float a weak cluster into "top" over conflicting evidence.
    hint_boost = 0.0
    if homepage_hint_domain:
        base_ok = freq >= 0.4 or name_score >= 0.22 or n >= 2
        if base_ok:
            hdom = homepage_hint_domain.lower().strip()
            if hdom and (hdom == domain or hdom.endswith("." + domain) or domain.endswith("." + hdom)):
                hint_boost = 2.5
            elif hdom in domain or domain in hdom:
                hint_boost = 2.0
    return 3.0 * freq + 2.2 * name_score + prod_bonus + 0.55 * avg_tav + hint_boost


def rank_domains(
    grouped: Dict[str, List[TavilyHit]],
    company_name: str,
    *,
    homepage_hint: Optional[str],
    blocked_substrings: Tuple[str, ...],
) -> List[Tuple[str, float, List[TavilyHit]]]:
    hint_dom: Optional[str] = None
    if homepage_hint:
        p = urlparse(homepage_hint if homepage_hint.startswith("http") else "https://" + homepage_hint)
        if p.netloc:
            hint_dom = registrable_domain(p.netloc)
    scored: List[Tuple[str, float, List[TavilyHit]]] = []
    for dom, hits in grouped.items():
        s = score_domain_cluster(
            dom,
            hits,
            company_name,
            homepage_hint_domain=hint_dom,
            blocked_substrings=blocked_substrings,
        )
        if s > -1e8:
            scored.append((dom, s, hits))
    scored.sort(key=lambda x: -x[1])
    return scored


def pick_linkedin_snippets(all_hits: Sequence[TavilyHit], max_snips: int = 2) -> List[TavilyHit]:
    out: List[TavilyHit] = []
    for h in all_hits:
        if "linkedin.com" in (h.url or "").lower() and h.content.strip():
            out.append(h)
            if len(out) >= max_snips:
                break
    return out


# Stricter than raw clustering strength: only "clear" first-party signal counts for canonical homepage.
STRONG_DOMAIN_SCORE = 4.15
MIN_TOP2_GAP = 0.45


def best_url_for_domain(hits: Sequence[TavilyHit]) -> Optional[str]:
    if not hits:
        return None
    return max(hits, key=lambda h: h.score).url


def post_cluster_domain_blocked(domain: str) -> bool:
    """Aggregator / junk / research DB — remove from ranked clusters (post-cluster)."""
    d = (domain or "").lower().strip()
    if not d:
        return True
    if homepage_domain_is_blocklisted(d):
        return True
    return any(b in d for b in _LAYER2_POST_CLUSTER_EXTRA_SUBSTR)


def is_supporting_domain(domain: str) -> bool:
    """Not eligible as company homepage: social, PR, media, regional portals, marketplaces."""
    d = (domain or "").lower().strip()
    if not d:
        return True
    return any(b in d for b in _SUPPORTING_DOMAIN_SUBSTR)


def _brand_stem_loose(domain: str) -> str:
    """First label of registrable domain, punctuation stripped (mille-notti → millenotti)."""
    d = domain.lower().strip()
    if d.startswith("www."):
        d = d[4:]
    parts = [p for p in d.split(".") if p]
    if not parts:
        return ""
    label = parts[0]
    return re.sub(r"[^a-z0-9åäö]", "", label)


def same_brand_family(primary: str, other: str, company_name: str) -> bool:
    """
    True if `other` could plausibly be the same company/brand family as `primary`
    (alternate TLD, hyphen variant, sub-brand on same stem).
    """
    p = (primary or "").lower().strip()
    o = (other or "").lower().strip()
    if not p or not o:
        return False
    if p == o:
        return True
    sp = _brand_stem_loose(p)
    so = _brand_stem_loose(o)
    if len(sp) >= 4 and len(so) >= 4 and sp == so:
        return True
    if len(sp) >= 5 and len(so) >= 5 and (sp in so or so in sp):
        return True
    if len(so) >= 3 and so in sp:
        return True
    if len(sp) >= 3 and sp in so:
        return True
    tokens = [t for t in _name_tokens(company_name) if len(t) >= 4]
    for t in tokens:
        if t in sp and t in so:
            return True
    return False


def domain_has_brand_keyword_match(domain: str, company_name: str) -> bool:
    """
    True if the registrable domain plausibly reflects the legal entity name.
    Used to avoid treating an arbitrary high-scoring cluster as first-party without lexical alignment.
    """
    d = (domain or "").lower().strip()
    if not d:
        return False
    tokens = [t for t in _name_tokens(company_name) if len(t) >= 4]
    if not tokens:
        return True
    stem = _brand_stem_loose(domain)
    blob = d.replace("-", "")
    for t in tokens:
        if t in d or t in blob:
            return True
        if len(stem) >= 4 and (t in stem or stem in t):
            return True
    return False


def compute_layer2_identity_low(
    ranked_fp_only: Sequence[Tuple[str, float, List[TavilyHit]]],
    ranked_no_block: Sequence[Tuple[str, float, List[TavilyHit]]],
    company_name: str,
    *,
    homepage_verified: bool,
    had_top_fp_candidate: bool,
) -> bool:
    """
    Low confidence when clusters are weak, top-two disagree, or we could not verify a homepage on-cluster.
    """
    if not ranked_fp_only:
        return True
    top_dom = ranked_fp_only[0][0]
    if not domain_has_brand_keyword_match(top_dom, company_name):
        return True
    top_score = ranked_fp_only[0][1]
    if top_score < STRONG_DOMAIN_SCORE:
        return True
    if len(ranked_fp_only) >= 2:
        if ranked_fp_only[0][1] - ranked_fp_only[1][1] < MIN_TOP2_GAP:
            return True
    if len(ranked_no_block) >= 2:
        if not same_brand_family(ranked_no_block[0][0], ranked_no_block[1][0], company_name):
            return True
    if had_top_fp_candidate and not homepage_verified:
        return True
    return False


def identity_low_confidence(ranked: Sequence[Tuple[str, float, List[TavilyHit]]]) -> bool:
    """Legacy: weak top score or tight top-2 gap on the given ranking only."""
    if not ranked:
        return True
    top = ranked[0][1]
    if top < STRONG_DOMAIN_SCORE:
        return True
    if len(ranked) >= 2:
        if ranked[0][1] - ranked[1][1] < MIN_TOP2_GAP:
            return True
    return False


# Borderline top-cluster scores still warrant an official-site query to reduce wrong-domain drift.
_SECONDARY_TAVILY_BORDERLINE_BELOW = STRONG_DOMAIN_SCORE + 0.4


def secondary_identity_tavily_recommended(
    ranked_fp_only: Sequence[Tuple[str, float, List[TavilyHit]]],
    ranked_no_block: Sequence[Tuple[str, float, List[TavilyHit]]],
    company_name: str,
    *,
    homepage_verified: bool,
) -> bool:
    """
    Second Tavily (official-website) query when primary-only identity is ambiguous or borderline-strong.
    Prefer extra retrieval over a wrong first-party URL.
    """
    if compute_layer2_identity_low(
        ranked_fp_only,
        ranked_no_block,
        company_name,
        homepage_verified=homepage_verified,
        had_top_fp_candidate=bool(ranked_fp_only),
    ):
        return True
    if ranked_fp_only:
        top_s = ranked_fp_only[0][1]
        if top_s < _SECONDARY_TAVILY_BORDERLINE_BELOW:
            return True
    return False


def collect_supporting_domains_from_hits(hits: Sequence[TavilyHit]) -> List[str]:
    """Distinct registrable domains that are supporting-only (not first-party candidates)."""
    seen: set[str] = set()
    out: List[str] = []
    for h in hits:
        try:
            host = urlparse(h.url).netloc
        except Exception:
            continue
        if not host:
            continue
        dom = registrable_domain(host)
        if post_cluster_domain_blocked(dom) or not is_supporting_domain(dom):
            continue
        if dom not in seen:
            seen.add(dom)
            out.append(dom)
    return sorted(out)
