#!/usr/bin/env python3
"""
Deterministic screening v1: similarity to liked companies (multi-centroid), CSV export, calibration.

No API, no LLM, no persistence beyond optional CSV output.

Stage 1 → Layer 2 (production shortlist)
  This script is the **only** supported source CSV for `shortlist_200.csv` used by the controlled
  Layer 2 pipeline. After export, **manually inspect** orgnr and company_name, then run:
    PYTHONPATH=. python3 scripts/screening_controlled_layer2_pipeline.py --out-dir layer2_out_200
  Do **not** use `scripts/fixtures/layer2_*.csv` for production evaluation.

  Example:
    PYTHONPATH=. python3 scripts/screening_rank_v1.py --out shortlist_200.csv --top 200

  With `--out`, also writes `shortlist_200_manifest.json` (same stem + `_manifest.json`) for reproducibility.

  After changing Layer 1 rules, re-export shortlist_200.csv and **manually review the top ~50**
  rows (names + orgnr) before running Layer 2.

Usage:
  python3 scripts/screening_rank_v1.py --out /tmp/rank.csv --top 300
  python3 scripts/screening_rank_v1.py --out /tmp/rank.csv --legacy-scores
  python3 scripts/screening_rank_v1.py --calibrate --config scripts/fixtures/screening_v1_calibration.yaml
  python3 scripts/screening_rank_v1.py --calibrate ... --legacy-scores   # mode B

Requires: pandas, numpy, psycopg2-binary, pyyaml (backend requirements).
Load DATABASE_URL or SUPABASE_DB_URL or POSTGRES_* from environment; optional .env at repo root.
"""

from __future__ import annotations

import argparse
import math
import os
import re
import statistics
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple

import numpy as np
import pandas as pd
import yaml

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None  # type: ignore[misc, assignment]

try:
    import psycopg2
except ImportError as e:
    raise SystemExit("psycopg2-binary is required. Install backend requirements.") from e


REPO_ROOT = Path(__file__).resolve().parents[1]
_SCRIPTS_DIR = Path(__file__).resolve().parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from screening_manifest_utils import git_commit_hash, sha256_file, utc_timestamp_iso, write_json  # noqa: E402

SCREENING_RANK_V1_VERSION = "1.0.0"

# --- Layer 1 hard name exclusions (always on; YAML may add more via name_exclusion_keywords) ---
_L1_HARD_OPERATING_KEYWORDS: Tuple[str, ...] = (
    "holding",
    "förvaltning",
    "forvaltning",
    "fastighet",
    "fastigheter",
    "finance",
    "finans",
    "family",
)

_L1_HARD_SERVICE_KEYWORDS: Tuple[str, ...] = (
    "service",
    "montage",
    "installation",
    "installations",
    "entreprenad",
    "bygg",
    "elservice",
    "elteknik",
    "el",
    "kyl",
    "kyla",
    "kylkontroll",
    "kylservice",
    "rör",
    "ror",
    "vvs",
    "verkstad",
    "åkeri",
    "akeri",
    "konsult",
    "consulting",
    "facility",
    "management",
    "golvservice",
)

# Suffix patterns on casefolded legal name (regional / shell / systems entities).
_L1_SHELL_NAME_SUFFIXES: Tuple[str, ...] = (
    " sverige ab",
    " sweden ab",
    " svenska ab",
    " scandinavia ab",
    " systems ab",
    " systems",
)

# Default orgnr denylist (majors / irrelevant globals); merge with YAML hard_exclusion_orgnrs.
_DEFAULT_L1_HARD_ORGNRS: frozenset[str] = frozenset(
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

# Product / manufacturing / operator name signals — boost and/or optional require-gate (liked orgnrs exempt).
_L1_DEFAULT_PRODUCT_SIGNAL_KEYWORDS: Tuple[str, ...] = (
    "pumps",
    "pump",
    "hydraulik",
    "hydraulic",
    "automation",
    "gjuteri",
    "lights",
    "lighting",
    "therm",
    "navigation",
    "förpackning",
    "forpackning",
    "packaging",
    "tillverkning",
    "manufacturing",
    "manufacturer",
    "fabrik",
    "factory",
    "produktion",
    "maskin",
    "verktyg",
    "utrustning",
    "instrument",
    "sensor",
    "polymer",
    "komponent",
    "component",
    "industri",
    "industrial",
    "OEM",
    "livsmedel",
    "foodtech",
    "fiske",
    "fishing",
    "outdoor",
    "sport",
    "kem",
    "chemical",
    "coating",
    "seal",
    "sealing",
    "filter",
    "ventilation",
    "elektronik",
    "electronic",
    "kabel",
    "cable",
    "robot",
    "medtech",
    "medical",
)

# Default similarity sharpness if YAML scoring.alpha missing
DEFAULT_ALPHA = 0.45
# Default cap on combined multiplicative penalty (YAML scoring.max_combined_penalty overrides)
DEFAULT_MAX_COMBINED_PENALTY = 0.85

# Whole-token match only (avoid "electric", "marknadsföring", "automation" false positives)
_SHORT_TOKEN_KEYWORDS = frozenset({"el", "mark", "mat"})

# (substring, weight) — substring match on casefolded name unless token is in _SHORT_TOKEN_KEYWORDS
_SI_SUBSTRING_WEIGHTS: Tuple[Tuple[str, float], ...] = (
    ("bygg", 2.0),
    ("vvs", 2.0),
    ("installation", 2.0),
    ("installations", 2.0),
    ("anläggning", 2.0),
    ("anlaggning", 2.0),
    ("entreprenad", 2.0),
    ("varme", 2.0),
    ("värme", 2.0),
    ("kyla", 2.0),
    ("elservice", 2.0),
    ("grossist", 2.0),
    ("grossisten", 2.0),
    ("transport", 2.0),
    ("åkeri", 2.0),
    ("verkstad", 2.0),
    ("plåt", 1.5),
    ("smide", 1.5),
    ("kylservice", 2.0),
    ("golvservice", 2.0),
    ("konsult", 1.5),
    ("consulting", 1.5),
    ("management", 1.5),
    ("service", 1.0),
    ("tjänst", 1.5),
    ("hotel", 2.0),
    ("osteria", 2.0),
    ("rör", 2.0),
)

_SI_TOKEN_WEIGHTS: Tuple[Tuple[str, float], ...] = (
    ("el", 1.5),
    ("mark", 2.0),
)

_SI_WEAK_MARGIN_NAME_HINTS = (
    "service",
    "konsult",
    "installation",
    "bygg",
    "entreprenad",
    "vvs",
    "åkeri",
    "consulting",
    "anläggning",
    "anlaggning",
    "varme",
    "värme",
    "elservice",
)

# Internal feature keys -> (source column, apply_log_to_raw)
_BASE_FEATURE_SPECS: List[Tuple[str, str, bool]] = [
    ("log_revenue", "latest_revenue_sek", True),
    ("revenue_cagr_3y", "revenue_cagr_3y", False),
    ("avg_ebitda_margin", "avg_ebitda_margin", False),
    ("avg_ebit_margin", "avg_ebit_margin", False),
    ("avg_net_margin", "avg_net_margin", False),
    ("employees_latest", "employees_latest", False),
    ("revenue_per_employee", "revenue_per_employee", False),
    ("equity_ratio_latest", "equity_ratio_latest", False),
]

_LEGACY_FEATURE_SPECS: List[Tuple[str, str, bool]] = [
    ("fit_score", "fit_score", False),
    ("ops_upside_score", "ops_upside_score", False),
    ("nivo_total_score", "nivo_total_score", False),
]


def _connect():
    url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
    if url:
        return psycopg2.connect(url, connect_timeout=30)
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5433")),
        dbname=os.getenv("POSTGRES_DB", "nivo"),
        user=os.getenv("POSTGRES_USER", "nivo"),
        password=os.getenv("POSTGRES_PASSWORD", "nivo"),
        connect_timeout=30,
    )


def load_features_dataframe() -> pd.DataFrame:
    conn = _connect()
    try:
        return pd.read_sql_query("SELECT * FROM public.screening_features_v1", conn)
    finally:
        conn.close()


def _load_yaml(path: Path) -> Dict[str, Any]:
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def _calendar_year_utc() -> int:
    return datetime.now(timezone.utc).year


def _nace_deny_prefixes(cfg: Dict[str, Any]) -> List[str]:
    constraints = cfg.get("constraints") or {}
    raw = constraints.get("nace_deny_prefixes")
    if raw is None:
        raw = cfg.get("nace_deny_prefixes") or []
    return [str(x).strip() for x in raw if str(x).strip()]


def _name_lower(row: pd.Series) -> str:
    n = row.get("company_name")
    if n is None or (isinstance(n, float) and math.isnan(n)):
        return ""
    return str(n).casefold()


def _name_tokens(name_lc: str) -> Set[str]:
    if not name_lc:
        return set()
    parts = re.split(r"[^a-zåäö0-9]+", name_lc)
    return {p for p in parts if p}


def keyword_matches_name(name_lc: str, keyword: str, tokens: Optional[Set[str]] = None) -> bool:
    """Substring match, except short ambiguous tokens (el, mark, mat) require whole-token match."""
    k = str(keyword).strip().casefold()
    if not k:
        return False
    if " " in k:
        return k in name_lc
    if k in _SHORT_TOKEN_KEYWORDS:
        t = tokens if tokens is not None else _name_tokens(name_lc)
        return k in t
    return k in name_lc


def name_exclusion_hit(name_lc: str, cfg: Dict[str, Any]) -> Optional[str]:
    """First matching exclusion keyword, or None."""
    tokens = _name_tokens(name_lc)
    for kw in cfg.get("name_exclusion_keywords") or []:
        if keyword_matches_name(name_lc, str(kw), tokens):
            return str(kw).strip().casefold()
    return None


def _norm_orgnr_digits(raw: Any) -> str:
    return re.sub(r"\D", "", str(raw or "").strip())


def _merged_hard_orgnr_denyset(cfg: Dict[str, Any]) -> Set[str]:
    out: Set[str] = {x for x in _DEFAULT_L1_HARD_ORGNRS if x}
    for x in cfg.get("hard_exclusion_orgnrs") or []:
        o = _norm_orgnr_digits(x)
        if o:
            out.add(o)
    return out


def _hard_company_name_exact_set(cfg: Dict[str, Any]) -> Set[str]:
    return {str(x).strip().casefold() for x in (cfg.get("hard_exclusion_company_names") or []) if str(x).strip()}


def _layer1_operating_keyword_hit(name_lc: str, cfg: Dict[str, Any]) -> Optional[str]:
    extra = cfg.get("layer1_extra_operating_exclusion_keywords") or []
    tokens = _name_tokens(name_lc)
    seq = list(_L1_HARD_OPERATING_KEYWORDS) + [str(x).strip() for x in extra if str(x).strip()]
    for kw in seq:
        if keyword_matches_name(name_lc, kw, tokens):
            return kw.strip().casefold()
    return None


def _layer1_service_keyword_hit(name_lc: str, cfg: Dict[str, Any]) -> Optional[str]:
    extra = cfg.get("layer1_extra_service_exclusion_keywords") or []
    tokens = _name_tokens(name_lc)
    seq = list(_L1_HARD_SERVICE_KEYWORDS) + [str(x).strip() for x in extra if str(x).strip()]
    for kw in seq:
        if keyword_matches_name(name_lc, kw, tokens):
            return kw.strip().casefold()
    return None


def _shell_suffix_hit(name_lc: str) -> Optional[str]:
    n = name_lc.strip()
    for suf in _L1_SHELL_NAME_SUFFIXES:
        if n.endswith(suf):
            return suf.strip()
    return None


def _orgnr_in_calibration_likes(orgnr: Any, cfg: Dict[str, Any]) -> bool:
    o = _norm_orgnr_digits(orgnr)
    if not o:
        return False
    liked = {_norm_orgnr_digits(x) for x in (cfg.get("liked_orgnrs") or [])}
    if o in liked:
        return True
    for arch in cfg.get("archetypes") or []:
        if o in {_norm_orgnr_digits(x) for x in (arch.get("liked_orgnrs") or [])}:
            return True
    return False


def _has_product_name_signal(name_lc: str, cfg: Dict[str, Any]) -> bool:
    tokens = _name_tokens(name_lc)
    extra = cfg.get("product_signal_keywords") or []
    seq = list(_L1_DEFAULT_PRODUCT_SIGNAL_KEYWORDS) + [str(x).strip() for x in extra if str(x).strip()]
    for kw in seq:
        if keyword_matches_name(name_lc, kw, tokens):
            return True
    return False


def name_rule_penalties(name_lc: str, cfg: Dict[str, Any]) -> Tuple[float, List[str]]:
    """
    Sum penalties from name_penalty_keywords (each rule fires at most once if any keyword matches).
    Returns (raw_sum, flag_labels) — caller caps with max_combined_penalty together with service penalty.
    """
    raw = cfg.get("name_penalty_keywords") or {}
    total = 0.0
    flags: List[str] = []
    if not isinstance(raw, dict):
        return total, flags
    tokens = _name_tokens(name_lc)
    for rule_id, spec in raw.items():
        if not isinstance(spec, dict):
            continue
        try:
            pen = float(spec.get("penalty", 0))
        except (TypeError, ValueError):
            continue
        kws = spec.get("keywords") or []
        hit = False
        for kw in kws:
            if keyword_matches_name(name_lc, str(kw), tokens):
                hit = True
                break
        if hit and pen > 0:
            total += pen
            flags.append(f"name_penalty:{rule_id}")
    return total, flags


def _margin_as_ratio(val: Any) -> Optional[float]:
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return None
    try:
        x = float(val)
    except (TypeError, ValueError):
        return None
    if x > 1.0:
        x = x / 100.0
    return x


def compute_service_indicator(row: pd.Series) -> float:
    """Trade / service tilt from name (strong weights) + light financial hints. No product subtract."""
    name_lc = _name_lower(row)
    if not name_lc:
        return 0.0
    tokens = _name_tokens(name_lc)
    ind = 0.0
    for kw, w in _SI_TOKEN_WEIGHTS:
        if keyword_matches_name(name_lc, kw, tokens):
            ind += w
    for kw, w in _SI_SUBSTRING_WEIGHTS:
        if keyword_matches_name(name_lc, kw, tokens):
            ind += w

    rev = row.get("latest_revenue_sek")
    emp = row.get("employees_latest")
    try:
        rev_f = float(rev) if rev is not None and not (isinstance(rev, float) and math.isnan(rev)) else None
    except (TypeError, ValueError):
        rev_f = None
    try:
        emp_i = int(float(emp)) if emp is not None and not (isinstance(emp, float) and math.isnan(emp)) else None
    except (TypeError, ValueError):
        emp_i = None

    if rev_f and emp_i and emp_i > 0:
        r_per_emp = rev_f / emp_i
        if r_per_emp < 400_000:
            ind += 0.5

    margin = _margin_as_ratio(row.get("avg_ebitda_margin"))
    if margin is not None and margin < 0.05:
        if any(keyword_matches_name(name_lc, h, tokens) for h in _SI_WEAK_MARGIN_NAME_HINTS):
            ind += 0.5

    return ind


def service_indicator_penalty(ind: float) -> Tuple[float, str]:
    if ind >= 2.0:
        return 0.40, "service_penalty:high"
    if ind >= 1.0:
        return 0.20, "service_penalty:mid"
    return 0.0, ""


def hard_exclusion_flags(row: pd.Series, cfg: Dict[str, Any]) -> List[str]:
    """Return non-empty list if row must be excluded before scoring."""
    flags: List[str] = []
    orgnr = row.get("orgnr")
    if orgnr is None or (isinstance(orgnr, str) and not orgnr.strip()):
        flags.append("NO_ORGNR")
        return flags

    constraints = cfg.get("constraints") or {}
    o_digits = _norm_orgnr_digits(orgnr)
    if o_digits in _merged_hard_orgnr_denyset(cfg):
        flags.append("HARD_ORGNR_DENYLIST")

    name_lc = _name_lower(row)
    if name_lc.strip() in _hard_company_name_exact_set(cfg):
        flags.append("HARD_COMPANY_NAME_EXACT")

    if constraints.get("apply_global_shell_suffixes", True):
        sh = _shell_suffix_hit(name_lc)
        if sh:
            flags.append(f"GLOBAL_SHELL_SUFFIX:{sh}")

    op = _layer1_operating_keyword_hit(name_lc, cfg)
    if op:
        flags.append(f"LAYER1_OPERATING:{op}")

    sv = _layer1_service_keyword_hit(name_lc, cfg)
    if sv:
        flags.append(f"LAYER1_SERVICE:{sv}")

    rev = row.get("latest_revenue_sek")
    rev_ok = rev is not None and not (isinstance(rev, float) and math.isnan(rev))
    try:
        rev_f = float(rev) if rev_ok else None
    except (TypeError, ValueError):
        rev_f = None
        rev_ok = False

    max_rev = constraints.get("max_revenue_sek")
    if max_rev is not None and rev_ok and rev_f is not None:
        try:
            if rev_f > float(max_rev):
                flags.append("REVENUE_ABOVE_MAX")
        except (TypeError, ValueError):
            pass

    max_emp = constraints.get("max_employees")
    emp = row.get("employees_latest")
    if max_emp is not None and emp is not None and not (isinstance(emp, float) and math.isnan(emp)):
        try:
            if float(emp) > float(max_emp):
                flags.append("EMPLOYEES_ABOVE_MAX")
        except (TypeError, ValueError):
            pass

    min_rev = float(constraints.get("min_revenue_sek", 50_000_000))
    if not rev_ok:
        flags.append("NO_REVENUE")
    elif rev_f is not None and rev_f < min_rev:
        flags.append("REVENUE_BELOW_MIN")

    ne = name_exclusion_hit(name_lc, cfg)
    if ne:
        flags.append(f"NAME_EXCLUDED:{ne}")

    nace_deny = _nace_deny_prefixes(cfg)
    pn = row.get("primary_nace")
    if pn is not None and str(pn).strip() and nace_deny:
        p = str(pn).strip()
        for pref in nace_deny:
            ps = str(pref).strip()
            if p.startswith(ps):
                flags.append("NACE_DENIED")
                break

    ly = row.get("latest_year")
    max_age = constraints.get("max_latest_year_age")
    if max_age is not None and ly is not None and not (isinstance(ly, float) and math.isnan(ly)):
        try:
            y = int(ly)
            if y < _calendar_year_utc() - int(max_age):
                flags.append("STALE_YEAR")
        except (TypeError, ValueError):
            flags.append("BAD_LATEST_YEAR")

    min_cal = constraints.get("min_calendar_year")
    if min_cal is not None and ly is not None and not (isinstance(ly, float) and math.isnan(ly)):
        try:
            if int(ly) < int(min_cal):
                flags.append("LATEST_YEAR_BELOW_MIN")
        except (TypeError, ValueError):
            flags.append("BAD_LATEST_YEAR")

    if constraints.get("require_product_signal") and not _orgnr_in_calibration_likes(orgnr, cfg):
        if not name_lc.strip() or not _has_product_name_signal(name_lc, cfg):
            flags.append("NO_PRODUCT_NAME_SIGNAL")

    return flags


def winsorize_series(s: pd.Series, p_low: float, p_high: float) -> pd.Series:
    valid = s.dropna()
    if len(valid) < 5:
        return s
    lo, hi = np.quantile(valid.astype(float), [p_low, p_high])
    return s.clip(lower=lo, upper=hi)


def robust_z(col: pd.Series) -> pd.Series:
    med = col.median()
    q1 = col.quantile(0.25)
    q3 = col.quantile(0.75)
    iqr = float(q3 - q1)
    if iqr == 0 or math.isnan(iqr):
        iqr = 1.0
    return (col - med) / iqr


def build_raw_feature_frame(df: pd.DataFrame, use_legacy: bool) -> Tuple[pd.DataFrame, List[str]]:
    """Columns = internal feature keys; values numeric or NaN."""
    specs = list(_BASE_FEATURE_SPECS)
    if use_legacy:
        specs.extend(_LEGACY_FEATURE_SPECS)
    out: Dict[str, pd.Series] = {}
    keys: List[str] = []
    for key, src, use_log in specs:
        if src not in df.columns:
            continue
        raw = pd.to_numeric(df[src], errors="coerce")
        if use_log:
            x = raw.astype(float)
            out[key] = np.log(np.where(x > 0, x, np.nan))
        else:
            out[key] = raw.astype(float)
        keys.append(key)
    return pd.DataFrame(out, index=df.index), keys


def population_coverage_ok(raw: pd.DataFrame, key: str, cohort_mask: pd.Series, min_cov: float) -> bool:
    sub = raw.loc[cohort_mask, key]
    n = int(sub.notna().sum())
    return (n / max(int(cohort_mask.sum()), 1)) >= min_cov


def filter_features_by_coverage(
    raw: pd.DataFrame, feature_keys: Sequence[str], cohort_mask: pd.Series, min_cov: float
) -> List[str]:
    kept: List[str] = []
    for k in feature_keys:
        if k not in raw.columns:
            continue
        if population_coverage_ok(raw, k, cohort_mask, min_cov):
            kept.append(k)
    return kept


def transform_winsor_robust(
    raw: pd.DataFrame, feature_keys: Sequence[str], p_low: float, p_high: float
) -> pd.DataFrame:
    z = pd.DataFrame(index=raw.index)
    for k in feature_keys:
        w = winsorize_series(raw[k], p_low, p_high)
        z[k] = robust_z(w)
    return z


class CentroidModel:
    __slots__ = ("model_id", "liked_indices", "centroid", "weights")

    def __init__(
        self,
        model_id: str,
        liked_indices: np.ndarray,
        centroid: np.ndarray,
        weights: np.ndarray,
    ) -> None:
        self.model_id = model_id
        self.liked_indices = liked_indices
        self.centroid = centroid
        self.weights = weights


def build_models(
    df_cohort: pd.DataFrame,
    z: pd.DataFrame,
    feature_keys: List[str],
    liked_orgnrs: Sequence[str],
    archetypes: Optional[List[Dict[str, Any]]],
) -> List[CentroidModel]:
    org_to_pos = {str(o): i for i, o in enumerate(df_cohort["orgnr"].astype(str))}
    weights = np.ones(len(feature_keys), dtype=float)
    weights /= weights.sum()

    models: List[CentroidModel] = []

    # Global model
    liked_idx = [org_to_pos[o] for o in liked_orgnrs if o in org_to_pos]
    if liked_idx:
        c = _centroid_from_indices(z, feature_keys, np.array(liked_idx, dtype=int))
        models.append(CentroidModel("global", np.array(liked_idx, dtype=int), c, weights.copy()))

    for arch in archetypes or []:
        aid = str(arch.get("id", "")).strip()
        if not aid:
            continue
        lo = arch.get("liked_orgnrs") or []
        idx = [org_to_pos[o] for o in lo if o in org_to_pos]
        if not idx:
            continue
        arr = np.array(idx, dtype=int)
        c = _centroid_from_indices(z, feature_keys, arr)
        models.append(CentroidModel(f"archetype:{aid}", arr, c, weights.copy()))

    return models


def _centroid_from_indices(z: pd.DataFrame, feature_keys: List[str], idx: np.ndarray) -> np.ndarray:
    sub = z.iloc[idx][list(feature_keys)].to_numpy(dtype=float)
    # nanmean per column
    return np.nanmean(sub, axis=0)


def weighted_distance_row(
    z_row: np.ndarray,
    centroid: np.ndarray,
    weights: np.ndarray,
) -> Tuple[float, int]:
    """Normalized weighted squared distance over dimensions where both finite."""
    d = 0.0
    wsum = 0.0
    used = 0
    for j in range(len(weights)):
        zv = z_row[j]
        cv = centroid[j]
        if math.isfinite(zv) and math.isfinite(cv):
            wj = float(weights[j])
            d += wj * (zv - cv) ** 2
            wsum += wj
            used += 1
    if wsum <= 0:
        return float("inf"), 0
    return d / wsum, used


def _ranked_pass_through_str(row: pd.Series, col: str) -> str:
    """String for CSV export; missing/NaN → empty."""
    if col not in row.index:
        return ""
    v = row[col]
    try:
        if pd.isna(v):
            return ""
    except TypeError:
        pass
    if v is None:
        return ""
    s = str(v).strip()
    if not s or s.lower() == "nan":
        return ""
    return s


def component_group_scores(
    z_row: np.ndarray,
    centroid: np.ndarray,
    weights: np.ndarray,
    feature_keys: List[str],
    alpha: float,
) -> Dict[str, float]:
    """Grouped exp contributions for CSV (winning model only)."""
    key_to_j = {k: j for j, k in enumerate(feature_keys)}

    def comp_for_keys(keys: Sequence[str]) -> float:
        vals: List[float] = []
        for k in keys:
            j = key_to_j.get(k)
            if j is None:
                continue
            zv, cv, wj = z_row[j], centroid[j], weights[j]
            if not (math.isfinite(zv) and math.isfinite(cv)):
                continue
            vals.append(100.0 * math.exp(-alpha * wj * (zv - cv) ** 2))
        if not vals:
            return float("nan")
        return float(sum(vals) / len(vals))

    out = {
        "comp_revenue": comp_for_keys(["log_revenue"]),
        "comp_growth": comp_for_keys(["revenue_cagr_3y"]),
        "comp_margins": comp_for_keys(["avg_ebitda_margin", "avg_ebit_margin", "avg_net_margin"]),
        "comp_scale_efficiency": comp_for_keys(["employees_latest", "revenue_per_employee", "equity_ratio_latest"]),
        "comp_legacy_scores": comp_for_keys(["fit_score", "ops_upside_score", "nivo_total_score"]),
    }
    return out


def score_cohort(
    df_cohort: pd.DataFrame,
    z: pd.DataFrame,
    feature_keys: List[str],
    models: List[CentroidModel],
    alpha: float,
    min_non_null: int,
    cfg: Dict[str, Any],
    max_combined_penalty: float,
) -> pd.DataFrame:
    rows: List[Dict[str, Any]] = []
    constraints = cfg.get("constraints") or {}
    product_boost = float(constraints.get("product_similarity_boost", 0.0) or 0.0)
    Zm = z[list(feature_keys)].to_numpy(dtype=float)
    for i in range(len(df_cohort)):
        z_row_full = Zm[i]
        non_null_ct = int(np.sum(np.isfinite(z_row_full)))
        if non_null_ct < min_non_null:
            continue

        best_score = -1.0
        best_dist = float("inf")
        best_model = ""
        best_used = 0
        best_centroid = np.full(len(feature_keys), np.nan)
        best_weights = np.ones(len(feature_keys)) / len(feature_keys)

        for m in models:
            dist, used = weighted_distance_row(z_row_full, m.centroid, m.weights)
            if used < min_non_null:
                continue
            sc = 100.0 * math.exp(-alpha * dist)
            if sc > best_score:
                best_score = sc
                best_dist = dist
                best_model = m.model_id
                best_used = used
                best_centroid = m.centroid
                best_weights = m.weights

        if best_score < 0:
            continue

        comps = component_group_scores(
            z_row_full, best_centroid, best_weights, feature_keys, alpha
        )
        row = df_cohort.iloc[i]
        name_lc = _name_lower(row)
        product_hit = bool(name_lc.strip()) and _has_product_name_signal(name_lc, cfg)
        name_pen_raw, name_pen_flags = name_rule_penalties(name_lc, cfg)
        si = compute_service_indicator(row)
        svc_pen, svc_flag = service_indicator_penalty(si)
        total_pen = min(name_pen_raw + svc_pen, max_combined_penalty)
        final_score = best_score * (1.0 - total_pen)
        if product_boost > 0.0 and product_hit:
            final_score *= 1.0 + product_boost
        pen_flags = list(name_pen_flags)
        if svc_flag:
            pen_flags.append(svc_flag)

        rows.append(
            {
                "orgnr": row["orgnr"],
                "company_name": row.get("company_name"),
                "registry_homepage_url": _ranked_pass_through_str(row, "registry_homepage_url"),
                "address_city": _ranked_pass_through_str(row, "address_city"),
                "address_region": _ranked_pass_through_str(row, "address_region"),
                "address_country": _ranked_pass_through_str(row, "address_country"),
                "primary_nace": _ranked_pass_through_str(row, "primary_nace"),
                "segment_labels_json": _ranked_pass_through_str(row, "segment_labels_json"),
                "base_similarity_score": best_score,
                "total_score": final_score,
                "layer1_product_signal": product_hit,
                "comp_revenue": comps["comp_revenue"],
                "comp_growth": comps["comp_growth"],
                "comp_margins": comps["comp_margins"],
                "comp_scale_efficiency": comps["comp_scale_efficiency"],
                "comp_legacy_scores": comps["comp_legacy_scores"],
                "matched_model": best_model,
                "distance_value": best_dist,
                "feature_count_used": best_used,
                "exclusion_flags": "",
                "service_indicator": si,
                "applied_penalty": total_pen,
                "penalty_flags": "|".join(pen_flags) if pen_flags else "",
                "latest_revenue_sek": row.get("latest_revenue_sek"),
                "revenue_cagr_3y": row.get("revenue_cagr_3y"),
                "avg_ebitda_margin": row.get("avg_ebitda_margin"),
            }
        )

    out_df = pd.DataFrame(rows)
    if out_df.empty:
        return out_df
    out_df = out_df.sort_values("total_score", ascending=False, kind="mergesort").reset_index(drop=True)
    out_df.insert(0, "rank", range(1, len(out_df) + 1))
    return out_df


def run_pipeline(
    df: pd.DataFrame,
    cfg: Dict[str, Any],
    *,
    use_legacy: bool,
    alpha: Optional[float],
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Returns (ranked_df, excluded_df with columns orgnr, exclusion_flags).
    If alpha is None, uses cfg scoring.alpha or DEFAULT_ALPHA.
    """
    winsor_cfg = cfg.get("winsor") or {}
    p_low = float(winsor_cfg.get("p_low", 0.05))
    p_high = float(winsor_cfg.get("p_high", 0.95))
    scoring_cfg = cfg.get("scoring") or {}
    fr = cfg.get("feature_rules") or {}
    min_cov = float(scoring_cfg.get("min_population_coverage", fr.get("min_population_coverage", 0.55)))
    min_non_null = int(scoring_cfg.get("min_non_null_per_company", fr.get("min_non_null_per_company", 4)))
    eff_alpha = float(alpha if alpha is not None else scoring_cfg.get("alpha", DEFAULT_ALPHA))
    max_combined = float(scoring_cfg.get("max_combined_penalty", DEFAULT_MAX_COMBINED_PENALTY))
    max_combined = max(0.0, min(max_combined, 0.99))

    ex_flags: List[Tuple[str, str]] = []
    mask = []
    for _, row in df.iterrows():
        fl = hard_exclusion_flags(row, cfg)
        if fl:
            ex_flags.append((str(row.get("orgnr", "")), ";".join(fl)))
            mask.append(False)
        else:
            mask.append(True)
    cohort_mask = pd.Series(mask, index=df.index)
    df_cohort = df.loc[cohort_mask].copy()

    raw, all_keys = build_raw_feature_frame(df_cohort, use_legacy)
    active_keys = filter_features_by_coverage(raw, all_keys, pd.Series(True, index=df_cohort.index), min_cov)
    if "log_revenue" in raw.columns and raw["log_revenue"].notna().any():
        if "log_revenue" not in active_keys:
            active_keys = ["log_revenue"] + [k for k in active_keys if k != "log_revenue"]

    if not active_keys or "log_revenue" not in active_keys:
        raise RuntimeError("No active features after coverage filter (is latest_revenue_sek populated?)")

    z = transform_winsor_robust(raw, active_keys, p_low, p_high)

    liked = list(cfg.get("liked_orgnrs") or [])
    archetypes = cfg.get("archetypes") or []
    models = build_models(df_cohort, z, active_keys, liked, archetypes)
    if not models:
        raise RuntimeError(
            "No centroid models: liked_orgnrs must appear in DB and pass hard exclusions "
            "(or define archetypes with valid liked_orgnrs)."
        )

    ranked = score_cohort(
        df_cohort, z, active_keys, models, eff_alpha, min_non_null, cfg, max_combined
    )
    excluded_df = pd.DataFrame(ex_flags, columns=["orgnr", "exclusion_flags"])
    return ranked, excluded_df


def _effective_product_signal_keywords(cfg: Dict[str, Any]) -> List[str]:
    extra = cfg.get("product_signal_keywords") or []
    return list(_L1_DEFAULT_PRODUCT_SIGNAL_KEYWORDS) + [str(x).strip() for x in extra if str(x).strip()]


def _layer1_manifest(
    *,
    cfg: Dict[str, Any],
    cfg_path: Path,
    args: argparse.Namespace,
    eff_alpha: float,
    output_row_count: int,
    excluded_row_count: int,
    cohort_row_count: int,
) -> Dict[str, Any]:
    """Snapshot for reproducibility + DB ingestion (see docs/screening_runs_db_proposal.md)."""
    constraints = cfg.get("constraints") or {}
    scoring_cfg = cfg.get("scoring") or {}
    winsor_cfg = cfg.get("winsor") or {}
    fr = cfg.get("feature_rules") or {}
    min_cov = float(scoring_cfg.get("min_population_coverage", fr.get("min_population_coverage", 0.55)))
    min_non_null = int(scoring_cfg.get("min_non_null_per_company", fr.get("min_non_null_per_company", 4)))
    max_combined = float(scoring_cfg.get("max_combined_penalty", DEFAULT_MAX_COMBINED_PENALTY))

    cfg_resolved = cfg_path.resolve() if cfg_path.exists() else cfg_path
    config_hash = sha256_file(cfg_path) if cfg_path.is_file() else None

    return {
        "run_kind": "layer1_screening_rank_v1",
        "created_at_utc": utc_timestamp_iso(),
        "git_commit": git_commit_hash(REPO_ROOT),
        "script": "screening_rank_v1.py",
        "script_version": SCREENING_RANK_V1_VERSION,
        "config_path": str(cfg_resolved),
        "config_hash_sha256": config_hash,
        "cli": {
            "out": str(args.out.resolve()) if args.out else None,
            "top": args.top,
            "legacy_scores": bool(args.legacy_scores),
            "alpha_override": args.alpha,
            "config": str(Path(args.config).resolve()),
        },
        "top_n": args.top,
        "row_counts": {
            "ranked_output": output_row_count,
            "excluded_pre_score": excluded_row_count,
            "cohort_after_hard_exclusions": cohort_row_count,
        },
        "settings": {
            "alpha_effective": eff_alpha,
            "scoring": {
                "alpha_config": scoring_cfg.get("alpha"),
                "max_combined_penalty": max_combined,
                "min_population_coverage": min_cov,
                "min_non_null_per_company": min_non_null,
            },
            "winsor": {
                "p_low": float(winsor_cfg.get("p_low", 0.05)),
                "p_high": float(winsor_cfg.get("p_high", 0.95)),
            },
            "legacy_scores_mode_b": bool(args.legacy_scores),
            "hard_exclusion_keywords": {
                "layer1_operating_keywords": list(_L1_HARD_OPERATING_KEYWORDS),
                "layer1_service_keywords": list(_L1_HARD_SERVICE_KEYWORDS),
                "shell_name_suffixes": list(_L1_SHELL_NAME_SUFFIXES),
                "yaml_name_exclusion_keywords": list(cfg.get("name_exclusion_keywords") or []),
                "yaml_layer1_extra_operating_exclusion_keywords": list(
                    cfg.get("layer1_extra_operating_exclusion_keywords") or []
                ),
                "yaml_layer1_extra_service_exclusion_keywords": list(
                    cfg.get("layer1_extra_service_exclusion_keywords") or []
                ),
            },
            "orgnr_denylist_count": len(_merged_hard_orgnr_denyset(cfg)),
            "product_signal_keywords_effective": _effective_product_signal_keywords(cfg),
            "product_similarity_boost": float(constraints.get("product_similarity_boost", 0.0) or 0.0),
            "require_product_signal": bool(constraints.get("require_product_signal", False)),
            "max_revenue_sek": constraints.get("max_revenue_sek"),
            "max_employees": constraints.get("max_employees"),
            "min_revenue_sek": constraints.get("min_revenue_sek", 50_000_000),
            "nace_deny_prefixes": _nace_deny_prefixes(cfg),
            "apply_global_shell_suffixes": bool(constraints.get("apply_global_shell_suffixes", True)),
            "max_latest_year_age": constraints.get("max_latest_year_age"),
            "min_calendar_year": constraints.get("min_calendar_year"),
            "constraints_snapshot": dict(constraints),
        },
        "artifacts": {
            "shortlist_csv": str(args.out.resolve()) if args.out else None,
            "excluded_csv": str(args.out.with_suffix(".excluded.csv").resolve()) if args.out else None,
            "manifest_json": str(args.out.with_name(args.out.stem + "_manifest.json").resolve()) if args.out else None,
        },
    }


def write_csv(df: pd.DataFrame, path: Optional[Path], top: Optional[int]) -> None:
    out = df if top is None else df.head(int(top))
    columns = [
        "rank",
        "orgnr",
        "company_name",
        "registry_homepage_url",
        "address_city",
        "address_region",
        "address_country",
        "primary_nace",
        "segment_labels_json",
        "total_score",
        "base_similarity_score",
        "layer1_product_signal",
        "comp_revenue",
        "comp_growth",
        "comp_margins",
        "comp_scale_efficiency",
        "comp_legacy_scores",
        "matched_model",
        "distance_value",
        "feature_count_used",
        "exclusion_flags",
        "service_indicator",
        "applied_penalty",
        "penalty_flags",
        "latest_revenue_sek",
        "revenue_cagr_3y",
        "avg_ebitda_margin",
    ]
    for c in columns:
        if c not in out.columns:
            out[c] = ""
    out = out[columns]
    if path:
        path.parent.mkdir(parents=True, exist_ok=True)
        out.to_csv(path, index=False)
    else:
        out.to_csv(sys.stdout, index=False)


def calibrate(cfg_path: Path, use_legacy: bool, alpha: Optional[float]) -> None:
    cfg = _load_yaml(cfg_path)
    df = load_features_dataframe()
    ranked, _ = run_pipeline(df, cfg, use_legacy=use_legacy, alpha=alpha)

    org_to_rank = {str(r["orgnr"]): int(r["rank"]) for _, r in ranked.iterrows()}
    liked = [str(x) for x in (cfg.get("liked_orgnrs") or [])]
    negs = [str(x) for x in (cfg.get("negative_orgnrs") or [])]
    cal = (cfg.get("calibration") or {}).get("assertions") or {}

    miss_liked = [o for o in liked if o not in org_to_rank]
    if miss_liked:
        print(
            f"[calibration] WARN {len(miss_liked)} liked orgnr(s) have no rank "
            f"(excluded, missing data, or low feature coverage): {miss_liked[:12]}",
            file=sys.stderr,
        )

    def ranks_for(ids: List[str]) -> List[int]:
        out: List[int] = []
        for o in ids:
            if o in org_to_rank:
                out.append(org_to_rank[o])
        return out

    lr = ranks_for(liked)
    nr = ranks_for(negs)

    if lr:
        med = float(statistics.median(lr))
        print(f"[calibration] liked count with rank: {len(lr)}/{len(liked)} median_rank={med}")
        mx = cal.get("max_median_rank_liked")
        if mx is not None and med > float(mx):
            raise SystemExit(f"FAIL: median rank liked {med} > max {mx}")
        topn = cal.get("all_liked_in_top")
        if topn is not None:
            bad = [o for o in liked if org_to_rank.get(o, 10**9) > int(topn)]
            if bad:
                raise SystemExit(f"FAIL: liked not in top {topn}: {bad[:10]}")

    if nr:
        med_n = float(statistics.median(nr))
        print(f"[calibration] negative count with rank: {len(nr)}/{len(negs)} median_rank={med_n}")
        mn = cal.get("min_median_rank_negative")
        if mn is not None and med_n < float(mn):
            raise SystemExit(f"FAIL: median rank negatives {med_n} < min {mn}")

    print("[calibration] OK")


def main() -> None:
    if load_dotenv:
        load_dotenv(REPO_ROOT / ".env")
        load_dotenv(REPO_ROOT / "backend" / ".env", override=False)

    ap = argparse.ArgumentParser(description="Screening v1 deterministic rank + CSV")
    ap.add_argument("--out", type=Path, default=None, help="Output CSV path (default: stdout)")
    ap.add_argument("--top", type=int, default=None, help="Keep only top N rows")
    ap.add_argument("--legacy-scores", action="store_true", help="Mode B: include fit/ops/nivo in features")
    ap.add_argument(
        "--alpha",
        type=float,
        default=None,
        help="Override scoring.alpha from YAML (default: use config)",
    )
    ap.add_argument(
        "--config",
        type=Path,
        default=REPO_ROOT / "scripts" / "fixtures" / "screening_v1_calibration.yaml",
        help="YAML with constraints, liked_orgnrs, archetypes, nace_deny_prefixes",
    )
    ap.add_argument("--calibrate", action="store_true", help="Run assertions from YAML and exit")
    args = ap.parse_args()

    cfg = _load_yaml(args.config) if args.config.exists() else {}
    if not args.config.exists():
        print(f"Missing config YAML: {args.config}", file=sys.stderr)

    if args.calibrate:
        calibrate(args.config, use_legacy=args.legacy_scores, alpha=args.alpha)
        return

    has_models = bool(cfg.get("liked_orgnrs")) or bool(cfg.get("archetypes"))
    if not has_models:
        print(
            "Config must define liked_orgnrs and/or archetypes with liked_orgnrs "
            f"(see {args.config}).",
            file=sys.stderr,
        )
        sys.exit(2)

    df = load_features_dataframe()
    ranked, excluded = run_pipeline(df, cfg, use_legacy=args.legacy_scores, alpha=args.alpha)
    if ranked.empty:
        print("No ranked rows.", file=sys.stderr)
        sys.exit(2)
    write_csv(ranked, args.out, args.top)

    scoring_cfg = cfg.get("scoring") or {}
    eff_alpha = float(args.alpha if args.alpha is not None else scoring_cfg.get("alpha", DEFAULT_ALPHA))
    cohort_n = len(ranked)
    out_df = ranked if args.top is None else ranked.head(int(args.top))
    output_row_count = len(out_df)

    if args.out:
        ex_path = args.out.with_suffix(".excluded.csv")
        excluded.to_csv(ex_path, index=False)
        man = _layer1_manifest(
            cfg=cfg,
            cfg_path=args.config,
            args=args,
            eff_alpha=eff_alpha,
            output_row_count=output_row_count,
            excluded_row_count=len(excluded),
            cohort_row_count=cohort_n,
        )
        man_path = args.out.with_name(args.out.stem + "_manifest.json")
        write_json(man_path, man)
        print(f"Wrote {man_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
