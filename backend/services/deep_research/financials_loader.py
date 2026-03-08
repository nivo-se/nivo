"""Standalone loader for historical financials from public.financials."""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def _safe_pct(numerator: float | None, denominator: float | None) -> float | None:
    if numerator is None or denominator is None or denominator == 0:
        return None
    return round(numerator / denominator * 100, 2)


def _cagr(first: float, last: float, years: int) -> float | None:
    if years <= 0 or first <= 0 or last <= 0:
        return None
    try:
        return round(((last / first) ** (1.0 / years) - 1.0) * 100, 2)
    except (ZeroDivisionError, ValueError):
        return None


def load_historical_financials(orgnr: str) -> list[dict]:
    """Load up to 4 years of historical financials from public.financials.

    Returns list of dicts with keys: year, revenue_msek, ebitda_msek, ebitda_margin_pct, net_income_msek
    Returns empty list if orgnr is invalid or no data found.
    """
    if not orgnr or orgnr.startswith("tmp-"):
        return []

    try:
        from backend.services.db_factory import get_database_service
        db = get_database_service()
    except Exception:
        logger.debug("Cannot load historicals: DB service unavailable")
        return []

    try:
        sql = """
            WITH ranked AS (
                SELECT
                    year,
                    COALESCE(si_sek, sdi_sek) as revenue_sek,
                    dr_sek as profit_sek,
                    COALESCE(ebitda_sek, ors_sek) as ebitda_sek,
                    ROW_NUMBER() OVER (
                        PARTITION BY year
                        ORDER BY COALESCE(period::text, '') DESC
                    ) AS rn
                FROM financials
                WHERE orgnr = ?
                  AND (currency IS NULL OR currency = 'SEK')
                  AND year >= 2018
            )
            SELECT year, revenue_sek, profit_sek, ebitda_sek
            FROM ranked
            WHERE rn = 1
            ORDER BY year ASC
            LIMIT 4
        """
        rows = db.run_raw_query(sql, params=[orgnr])
    except Exception as e:
        logger.debug("Historical financials query failed: %s", e)
        return []

    result: list[dict] = []
    for row in rows:
        rev_sek = row.get("revenue_sek")
        ebitda_sek = row.get("ebitda_sek")
        rev_msek = round(float(rev_sek) / 1_000_000, 2) if rev_sek else None
        ebitda_msek = round(float(ebitda_sek) / 1_000_000, 2) if ebitda_sek else None
        margin = _safe_pct(ebitda_msek, rev_msek) if rev_msek and ebitda_msek else None
        profit_sek = row.get("profit_sek")
        net_msek = round(float(profit_sek) / 1_000_000, 2) if profit_sek else None

        result.append({
            "year": int(row["year"]),
            "revenue_msek": rev_msek,
            "ebitda_msek": ebitda_msek,
            "ebitda_margin_pct": margin,
            "net_income_msek": net_msek,
        })

    return result


def compute_derived_metrics(financials: list[dict]) -> dict:
    """Compute derived metrics from historical financials.

    Returns dict with: latest_revenue_msek, latest_ebitda_margin_pct, revenue_cagr_pct, ebitda_cagr_pct,
    ebitda_margin_trend, avg_capex_pct_revenue, avg_nwc_pct_revenue
    """
    if not financials:
        return {}

    revenues = [f["revenue_msek"] for f in financials if f.get("revenue_msek") and f["revenue_msek"] > 0]
    ebitdas = [f["ebitda_msek"] for f in financials if f.get("ebitda_msek") and f["ebitda_msek"] > 0]
    ebitda_margins = [f["ebitda_margin_pct"] for f in financials if f.get("ebitda_margin_pct") is not None]

    result: dict = {}

    result["latest_revenue_msek"] = revenues[-1] if revenues else None
    result["latest_ebitda_margin_pct"] = ebitda_margins[-1] if ebitda_margins else None

    if len(revenues) >= 2:
        result["revenue_cagr_pct"] = _cagr(revenues[0], revenues[-1], len(revenues) - 1)
    else:
        result["revenue_cagr_pct"] = None

    if len(ebitdas) >= 2:
        result["ebitda_cagr_pct"] = _cagr(ebitdas[0], ebitdas[-1], len(ebitdas) - 1)
    else:
        result["ebitda_cagr_pct"] = None

    result["ebitda_margin_trend"] = ebitda_margins

    capex_pcts = [
        _safe_pct(f.get("capex_msek"), f["revenue_msek"])
        for f in financials
        if f.get("capex_msek") is not None and f.get("revenue_msek") and f["revenue_msek"] > 0
    ]
    result["avg_capex_pct_revenue"] = round(sum(capex_pcts) / len(capex_pcts), 2) if capex_pcts else None

    nwc_pcts = [
        _safe_pct(f.get("nwc_msek"), f["revenue_msek"])
        for f in financials
        if f.get("nwc_msek") is not None and f.get("revenue_msek") and f["revenue_msek"] > 0
    ]
    result["avg_nwc_pct_revenue"] = round(sum(nwc_pcts) / len(nwc_pcts), 2) if nwc_pcts else None

    return result
