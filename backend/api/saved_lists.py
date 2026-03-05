"""
Legacy saved-lists API. Use /api/lists (Postgres saved_lists) instead.
Returns empty data so existing callers do not break.
"""

import logging
from fastapi import APIRouter, Body
from typing import Dict, Any

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/saved-lists", tags=["saved-lists"])


@router.get("")
async def get_saved_lists():
    """Deprecated. Use GET /api/lists. Returns empty list."""
    return {"success": True, "data": []}


@router.post("")
async def save_list(list_data: Dict[str, Any] = Body(...)):
    """Deprecated. Use POST /api/lists. Accepts payload but does not persist; returns stub."""
    return {"success": True, "data": {"id": "deprecated", "message": "Use POST /api/lists to save lists."}}


@router.delete("/{list_id}")
async def delete_list(list_id: str):
    """Deprecated. Use DELETE /api/lists/{id}. No-op."""
    return {"success": True, "data": {"deleted": True, "message": "Use DELETE /api/lists/{id} for list deletion."}}
