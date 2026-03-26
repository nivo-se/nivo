"""
POST /webhooks/email/inbound — Resend email.received (Svix-signed).
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Request, Response

from ..services.crm_email_inbound.config import (
    is_production_like,
    resend_reply_domain,
    webhook_secret,
    webhook_verify_allowed,
)
from ..services.crm_email_inbound.db import (
    get_thread_by_token,
    insert_inbound_message,
    insert_reply_interaction,
    insert_unmatched,
)
from ..services.crm_email_inbound.parse import find_reply_recipient, parse_thread_token_from_recipient
from ..services.crm_email_inbound.resend_client import fetch_received_email

logger = logging.getLogger(__name__)

router = APIRouter(tags=["webhooks"])


def _verify_svix_payload(raw_body: bytes, request: Request) -> dict[str, Any]:
    secret = webhook_secret()
    if not secret:
        if is_production_like():
            raise HTTPException(status_code=503, detail="webhook signing secret not configured")
        if not webhook_verify_allowed():
            raise HTTPException(
                status_code=503,
                detail="set RESEND_WEBHOOK_SECRET or RESEND_WEBHOOK_VERIFY_DISABLED=true for local dev",
            )
        logger.warning("inbound webhook: RESEND_WEBHOOK_VERIFY_DISABLED — accepting unsigned payload")
        return json.loads(raw_body.decode("utf-8"))

    try:
        from svix.webhooks import Webhook
    except ImportError as e:
        raise HTTPException(status_code=503, detail="svix package not installed") from e

    wh = Webhook(secret)
    headers = {
        "svix-id": request.headers.get("svix-id", ""),
        "svix-timestamp": request.headers.get("svix-timestamp", ""),
        "svix-signature": request.headers.get("svix-signature", ""),
    }
    try:
        body_str = raw_body.decode("utf-8")
        return wh.verify(body_str, headers)
    except Exception:
        logger.warning("inbound webhook: signature verification failed")
        raise HTTPException(status_code=403, detail="invalid signature") from None


@router.post("/webhooks/email/inbound")
async def inbound_email(request: Request) -> Response:
    raw = await request.body()
    logger.info("inbound email webhook received bytes=%s", len(raw))

    try:
        payload = _verify_svix_payload(raw, request)
    except HTTPException:
        raise

    event_type = payload.get("type")
    if event_type != "email.received":
        logger.info("inbound webhook ignored event_type=%s", event_type)
        return Response(status_code=204)

    data = payload.get("data") or {}
    inbound_email_id = data.get("email_id")
    if not inbound_email_id:
        logger.warning("inbound webhook missing data.email_id")
        raise HTTPException(status_code=400, detail="missing email_id")

    reply_domain = resend_reply_domain()
    if not reply_domain:
        logger.error("RESEND_REPLY_DOMAIN not set")
        raise HTTPException(status_code=503, detail="RESEND_REPLY_DOMAIN not configured")

    try:
        received = await fetch_received_email(str(inbound_email_id))
    except httpx.HTTPError as e:
        logger.warning("Failed to fetch received email from Resend: %s", e)
        raise HTTPException(status_code=502, detail="upstream fetch failed") from e
    except RuntimeError as e:
        logger.warning("%s", e)
        raise HTTPException(status_code=503, detail=str(e)) from e

    to_list = received.get("to") or []
    if isinstance(to_list, str):
        to_list = [to_list]

    match_addr = find_reply_recipient(to_list, reply_domain)
    token: str | None = None
    if match_addr:
        token = parse_thread_token_from_recipient(match_addr, reply_domain)

    raw_meta = {
        "webhook_event": payload,
        "resend_received": received,
    }

    dedupe_key = f"resend:received:{inbound_email_id}"

    if not token:
        logger.warning(
            "inbound thread unmatched: no token (to=%s)",
            to_list[:3] if to_list else [],
        )
        insert_unmatched(
            token_attempted=None,
            from_email=_norm_from(received.get("from")),
            to_email=match_addr,
            subject=received.get("subject"),
            provider_inbound_email_id=str(inbound_email_id),
            raw_payload=raw_meta,
        )
        return Response(content=json.dumps({"ok": True, "matched": False}), media_type="application/json")

    thread = get_thread_by_token(token)
    if not thread:
        logger.warning("inbound thread unmatched: unknown token prefix=%s", token[:8])
        insert_unmatched(
            token_attempted=token,
            from_email=_norm_from(received.get("from")),
            to_email=match_addr,
            subject=received.get("subject"),
            provider_inbound_email_id=str(inbound_email_id),
            raw_payload=raw_meta,
        )
        return Response(content=json.dumps({"ok": True, "matched": False}), media_type="application/json")

    thread_id = str(thread["id"])
    deal_id = str(thread["deal_id"])
    contact_id = str(thread["contact_id"])

    msg_id = insert_inbound_message(
        thread_id=thread_id,
        provider_message_id=str(inbound_email_id),
        from_email=_norm_from(received.get("from")),
        to_emails=to_list if isinstance(to_list, list) else None,
        subject=received.get("subject"),
        text_body=received.get("text"),
        html_body=received.get("html"),
        raw_payload=raw_meta,
        dedupe_key=dedupe_key,
        received_at=received.get("created_at"),
    )

    if msg_id is None:
        logger.info("inbound duplicate ignored dedupe_key=%s", dedupe_key)
        return Response(content=json.dumps({"ok": True, "duplicate": True}), media_type="application/json")

    logger.info("inbound message persisted id=%s thread_id=%s", msg_id, thread_id)

    subj = (received.get("subject") or "")[:120]
    insert_reply_interaction(
        deal_id=deal_id,
        contact_id=contact_id,
        summary=f"Reply received: {subj}" if subj else "Reply received",
        metadata={
            "crm_message_id": msg_id,
            "provider_inbound_email_id": str(inbound_email_id),
        },
    )

    return Response(content=json.dumps({"ok": True, "matched": True, "message_id": msg_id}), media_type="application/json")


def _norm_from(from_val: Any) -> str | None:
    if from_val is None:
        return None
    return str(from_val)[:512]
