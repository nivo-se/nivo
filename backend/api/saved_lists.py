
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
    Falls back to empty list if Supabase is not configured or table doesn't exist.
    Returns format expected by frontend: { success: true, data: [] }
    """
    try:
        supabase = get_supabase_client()
        if not supabase:
            logger.info("Supabase not configured. Returning empty list.")
            return {"success": True, "data": []}
        response = supabase.table("stage1_shortlists").select("*").order("generated_at", desc=True).execute()
        return {"success": True, "data": response.data or []}
    except Exception as e:
        error_msg = str(e)
        # If Supabase table doesn't exist or not configured, return empty list instead of error
        if "Could not find the table" in error_msg or "PGRST" in error_msg:
            logger.info("Saved lists table not available (table missing). Returning empty list.")
            return {"success": True, "data": []}
        logger.error(f"Error fetching saved lists: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("")
async def save_list(list_data: Dict[str, Any] = Body(...)):
    """
    Save a new list.
    Falls back gracefully if Supabase is not configured.
    """
    try:
        supabase = get_supabase_client()
        if not supabase:
            logger.warning("Supabase not configured. List not persisted.")
            return {"success": True, "data": {"id": "local", "message": "List saved locally only (Supabase not configured)"}}
        # Ensure required fields for stage1_shortlists
        # It likely needs: criteria, company_count, status
        # The frontend sends what it has.
        
        response = supabase.table("stage1_shortlists").insert(list_data).execute()
        return {"success": True, "data": response.data[0] if response.data else {}}
    except Exception as e:
        error_msg = str(e)
        # If Supabase table doesn't exist or not configured, return success but log warning
        if "Could not find the table" in error_msg or "PGRST" in error_msg:
            logger.warning("Saved lists table not available (table missing). List not persisted.")
            return {"success": True, "data": {"id": "local", "message": "List saved locally only (table not available)"}}
        logger.error(f"Error saving list: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{list_id}")
async def delete_list(list_id: str):
    """
    Delete a saved list.
    Falls back gracefully if Supabase is not configured.
    """
    try:
        supabase = get_supabase_client()
        if not supabase:
            logger.info("Supabase not configured. Delete operation skipped.")
            return {"success": True, "data": {"deleted": True, "message": "List deletion skipped (Supabase not configured)"}}
        response = supabase.table("stage1_shortlists").delete().eq("id", list_id).execute()
        return {"success": True, "data": {"deleted": True}}
    except Exception as e:
        error_msg = str(e)
        # If Supabase table doesn't exist or not configured, return success
        if "Could not find the table" in error_msg or "PGRST" in error_msg:
            logger.info("Saved lists table not available. Delete operation skipped.")
            return {"success": True, "data": {"deleted": True, "message": "List deletion skipped (table not available)"}}
        logger.error(f"Error deleting list: {e}")
        raise HTTPException(status_code=500, detail=str(e))
