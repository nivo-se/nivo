"""
AI credits: spend limits (admin-set) and per-user usage tracking.
Admin can set global and per-user monthly limits; all AI usage is recorded by user_id.
"""
from __future__ import annotations

import logging
from calendar import monthrange
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from .dependencies import get_supabase_admin_client, get_current_user_id
from .rbac import require_role

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/ai-credits", tags=["admin", "ai-credits"])

# Fixed cost for ai_filter when we don't have token usage (one LLM call)
AI_FILTER_ESTIMATED_COST_USD = Decimal("0.01")


def _supabase():
    return get_supabase_admin_client()


def _start_end_of_month(month_iso: str) -> tuple[str, str]:
    """Return (start, end) timestamps for month YYYY-MM in ISO format."""
    try:
        y, m = int(month_iso[:4]), int(month_iso[5:7])
        start = datetime(y, m, 1, tzinfo=timezone.utc)
        _, last = monthrange(y, m)
        end = datetime(y, m, last, 23, 59, 59, 999999, tzinfo=timezone.utc)
        return start.isoformat(), end.isoformat()
    except Exception:
        now = datetime.now(timezone.utc)
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        _, last = monthrange(start.year, start.month)
        end = start.replace(day=last, hour=23, minute=59, second=59, microsecond=999999)
        return start.isoformat(), end.isoformat()


# --- Response/request models ---


class AICreditsConfigResponse(BaseModel):
    global_monthly_limit_usd: float
    per_user_monthly_limit_usd: Optional[float]
    updated_at: Optional[str]
    updated_by: Optional[str]


class AICreditsConfigUpdate(BaseModel):
    global_monthly_limit_usd: Optional[float] = None
    per_user_monthly_limit_usd: Optional[float] = None


class UserUsageRow(BaseModel):
    user_id: str
    total_usd: float
    operation_counts: dict[str, int]


class AICreditsUsageResponse(BaseModel):
    period: str
    global_total_usd: float
    per_user: list[UserUsageRow]
    config: AICreditsConfigResponse


# --- Admin: get/update config ---


@router.get("/config", response_model=AICreditsConfigResponse)
async def get_config(_: str = Depends(require_role("admin"))):
    """Get current AI credits limits (admin only)."""
    supabase = _supabase()
    if not supabase:
        return AICreditsConfigResponse(
            global_monthly_limit_usd=100.0,
            per_user_monthly_limit_usd=50.0,
            updated_at=None,
            updated_by=None,
        )
    try:
        r = supabase.table("ai_credits_config").select("*").eq("id", 1).maybe_single().execute()
        if not r.data:
            return AICreditsConfigResponse(
                global_monthly_limit_usd=100.0,
                per_user_monthly_limit_usd=50.0,
                updated_at=None,
                updated_by=None,
            )
        row = r.data
        return AICreditsConfigResponse(
            global_monthly_limit_usd=float(row.get("global_monthly_limit_usd", 100)),
            per_user_monthly_limit_usd=float(row["per_user_monthly_limit_usd"]) if row.get("per_user_monthly_limit_usd") is not None else None,
            updated_at=row.get("updated_at"),
            updated_by=row.get("updated_by"),
        )
    except Exception as e:
        logger.warning("ai_credits get_config: %s", e)
        return AICreditsConfigResponse(
            global_monthly_limit_usd=100.0,
            per_user_monthly_limit_usd=50.0,
            updated_at=None,
            updated_by=None,
        )


@router.put("/config", response_model=AICreditsConfigResponse)
async def update_config(
    body: AICreditsConfigUpdate,
    request: Request,
    _: str = Depends(require_role("admin")),
):
    """Update AI credits limits (admin only)."""
    supabase = _supabase()
    if not supabase:
        raise HTTPException(503, "Supabase not configured. Run migration 022 and set SUPABASE_*.")
    admin_id = get_current_user_id(request) or "system"
    now = datetime.now(timezone.utc).isoformat()
    payload: dict[str, Any] = {"updated_at": now, "updated_by": admin_id}
    if body.global_monthly_limit_usd is not None:
        if body.global_monthly_limit_usd < 0:
            raise HTTPException(400, "global_monthly_limit_usd must be >= 0")
        payload["global_monthly_limit_usd"] = body.global_monthly_limit_usd
    if body.per_user_monthly_limit_usd is not None:
        if body.per_user_monthly_limit_usd < 0:
            raise HTTPException(400, "per_user_monthly_limit_usd must be >= 0")
        payload["per_user_monthly_limit_usd"] = body.per_user_monthly_limit_usd
    try:
        r = (
            supabase.table("ai_credits_config")
            .update(payload)
            .eq("id", 1)
            .execute()
        )
        if not r.data:
            raise HTTPException(404, "ai_credits_config row not found")
        row = r.data[0] if isinstance(r.data, list) else r.data
        return AICreditsConfigResponse(
            global_monthly_limit_usd=float(row.get("global_monthly_limit_usd", 100)),
            per_user_monthly_limit_usd=float(row["per_user_monthly_limit_usd"]) if row.get("per_user_monthly_limit_usd") is not None else None,
            updated_at=row.get("updated_at"),
            updated_by=row.get("updated_by"),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("ai_credits update_config: %s", e)
        raise HTTPException(500, str(e))


# --- Admin: usage by user ---


@router.get("/usage", response_model=AICreditsUsageResponse)
async def get_usage(
    period: str = "current_month",
    _: str = Depends(require_role("admin")),
):
    """
    Get AI credits usage per user for a period (admin only).
    period: current_month | last_month | YYYY-MM
    """
    supabase = _supabase()
    if not supabase:
        return AICreditsUsageResponse(
            period=period,
            global_total_usd=0.0,
            per_user=[],
            config=AICreditsConfigResponse(global_monthly_limit_usd=100.0, per_user_monthly_limit_usd=50.0),
        )
    now = datetime.now(timezone.utc)
    if period == "current_month":
        month_iso = now.strftime("%Y-%m")
    elif period == "last_month":
        if now.month == 1:
            month_iso = f"{now.year - 1}-12"
        else:
            month_iso = f"{now.year}-{now.month - 1:02d}"
    else:
        month_iso = period
    start_iso, end_iso = _start_end_of_month(month_iso)
    try:
        r = (
            supabase.table("ai_credits_usage")
            .select("user_id, amount_usd, operation_type")
            .gte("created_at", start_iso)
            .lte("created_at", end_iso)
            .execute()
        )
    except Exception as e:
        logger.warning("ai_credits get_usage: %s", e)
        config_r = AICreditsConfigResponse(global_monthly_limit_usd=100.0, per_user_monthly_limit_usd=50.0, updated_at=None, updated_by=None)
        return AICreditsUsageResponse(period=month_iso, global_total_usd=0.0, per_user=[], config=config_r)
    rows = r.data or []
    by_user: dict[str, dict[str, Any]] = {}
    global_total = Decimal("0")
    for row in rows:
        uid = str(row.get("user_id", "unknown"))
        amt = Decimal(str(row.get("amount_usd", 0)))
        op = str(row.get("operation_type", "unknown"))
        global_total += amt
        if uid not in by_user:
            by_user[uid] = {"total_usd": Decimal("0"), "ops": {}}
        by_user[uid]["total_usd"] += amt
        by_user[uid]["ops"][op] = by_user[uid]["ops"].get(op, 0) + 1
    per_user = [
        UserUsageRow(
            user_id=uid,
            total_usd=float(data["total_usd"]),
            operation_counts=data["ops"],
        )
        for uid, data in sorted(by_user.items(), key=lambda x: -float(x[1]["total_usd"]))
    ]
    try:
        cr = supabase.table("ai_credits_config").select("*").eq("id", 1).maybe_single().execute()
        row = (cr.data or {})
        config_r = AICreditsConfigResponse(
            global_monthly_limit_usd=float(row.get("global_monthly_limit_usd", 100)),
            per_user_monthly_limit_usd=float(row["per_user_monthly_limit_usd"]) if row.get("per_user_monthly_limit_usd") is not None else None,
            updated_at=row.get("updated_at"),
            updated_by=row.get("updated_by"),
        )
    except Exception:
        config_r = AICreditsConfigResponse(global_monthly_limit_usd=100.0, per_user_monthly_limit_usd=50.0, updated_at=None, updated_by=None)
    return AICreditsUsageResponse(
        period=month_iso,
        global_total_usd=float(global_total),
        per_user=per_user,
        config=config_r,
    )


# --- Helpers for other modules (check limit, record usage) ---


def get_config_for_check():
    """Return (global_limit, per_user_limit) for limit checks. Uses admin client."""
    supabase = _supabase()
    if not supabase:
        return (Decimal("999999"), None)
    try:
        r = supabase.table("ai_credits_config").select("global_monthly_limit_usd, per_user_monthly_limit_usd").eq("id", 1).maybe_single().execute()
        if not r.data:
            return (Decimal("999999"), None)
        row = r.data
        g = Decimal(str(row.get("global_monthly_limit_usd", 999999)))
        p = Decimal(str(row["per_user_monthly_limit_usd"])) if row.get("per_user_monthly_limit_usd") is not None else None
        return (g, p)
    except Exception as e:
        logger.warning("get_config_for_check: %s", e)
        return (Decimal("999999"), None)


def get_user_usage_this_month(user_id: str) -> Decimal:
    """Sum of amount_usd for user in current month."""
    supabase = _supabase()
    if not supabase:
        return Decimal("0")
    now = datetime.now(timezone.utc)
    start_iso = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    try:
        r = (
            supabase.table("ai_credits_usage")
            .select("amount_usd")
            .eq("user_id", user_id)
            .gte("created_at", start_iso)
            .execute()
        )
        total = sum(Decimal(str(x.get("amount_usd", 0))) for x in (r.data or []))
        return total
    except Exception as e:
        logger.warning("get_user_usage_this_month: %s", e)
        return Decimal("0")


def get_global_usage_this_month() -> Decimal:
    """Sum of amount_usd for current month (all users)."""
    supabase = _supabase()
    if not supabase:
        return Decimal("0")
    now = datetime.now(timezone.utc)
    start_iso = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    try:
        r = (
            supabase.table("ai_credits_usage")
            .select("amount_usd")
            .gte("created_at", start_iso)
            .execute()
        )
        return sum(Decimal(str(x.get("amount_usd", 0))) for x in (r.data or []))
    except Exception as e:
        logger.warning("get_global_usage_this_month: %s", e)
        return Decimal("0")


def can_use_ai(user_id: Optional[str], estimated_cost_usd: Decimal) -> tuple[bool, str]:
    """
    Returns (allowed, message). If user_id is None, we only check global limit and allow (recording as 'unknown-user').
    """
    global_limit, per_user_limit = get_config_for_check()
    if user_id:
        user_usage = get_user_usage_this_month(user_id)
        if per_user_limit is not None and (user_usage + estimated_cost_usd) > per_user_limit:
            return (False, f"Per-user AI spend limit reached (${float(user_usage):.2f} / ${float(per_user_limit):.2f} this month).")
    global_usage = get_global_usage_this_month()
    if (global_usage + estimated_cost_usd) > global_limit:
        return (False, f"Global AI spend limit reached (${float(global_usage):.2f} / ${float(global_limit):.2f} this month).")
    return (True, "")


def record_usage(user_id: str, amount_usd: Decimal, operation_type: str, run_id: Optional[str] = None) -> None:
    """Record one AI credits usage event. Best-effort."""
    supabase = _supabase()
    if not supabase:
        return
    try:
        payload: dict[str, Any] = {
            "user_id": user_id,
            "amount_usd": float(amount_usd),
            "operation_type": operation_type,
        }
        if run_id:
            payload["run_id"] = run_id
        supabase.table("ai_credits_usage").insert(payload).execute()
    except Exception as e:
        logger.warning("record_usage failed: %s", e)
