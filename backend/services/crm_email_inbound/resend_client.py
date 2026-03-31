"""Fetch full received email content from Resend API (webhook only carries metadata)."""

from __future__ import annotations

import logging

import httpx

from .config import resend_api_key

logger = logging.getLogger(__name__)


async def fetch_received_email(email_id: str) -> dict:
    key = resend_api_key()
    if not key:
        raise RuntimeError("RESEND_API_KEY is not configured")
    url = f"https://api.resend.com/emails/receiving/{email_id}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            url,
            headers={"Authorization": f"Bearer {key}"},
        )
    if response.status_code != 200:
        logger.warning(
            "Resend receiving fetch failed email_id=%s status=%s",
            email_id,
            response.status_code,
        )
        response.raise_for_status()
    return response.json()
