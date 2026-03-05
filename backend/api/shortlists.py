"""
Legacy shortlists API. Use /api/lists (Postgres saved_lists) instead.
Returns empty data so existing callers do not break.
"""

from fastapi import APIRouter, Query
from typing import Optional

router = APIRouter(prefix="/api/shortlists", tags=["shortlists"])


@router.get("/stage1")
async def get_stage1_shortlists(
    limit: int = Query(10, ge=1, le=100),
    status: Optional[str] = Query(None, description="Filter by status"),
):
    """Deprecated. Use GET /api/lists. Returns empty shortlists."""
    return {"shortlists": [], "total": 0}


@router.get("/stage1/{shortlist_id}")
async def get_stage1_shortlist(shortlist_id: str):
    """Deprecated. Use GET /api/lists/{id}/items. Returns 404."""
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="Use GET /api/lists and /api/lists/{id}/items for lists.")
