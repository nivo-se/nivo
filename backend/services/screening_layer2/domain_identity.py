"""
Multi-query Tavily → domain clustering → first-party candidates for Layer 2.

Does not require a single pre-resolved homepage; optional CSV homepage boosts matching domain.
"""

from __future__ import annotations

import logging
import re
from collections import defaultdict
from dataclasses import dataclass
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

# ALL-CAPS words that look like tickers / brands (exclude common non-brand abbreviations).
_UPPER_BRAND_FALSE_POSITIVE = frozenset(
    {
        "CEO",
        "USA",
        "EU",
        "AB",
        "AS",
        "AG",
        "SA",
        "NV",
        "BV",
        "OY",
        "PLC",
        "LLC",
    }
)

_UPPER_BRAND_TOKEN_RE = re.compile(r"\b[A-ZÅÄÖ]{3,5}\b")


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


def _uppercase_brand_tokens(name: str) -> List[str]:
    """3–5 letter ALL-CAPS tokens (e.g. SCA, ICA, ABB) from the raw legal name."""
    out: List[str] = []
    for m in _UPPER_BRAND_TOKEN_RE.finditer(name or ""):
        w = m.group()
        if w in _UPPER_BRAND_FALSE_POSITIVE:
            continue
        out.append(w.lower())
    return out


def is_short_name_company(company_name: str) -> bool:
    """
    Short legal / ticker-style names where ≥4-char token rules fail (SCA, ABB, ICA, …).

    True when stripped core is very short, or when the name contains a 3–5 letter ALL-CAPS brand token.
    """
    core = company_name_core(company_name).strip()
    if not core:
        return False
    alnum = re.sub(r"[^\wåäöÅÄÖ]", "", core, flags=re.I)
    if 2 <= len(alnum) <= 4:
        return True
    return bool(_uppercase_brand_tokens(company_name))


def _short_name_brand_tokens(company_name: str) -> List[str]:
    """
    Lowercase brand tokens for domain alignment (only meaningful when is_short_name_company).
    Includes short core and ALL-CAPS tickers; deduped, min length 2.
    """
    if not is_short_name_company(company_name):
        return []
    seen: set[str] = set()
    out: List[str] = []
    core = company_name_core(company_name).strip()
    alnum = re.sub(r"[^\wåäöÅÄÖ]", "", core, flags=re.I).lower()
    if 2 <= len(alnum) <= 5:
        if alnum not in seen:
            seen.add(alnum)
            out.append(alnum)
    for t in _uppercase_brand_tokens(company_name):
        if t not in seen and len(t) >= 2:
            seen.add(t)
            out.append(t)
    return out


def brand_match_tokens_for_scoring(company_name: str) -> List[str]:
    """Name tokens used in score_domain_cluster (short-name path includes 2–5 char brands)."""
    if is_short_name_company(company_name):
        long = [t for t in _name_tokens(company_name) if len(t) >= 4]
        merged = list(dict.fromkeys(_short_name_brand_tokens(company_name) + long))
        return [t for t in merged if len(t) >= 2]
    return [t for t in _name_tokens(company_name) if len(t) >= 4]


def official_pick_tokens(company_name: str) -> List[str]:
    """Tokens for picking an official URL from Tavily rows (includes short tickers when applicable)."""
    return brand_match_tokens_for_scoring(company_name)


def _domain_name_labels(d: str) -> List[str]:
    """Split host-ish string into dot/hyphen labels (lowercase)."""
    s = (d or "").lower().strip()
    if not s:
        return []
    return [x for x in re.split(r"[.\-]", s) if x]


def _short_brand_matches_domain_stem(t: str, stem: str, d: str, blob: str) -> bool:
    """
    Strict alignment for 2–5 char brands: avoid substring false positives (e.g. sca in scandinavian).

    Uses registrable stem equality, label equality, or bounded prefix on a single label (icagruppen).
    """
    tl = (t or "").lower()
    sl = (stem or "").lower()
    if len(tl) < 2:
        return False
    if tl == sl:
        return True
    if len(tl) >= 4 and (tl in (d or "").lower() or tl in (blob or "").lower()):
        return True
    for lab in _domain_name_labels(d) + _domain_name_labels(blob):
        if lab == tl:
            return True
        if len(tl) >= 3 and lab.startswith(tl) and len(lab) <= len(tl) + 7:
            return True
    return False


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


def _target_tokens_for_entity_match(company_name: str) -> List[str]:
    """Distinct name tokens (≥3 chars) from legal-stripped core; used for entity mismatch checks."""
    core = company_name_core(company_name)
    seen: set[str] = set()
    out: List[str] = []
    for t in _name_tokens(core):
        if len(t) < 3:
            continue
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out


def _token_as_word_in_text(token: str, text_lower: str) -> bool:
    """True if `token` appears as a whole word in text (avoids substring false positives)."""
    if len(token) < 3 or not text_lower:
        return False
    try:
        return bool(
            re.search(r"(?<!\w)" + re.escape(token) + r"(?!\w)", text_lower, flags=re.IGNORECASE)
        )
    except re.error:
        return token.lower() in text_lower


def _target_token_matches_domain(token: str, domain_lower: str) -> bool:
    """Substring match on registrable domain (labels are short; substring is intentional)."""
    return bool(token and token in domain_lower)


def should_remove_entity_mismatch_domain(
    domain: str,
    hits: Sequence[TavilyHit],
    company_name: str,
) -> bool:
    """
    Hard-remove a domain cluster when Tavily title/snippet describe a *different* brand than the
    target company: no target tokens in domain or text, but the domain's brand stem clearly
    appears in titles/snippets (e.g. Innofactor winning for Cramo). Not a score penalty — drop entirely.
    """
    tokens = _target_tokens_for_entity_match(company_name)
    if not tokens:
        return False

    d_lower = (domain or "").lower().strip()
    if not d_lower:
        return False

    blob = " ".join(f"{h.title} {h.content}" for h in hits).lower()
    blob = blob[:8000]
    titles = " ".join((h.title or "").lower() for h in hits)

    for t in tokens:
        if _target_token_matches_domain(t, d_lower):
            return False
        if _token_as_word_in_text(t, blob):
            return False

    dom_stem = _brand_stem_loose(domain)
    if len(dom_stem) < 5:
        return False

    for t in tokens:
        if len(t) >= 3 and (t in dom_stem or dom_stem in t):
            return False

    if dom_stem not in titles and dom_stem not in blob:
        return False

    return True


def filter_grouped_domains_entity_mismatch(
    grouped: Dict[str, List[TavilyHit]],
    company_name: str,
) -> Dict[str, List[TavilyHit]]:
    """Drop domain clusters that are clearly about another company (hard filter, not scoring)."""
    out: Dict[str, List[TavilyHit]] = {}
    for dom, hits in (grouped or {}).items():
        if should_remove_entity_mismatch_domain(dom, hits, company_name):
            logger.info(
                "layer2_entity_mismatch_drop domain=%s company=%s",
                dom,
                (company_name or "")[:100],
            )
            continue
        out[dom] = hits
    return out


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
    tokens = brand_match_tokens_for_scoring(company_name)
    blob = " ".join(
        f"{h.title} {h.content}".lower() for h in hits
    )
    name_hits = 0
    for t in tokens:
        if not t:
            continue
        if len(t) <= 4:
            if len(t) >= 3 and _token_as_word_in_text(t, blob):
                name_hits += 1
            elif len(t) == 2 and t in blob:
                name_hits += 1
        else:
            if t in blob:
                name_hits += 1
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

# Trusted identity: relax *only* when explicitly allowed (Layer 1 / CSV / strong cluster), not globally.
STAGE1_TRUSTED_MIN_SCORE = 82.0
TRUSTED_STRONG_DELTA = 0.35
TRUSTED_GAP_DELTA = 0.12
# Among first-party clusters, top must clearly beat #2 to ignore a different-brand runner-up.
TRUSTED_FP_DOMINANCE_GAP = 0.35
# "Very strong cluster" — high score + repeated Tavily hits (not a global threshold cut).
TRUSTED_CLUSTER_MIN_HITS = 3
TRUSTED_CLUSTER_SCORE_BONUS = 0.85


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
    if is_short_name_company(company_name):
        for t in _short_name_brand_tokens(company_name):
            if len(t) < 2:
                continue
            pin = _short_brand_matches_domain_stem(t, sp, p, p.replace(".", ""))
            oin = _short_brand_matches_domain_stem(t, so, o, o.replace(".", ""))
            if pin and oin:
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
    stem = _brand_stem_loose(domain)
    blob = d.replace("-", "")

    if is_short_name_company(company_name):
        for t in _short_name_brand_tokens(company_name):
            if _short_brand_matches_domain_stem(t, stem, d, blob):
                return True
        for t in [x for x in _name_tokens(company_name) if len(x) >= 4]:
            if t in d or t in blob:
                return True
            if len(stem) >= 4 and (t in stem or stem in t):
                return True
        return False

    tokens = [t for t in _name_tokens(company_name) if len(t) >= 4]
    if not tokens:
        return True
    for t in tokens:
        if t in d or t in blob:
            return True
        if len(stem) >= 4 and (t in stem or stem in t):
            return True
    return False


def homepage_hint_matches_top_cluster(
    homepage_hint: Optional[str],
    top_domain: str,
    company_name: str,
) -> bool:
    """True when CSV/homepage URL registrable domain aligns with the top clustered first-party domain."""
    if not homepage_hint or not top_domain:
        return False
    raw = (homepage_hint or "").strip()
    if not raw.startswith(("http://", "https://")):
        raw = "https://" + raw
    try:
        p = urlparse(raw)
    except Exception:
        return False
    if not p.netloc:
        return False
    hdom = registrable_domain(p.netloc)
    td = top_domain.lower().strip()
    if hdom == td:
        return True
    return same_brand_family(hdom, top_domain, company_name)


def competing_entity_detected(
    ranked_fp_only: Sequence[Tuple[str, float, List[TavilyHit]]],
    company_name: str,
) -> bool:
    """
    True when two first-party clusters are score-near and clearly different brands (ambiguous winner).
    Disables trusted-identity relaxation — never overrides entity-mismatch removal.
    """
    if len(ranked_fp_only) < 2:
        return False
    gap = ranked_fp_only[0][1] - ranked_fp_only[1][1]
    if gap > TRUSTED_FP_DOMINANCE_GAP:
        return False
    return not same_brand_family(ranked_fp_only[0][0], ranked_fp_only[1][0], company_name)


def very_strong_cluster_signal(score: float, hits: Sequence[TavilyHit]) -> bool:
    """High aggregate score plus multiple Tavily hits on the same domain (coherent cluster)."""
    n = len(hits)
    if n >= TRUSTED_CLUSTER_MIN_HITS and score >= STRONG_DOMAIN_SCORE + TRUSTED_CLUSTER_SCORE_BONUS:
        return True
    if n >= 4 and score >= STRONG_DOMAIN_SCORE + 0.55:
        return True
    return False


def compute_trusted_identity(
    company_name: str,
    *,
    homepage_hint: Optional[str],
    stage1_total_score: Optional[float],
    ranked_fp_only: Sequence[Tuple[str, float, List[TavilyHit]]],
    ranked_no_block: Sequence[Tuple[str, float, List[TavilyHit]]],
) -> bool:
    """
    Narrow path to relax strict identity checks for large caps / CSV hints / very strong clusters.
    Never true for blocked/supporting tops, brand mismatch, or competing-entity ambiguity.
    """
    if not ranked_fp_only:
        return False
    if competing_entity_detected(ranked_fp_only, company_name):
        return False
    top_dom, top_sc, top_hits = ranked_fp_only[0]
    if post_cluster_domain_blocked(top_dom) or is_supporting_domain(top_dom):
        return False
    if not domain_has_brand_keyword_match(top_dom, company_name):
        return False

    if stage1_total_score is not None and float(stage1_total_score) >= STAGE1_TRUSTED_MIN_SCORE:
        return True
    if homepage_hint_matches_top_cluster(homepage_hint, top_dom, company_name):
        return True
    if very_strong_cluster_signal(top_sc, top_hits):
        return True
    return False


def compute_layer2_identity_low(
    ranked_fp_only: Sequence[Tuple[str, float, List[TavilyHit]]],
    ranked_no_block: Sequence[Tuple[str, float, List[TavilyHit]]],
    company_name: str,
    *,
    homepage_verified: bool,
    had_top_fp_candidate: bool,
    trusted_identity: bool = False,
) -> bool:
    """
    Low confidence when clusters are weak, top-two disagree, or we could not verify a homepage on-cluster.
    ``trusted_identity`` slightly relaxes cuts only when compute_trusted_identity was true (no competing entity).
    """
    if not ranked_fp_only:
        return True
    top_dom = ranked_fp_only[0][0]
    if not domain_has_brand_keyword_match(top_dom, company_name):
        return True
    top_score = ranked_fp_only[0][1]
    strong_cut = STRONG_DOMAIN_SCORE - (TRUSTED_STRONG_DELTA if trusted_identity else 0.0)
    gap_cut = MIN_TOP2_GAP - (TRUSTED_GAP_DELTA if trusted_identity else 0.0)
    if top_score < strong_cut:
        return True
    if len(ranked_fp_only) >= 2:
        if ranked_fp_only[0][1] - ranked_fp_only[1][1] < gap_cut:
            return True
    if len(ranked_no_block) >= 2:
        if not same_brand_family(ranked_no_block[0][0], ranked_no_block[1][0], company_name):
            if trusted_identity:
                if len(ranked_fp_only) <= 1:
                    pass
                else:
                    fp_gap = ranked_fp_only[0][1] - ranked_fp_only[1][1]
                    if fp_gap < TRUSTED_FP_DOMINANCE_GAP:
                        return True
            else:
                return True
    if had_top_fp_candidate and not homepage_verified:
        if trusted_identity:
            if top_score >= STRONG_DOMAIN_SCORE:
                return False
            return True
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
    trusted_identity: bool = False,
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
        trusted_identity=trusted_identity,
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
