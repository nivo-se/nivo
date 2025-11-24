
from fastapi import APIRouter, HTTPException, Body
from typing import List, Dict, Any
from .dependencies import get_supabase_client
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/saved-lists", tags=["saved-lists"])

@router.get("")
async def get_saved_lists():
    """
    Get all saved lists.
    Maps to 'stage1_shortlists' table for now as that seems to be the storage.
    """
    try:
        supabase = get_supabase_client()
        response = supabase.table("stage1_shortlists").select("*").order("generated_at", desc=True).execute()
        return response.data or []
    except Exception as e:
        logger.error(f"Error fetching saved lists: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("")
async def save_list(list_data: Dict[str, Any] = Body(...)):
    """
    Save a new list.
    """
    try:
        supabase = get_supabase_client()
        # Ensure required fields for stage1_shortlists
        # It likely needs: criteria, company_count, status
        # The frontend sends what it has.
        
        response = supabase.table("stage1_shortlists").insert(list_data).execute()
        return response.data[0] if response.data else {}
    except Exception as e:
        logger.error(f"Error saving list: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{list_id}")
async def delete_list(list_id: str):
    """
    Delete a saved list.
    """
    try:
        supabase = get_supabase_client()
        response = supabase.table("stage1_shortlists").delete().eq("id", list_id).execute()
        return {"success": True}
    except Exception as e:
        logger.error(f"Error deleting list: {e}")
        raise HTTPException(status_code=500, detail=str(e))
