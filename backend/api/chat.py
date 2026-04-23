"""
Acquisition chat API: refine universe filters with optional persisted thread (Track A).
"""

from __future__ import annotations

import logging
import os
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from ..analysis.stage1_filter import (
    FilterCriteria,
    FinancialFilter,
    IntentAnalyzer,
    filter_criteria_from_dict,
    humanize_filter_criteria,
)
from ..services.ai_conversation_store import (
    append_messages,
    create_conversation,
    is_valid_uuid,
    load_history_openai,
    verify_conversation_owner,
)
from ..services.db_factory import get_database_service
from ..services.nivo_context import load_nivo_context, thesis_block_for_llm
from .dependencies import get_current_user_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analysis/chat", tags=["analysis-chat"])


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)
    current_criteria: Optional[dict] = None
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    message: str
    criteria: dict
    count: int
    sample_companies: List[dict]
    suggestions: List[str] = []
    filter_summary: str = ""
    conversation_id: Optional[str] = None
    nivo_context_version: str = ""
    chat_persisted: bool = False


@router.post("/", response_model=ChatResponse)
async def chat_refine(request: Request, body: ChatRequest):
    sub = get_current_user_id(request)
    ctx = load_nivo_context()
    thesis = thesis_block_for_llm(ctx)
    use_pg = os.getenv("DATABASE_SOURCE", "postgres").lower() == "postgres"

    try:
        analyzer = IntentAnalyzer()
        filter_engine = FinancialFilter()
        db = get_database_service()

        current: Optional[FilterCriteria] = None
        if body.current_criteria:
            current = filter_criteria_from_dict(body.current_criteria)

        history_messages = None
        conv_id: Optional[str] = None

        if sub and use_pg:
            try:
                if body.conversation_id and is_valid_uuid(body.conversation_id):
                    if not verify_conversation_owner(body.conversation_id, sub):
                        raise HTTPException(
                            status_code=400, detail="Invalid or expired conversation"
                        )
                    conv_id = body.conversation_id
                    history_messages = load_history_openai(conv_id, sub)
                else:
                    t = body.message.strip()
                    title = (t[:77] + "…") if len(t) > 80 else (t or "Sourcing chat")
                    conv_id = create_conversation(
                        user_sub=sub,
                        nivo_context_version=ctx.version,
                        title=title,
                    )
            except HTTPException:
                raise
            except Exception as e:
                logger.warning("Sourcing chat persistence unavailable: %s", e)
                conv_id = None
                history_messages = None

        new_criteria = analyzer.parse_prompt(
            body.message,
            current,
            nivo_thesis_block=thesis,
            history_messages=history_messages,
        )

        stats = filter_engine.get_filter_stats(new_criteria)
        total_count = int(stats["total_matches"])
        filter_summary = humanize_filter_criteria(new_criteria)

        import copy

        sample_criteria = copy.copy(new_criteria)
        sample_criteria.max_results = 5
        orgnrs = filter_engine.filter(sample_criteria)

        sample: List[dict] = []
        if orgnrs:
            placeholders = ",".join("?" * len(orgnrs))
            sql = f"""
            SELECT c.company_name, m.latest_revenue_sek, m.avg_ebitda_margin
            FROM companies c
            JOIN company_metrics m ON m.orgnr = c.orgnr
            WHERE c.orgnr IN ({placeholders})
            """
            rows = db.run_raw_query(sql, params=orgnrs)
            sample = [dict(row) for row in rows]

        assistant_reply = (
            f"{new_criteria.description}\n\n{total_count} companies match your filters."
        )
        did_persist = False
        if sub and use_pg and conv_id:
            try:
                append_messages(
                    conversation_id=conv_id,
                    user_sub=sub,
                    user_text=body.message,
                    assistant_text=assistant_reply,
                )
                did_persist = True
            except Exception as e:
                logger.warning("Failed to append sourcing chat: %s", e)

        return ChatResponse(
            message=new_criteria.description,
            criteria=new_criteria.__dict__,
            count=total_count,
            sample_companies=sample,
            suggestions=new_criteria.suggestions,
            filter_summary=filter_summary,
            conversation_id=conv_id,
            nivo_context_version=ctx.version,
            chat_persisted=did_persist,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Chat error: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e
