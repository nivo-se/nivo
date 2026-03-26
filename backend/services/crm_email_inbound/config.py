from __future__ import annotations

import os


def resend_api_key() -> str | None:
    v = (os.getenv("RESEND_API_KEY") or "").strip()
    return v or None


def resend_reply_domain() -> str:
    return (os.getenv("RESEND_REPLY_DOMAIN") or "").strip().lower()


def webhook_secret() -> str | None:
    v = (os.getenv("RESEND_WEBHOOK_SECRET") or "").strip()
    return v or None


def is_production_like() -> bool:
    env = (os.getenv("ENVIRONMENT") or os.getenv("APP_ENV") or "development").lower()
    return env in ("production", "prod", "staging")


def webhook_verify_allowed() -> bool:
    """Explicit opt-in to skip Svix verification when RESEND_WEBHOOK_SECRET is unset (local only)."""
    return (os.getenv("RESEND_WEBHOOK_VERIFY_DISABLED") or "").lower() in ("1", "true", "yes")
