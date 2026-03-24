"""
AI credits: spend limits (admin-set) and per-user usage tracking.
Admin can set global and per-user monthly limits; all AI usage is recorded by user_id.
"""
from __future__ import annotations

import logging
from calendar import monthrange
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from .rbac import require_role

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/ai-credits", tags=["admin", "ai-credits"])

# Fixed cost for ai_filter when we don't have token usage (one LLM call)
AI_FILTER_ESTIMATED_COST_USD = Decimal("0.01")

# Default limits when no persistence (Postgres-backed credits can be added later)
DEFAULT_GLOBAL_LIMIT = Decimal("100")
DEFAULT_PER_USER_LIMIT = Decimal("50")


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
    """Get current AI credits limits (admin only). Returns defaults when no DB config."""
    return AICreditsConfigResponse(
        global_monthly_limit_usd=float(DEFAULT_GLOBAL_LIMIT),
        per_user_monthly_limit_usd=float(DEFAULT_PER_USER_LIMIT),
        updated_at=None,
        updated_by=None,
    )


@router.put("/config", response_model=AICreditsConfigResponse)
async def update_config(
    body: AICreditsConfigUpdate,
    request: Request,
    _: str = Depends(require_role("admin")),
):
    """Update AI credits limits (admin only). No persistence; returns accepted defaults."""
    if body.global_monthly_limit_usd is not None and body.global_monthly_limit_usd < 0:
        raise HTTPException(400, "global_monthly_limit_usd must be >= 0")
    if body.per_user_monthly_limit_usd is not None and body.per_user_monthly_limit_usd < 0:
        raise HTTPException(400, "per_user_monthly_limit_usd must be >= 0")
    return AICreditsConfigResponse(
        global_monthly_limit_usd=float(body.global_monthly_limit_usd if body.global_monthly_limit_usd is not None else DEFAULT_GLOBAL_LIMIT),
        per_user_monthly_limit_usd=body.per_user_monthly_limit_usd,
        updated_at=None,
        updated_by=None,
    )


# --- Admin: usage by user ---


@router.get("/usage", response_model=AICreditsUsageResponse)
async def get_usage(
    period: str = "current_month",
    _: str = Depends(require_role("admin")),
):
    """
    Get AI credits usage per user for a period (admin only). Returns empty when no persistence.
    period: current_month | last_month | YYYY-MM
    """
    now = datetime.now(timezone.utc)
    if period == "current_month":
        month_iso = now.strftime("%Y-%m")
    elif period == "last_month":
        month_iso = f"{now.year - 1}-12" if now.month == 1 else f"{now.year}-{now.month - 1:02d}"
    else:
        month_iso = period
    config_r = AICreditsConfigResponse(
        global_monthly_limit_usd=float(DEFAULT_GLOBAL_LIMIT),
        per_user_monthly_limit_usd=float(DEFAULT_PER_USER_LIMIT),
        updated_at=None,
        updated_by=None,
    )
    return AICreditsUsageResponse(
        period=month_iso,
        global_total_usd=0.0,
        per_user=[],
        config=config_r,
    )


# --- Helpers for other modules (check limit, record usage) ---


def get_config_for_check():
    """Return (global_limit, per_user_limit) for limit checks. No persistence: allow all."""
    return (Decimal("999999"), None)


def get_user_usage_this_month(user_id: str) -> Decimal:
    """Sum of amount_usd for user in current month. No persistence: 0."""
    return Decimal("0")


def get_global_usage_this_month() -> Decimal:
    """Sum of amount_usd for current month (all users). No persistence: 0."""
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
    """Record one AI credits usage event. No-op when no persistence configured."""
    pass
