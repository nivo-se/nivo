"""Postgres persistence for AI sourcing chat (public.ai_conversations / ai_messages)."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

from .db_factory import get_database_service

logger = logging.getLogger(__name__)

MAX_HISTORY_MESSAGES = 24  # user+assistant pairs; last N raw rows


def _db():
    return get_database_service()


def create_conversation(
    *,
    user_sub: str,
    nivo_context_version: str,
    title: str,
) -> str:
    rows = _db().run_raw_query(
        """
        INSERT INTO public.ai_conversations (user_sub, title, nivo_context_version, updated_at)
        VALUES (%s, %s, %s, now())
        RETURNING id::text
        """,
        [user_sub, title[:500], nivo_context_version],
    )
    return str(rows[0]["id"])


def verify_conversation_owner(conversation_id: str, user_sub: str) -> bool:
    rows = _db().run_raw_query(
        "SELECT 1 AS ok FROM public.ai_conversations WHERE id = %s::uuid AND user_sub = %s",
        [conversation_id, user_sub],
    )
    return len(rows) > 0


def load_history_openai(
    conversation_id: str, user_sub: str, limit: int = MAX_HISTORY_MESSAGES
) -> List[Dict[str, str]]:
    if not verify_conversation_owner(conversation_id, user_sub):
        return []
    rows = _db().run_raw_query(
        """
        SELECT role, content
        FROM public.ai_messages
        WHERE conversation_id = %s::uuid
        ORDER BY created_at ASC
        LIMIT %s
        """,
        [conversation_id, limit],
    )
    return [{"role": r["role"], "content": r["content"]} for r in rows]


def append_messages(
    *,
    conversation_id: str,
    user_sub: str,
    user_text: str,
    assistant_text: str,
) -> None:
    if not verify_conversation_owner(conversation_id, user_sub):
        raise ValueError("conversation not found or access denied")
    db = _db()
    db.run_raw_query(
        "INSERT INTO public.ai_messages (conversation_id, role, content) VALUES (%s::uuid, 'user', %s)",
        [conversation_id, user_text],
    )
    db.run_raw_query(
        "INSERT INTO public.ai_messages (conversation_id, role, content) VALUES (%s::uuid, 'assistant', %s)",
        [conversation_id, assistant_text],
    )
    db.run_raw_query(
        "UPDATE public.ai_conversations SET updated_at = now() WHERE id = %s::uuid",
        [conversation_id],
    )


def is_valid_uuid(value: str) -> bool:
    try:
        UUID(value)
        return True
    except (ValueError, TypeError):
        return False
