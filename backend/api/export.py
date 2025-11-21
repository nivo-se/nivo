from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..services.db_factory import get_database_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/export", tags=["export"])


class CopperExportRequest(BaseModel):
    org_numbers: List[str] = Field(..., min_length=1, max_length=500)
    copper_api_token: Optional[str] = Field(
        None, description="If omitted, backend will use configured token"
    )


@router.post("/copper")
async def export_to_copper(request: CopperExportRequest):
    db = get_database_service()
    try:
        # Join companies table to get company_name
        placeholders = ",".join("?" for _ in request.org_numbers)
        sql = f"""
            SELECT k.orgnr, c.company_name, k.latest_revenue_sek 
            FROM company_kpis k
            LEFT JOIN companies c ON c.orgnr = k.orgnr
            WHERE k.orgnr IN ({placeholders})
            """
        rows = db.run_raw_query(sql, params=request.org_numbers)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load companies: {exc}")

    # Placeholder: integrate with Copper CRM here
    logger.info(
        "Exporting %s companies to Copper (token provided=%s)",
        len(rows),
        bool(request.copper_api_token),
    )

    return {"success": True, "exported": len(rows), "message": "Copper export queued"}

