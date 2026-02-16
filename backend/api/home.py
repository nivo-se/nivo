"""
Home dashboard API: single endpoint for CEO/operating picture.
Reuses status, coverage snapshot; optional lists/jobs when available.
Supports time range for chart data.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Query, Request

from .dependencies import get_current_user_id
from .status import get_status
from ..services.db_factory import get_database_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/home", tags=["home"])

TimeRange = Literal["1d", "7d", "30d"]


def _placeholder_chart_series(range_: str) -> List[Dict[str, Any]]:
    """Generate placeholder time series for chart. Later replace with real event logs."""
    now = datetime.now(timezone.utc)
    if range_ == "1d":
        n = 24
        delta = timedelta(hours=1)
        fmt = "%H:%M"
        date_fmt = "%Y-%m-%dT%H:%M"
    elif range_ == "7d":
        n = 7
        delta = timedelta(days=1)
        fmt = "%a %d"
        date_fmt = "%Y-%m-%d"
    else:  # 30d
        n = 30
        delta = timedelta(days=1)
        fmt = "%b %d"
        date_fmt = "%Y-%m-%d"
    out = []
    for i in range(n, 0, -1):
        t = now - delta * i
        v = (hash((t.date().isoformat(), t.hour if range_ == "1d" else 0)) % 50) + 10
        out.append({"date": t.strftime(date_fmt), "value": max(0, v), "label": t.strftime(fmt)})
    return out


def _get_job_counts() -> Dict[str, Any]:
    """Placeholder: active runs, failures. Returns counts when RQ available."""
    try:
        from .dependencies import get_redis_client
        from rq import Queue

        redis_conn = get_redis_client()
        active = 0
        failed = 0
        for qname in ("enrichment", "ai_analysis"):
            try:
                q = Queue(qname, connection=redis_conn)
                for j in q.get_jobs():
                    st = j.get_status()
                    if st in ("queued", "started"):
                        active += 1
                    elif st == "failed":
                        failed += 1
            except Exception:
                pass
        return {"active_runs": active, "failed_count": failed}
    except Exception:
        return {"active_runs": None, "failed_count": None}


@router.get("/dashboard")
async def get_dashboard(
    request: Request,
    range_: TimeRange = Query("30d", alias="range"),
):
    """
    Single JSON for Home page: universe, pipeline, coverage, runs, analytics, chart.
    Supports ?range=1d|7d|30d for chart time window.
    Placeholders where data not available; real counts from /api/status.
    """
    # Status + coverage (reuse existing logic)
    status_resp = await get_status()
    counts = status_resp.get("counts", {})
    raw = counts.get("companies")
    total_companies = int(raw) if isinstance(raw, int) and raw >= 0 else 0

    # Coverage snapshot
    coverage_data: Dict[str, Any] = {}
    try:
        from .coverage import coverage_snapshot
        cov = await coverage_snapshot()
        coverage_data = {
            "total_companies": cov.get("total_companies", 0),
            "ai_profile_pct": cov.get("has_ai_profile_pct"),
            "financial_3y_pct": cov.get("has_3y_financials_pct"),
            "stale_pct": cov.get("stale_pct"),
            "avg_data_quality": cov.get("avg_data_quality_score"),
        }
        if total_companies == 0 and coverage_data.get("total_companies"):
            total_companies = coverage_data["total_companies"]
    except Exception as e:
        logger.warning("Coverage snapshot failed: %s", e)
        coverage_data = {
            "total_companies": total_companies,
            "ai_profile_pct": None,
            "financial_3y_pct": None,
            "stale_pct": None,
            "avg_data_quality": None,
        }

    # Optional: list counts (team, my) when user authenticated
    team_lists_count: Optional[int] = None
    my_lists_count: Optional[int] = None
    last_updated_lists: list = []
    uid = get_current_user_id(request)
    if uid:
        try:
            db = get_database_service()
            if db.table_exists("saved_lists"):
                team_rows = db.run_raw_query(
                    "SELECT COUNT(*) as n FROM saved_lists WHERE scope = 'team'"
                )
                my_rows = db.run_raw_query(
                    "SELECT COUNT(*) as n FROM saved_lists WHERE owner_user_id::text = ?",
                    [uid],
                )
                team_lists_count = int(team_rows[0]["n"]) if team_rows else 0
                my_lists_count = int(my_rows[0]["n"]) if my_rows else 0
                # Last 3 lists updated (name, owner placeholder, updated_at)
                recent = db.run_raw_query(
                    """
                    SELECT id, name, scope, updated_at, owner_user_id
                    FROM saved_lists
                    WHERE scope = 'team' OR owner_user_id::text = ?
                    ORDER BY updated_at DESC
                    LIMIT 3
                    """,
                    [uid],
                )
                for r in recent or []:
                    last_updated_lists.append({
                        "id": str(r.get("id", "")),
                        "name": r.get("name", "Unnamed"),
                        "scope": r.get("scope", "private"),
                        "updated_at": str(r.get("updated_at", "")),
                    })
        except Exception as e:
            logger.warning("List counts failed: %s", e)

    # Job counts (placeholders when RQ not available)
    job_counts = _get_job_counts()

    # Status counts for display (companies, financials, ai_profiles, etc.)
    status_counts = {k: v for k, v in counts.items() if isinstance(v, int) and v >= 0}

    # Placeholder analytics mini-cards (enrichment, shortlist, views activity)
    analytics = {
        "enrichment_activity": None,
        "shortlist_activity": None,
        "views_activity": None,
    }

    # Placeholder chart series driven by range
    chart_series = _placeholder_chart_series(range_)

    return {
        "universe": {
            "total_companies": total_companies or coverage_data.get("total_companies") or 0,
            "matched": None,  # Only when view/filter applied; Home shows "All"
            "added_7d": None,
            "updated_7d": None,
        },
        "pipeline": {
            "team_lists_count": team_lists_count,
            "my_lists_count": my_lists_count,
            "last_updated_lists": last_updated_lists,
        },
        "coverage": coverage_data,
        "runs": job_counts,
        "status": {
            "db_ok": status_resp.get("db_ok", False),
            "api": status_resp.get("api", "unknown"),
            "counts": status_counts,
        },
        "analytics": analytics,
        "chart_series": chart_series,
    }
