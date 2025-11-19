"""
Shortlist management endpoints
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from .dependencies import get_supabase_client

router = APIRouter(prefix="/api/shortlists", tags=["shortlists"])


@router.get("/stage1")
async def get_stage1_shortlists(
    limit: int = Query(10, ge=1, le=100),
    status: Optional[str] = Query(None, description="Filter by status: active, archived, used_for_stage2")
):
    """
    Get list of Stage 1 shortlists.
    """
    try:
        supabase = get_supabase_client()
        
        query = supabase.table("stage1_shortlists").select("*")
        
        if status:
            query = query.eq("status", status)
        
        response = query.order("generated_at", desc=True).limit(limit).execute()
        
        return {
            "shortlists": response.data or [],
            "total": len(response.data) if response.data else 0,
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching shortlists: {str(e)}")


@router.get("/stage1/{shortlist_id}")
async def get_stage1_shortlist(shortlist_id: str):
    """
    Get a specific Stage 1 shortlist by ID.
    """
    try:
        supabase = get_supabase_client()
        
        response = supabase.table("stage1_shortlists").select("*").eq("id", shortlist_id).maybe_single().execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail=f"Shortlist {shortlist_id} not found")
        
        return response.data
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching shortlist: {str(e)}")

