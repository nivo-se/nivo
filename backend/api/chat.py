"""
Acquisition Chat API
"""

from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..analysis.stage1_filter import IntentAnalyzer, FilterCriteria, FinancialFilter
from ..services.db_factory import get_database_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analysis/chat", tags=["analysis-chat"])

class ChatRequest(BaseModel):
    message: str
    current_criteria: Optional[dict] = None

class ChatResponse(BaseModel):
    message: str
    criteria: dict
    count: int
    sample_companies: List[dict]
    suggestions: List[str] = []

@router.post("/", response_model=ChatResponse)
async def chat_refine(request: ChatRequest):
    """
    Process a chat message to refine filter criteria
    """
    try:
        analyzer = IntentAnalyzer()
        filter_engine = FinancialFilter()
        db = get_database_service()
        
        # Parse current criteria if provided
        current = None
        if request.current_criteria:
            # Filter out keys that might not be in FilterCriteria __init__ if we added new ones
            # But FilterCriteria is a dataclass, so we should be careful.
            # Ideally we reconstruct it safely. For now, let's assume the dict matches.
            # We need to handle the case where 'suggestions' is in the dict but not in __init__ if we hadn't updated it yet
            # But we did update it.
            current = FilterCriteria(**request.current_criteria)
            
        # Analyze intent
        new_criteria = analyzer.parse_prompt(request.message, current)
        
        # Get total count stats
        stats = filter_engine.get_filter_stats(new_criteria)
        total_count = stats["total_matches"]
        
        # Get sample (top 5) for display
        # Create a copy to not modify the original criteria which is returned
        import copy
        sample_criteria = copy.copy(new_criteria)
        sample_criteria.max_results = 5
        orgnrs = filter_engine.filter(sample_criteria)
        
        # Get sample details
        sample = []
        if orgnrs:
            placeholders = ','.join('?' * len(orgnrs))
            sql = f"""
            SELECT c.company_name, m.latest_revenue_sek, m.avg_ebitda_margin
            FROM companies c
            JOIN company_metrics m ON m.orgnr = c.orgnr
            WHERE c.orgnr IN ({placeholders})
            """
            rows = db.run_raw_query(sql, params=orgnrs)
            sample = [dict(row) for row in rows]
            
        return ChatResponse(
            message=new_criteria.description,
            criteria=new_criteria.__dict__,
            count=total_count,
            sample_companies=sample,
            suggestions=new_criteria.suggestions
        )
        
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
