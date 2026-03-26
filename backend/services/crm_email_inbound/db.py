"""Postgres access for inbound CRM email (psycopg2, same DSN as backend)."""

from __future__ import annotations

import os
import socket
from contextlib import contextmanager
from typing import Any, Generator

import psycopg2
from psycopg2.extras import Json, RealDictCursor

SCHEMA = "deep_research"


def _port_open(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=0.25):
            return True
    except Exception:
        return False


def build_dsn() -> str:
    env_url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
    if env_url:
        return env_url
    host = os.getenv("POSTGRES_HOST") or "localhost"
    user = os.getenv("POSTGRES_USER") or "nivo"
    password = os.getenv("POSTGRES_PASSWORD") or "nivo"
    dbname = os.getenv("POSTGRES_DB") or "nivo"
    port_s = os.getenv("POSTGRES_PORT")
    if port_s:
        port = int(port_s)
    else:
        port = 5433 if _port_open(host, 5433) else 5432
    return f"postgresql://{user}:{password}@{host}:{port}/{dbname}"


@contextmanager
def get_conn() -> Generator[Any, None, None]:
    conn = psycopg2.connect(build_dsn())
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_thread_by_token(token: str) -> dict[str, Any] | None:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                f"""
                SELECT id, token, deal_id, contact_id, company_id, status
                FROM {SCHEMA}.crm_email_threads
                WHERE token = %s
                LIMIT 1
                """,
                (token,),
            )
            row = cur.fetchone()
            return dict(row) if row else None


def insert_inbound_message(
    *,
    thread_id: str,
    provider_message_id: str | None,
    from_email: str | None,
    to_emails: list[str] | None,
    subject: str | None,
    text_body: str | None,
    html_body: str | None,
    raw_payload: dict,
    dedupe_key: str,
    received_at: str | None,
) -> str | None:
    """Returns new message id, or None if duplicate (dedupe)."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                INSERT INTO {SCHEMA}.crm_email_messages (
                  thread_id, direction, provider, provider_message_id,
                  from_email, to_emails, subject, text_body, html_body,
                  raw_payload, dedupe_key, received_at
                ) VALUES (
                  %s, 'inbound', 'resend', %s,
                  %s, %s, %s, %s, %s,
                  %s, %s, COALESCE(%s::timestamptz, now())
                )
                ON CONFLICT (dedupe_key) DO NOTHING
                RETURNING id::text
                """,
                (
                    thread_id,
                    provider_message_id,
                    from_email,
                    to_emails,
                    subject,
                    text_body,
                    html_body,
                    Json(raw_payload),
                    dedupe_key,
                    received_at,
                ),
            )
            row = cur.fetchone()
            return row[0] if row else None


def insert_unmatched(
    *,
    token_attempted: str | None,
    from_email: str | None,
    to_email: str | None,
    subject: str | None,
    provider_inbound_email_id: str | None,
    raw_payload: dict,
) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                INSERT INTO {SCHEMA}.crm_email_inbound_unmatched (
                  token_attempted, from_email, to_email, subject,
                  provider_inbound_email_id, raw_payload
                ) VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    token_attempted,
                    from_email,
                    to_email,
                    subject,
                    provider_inbound_email_id,
                    Json(raw_payload),
                ),
            )


def insert_reply_interaction(
    *,
    deal_id: str,
    contact_id: str,
    summary: str,
    metadata: dict,
) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                INSERT INTO {SCHEMA}.interactions (
                  deal_id, contact_id, email_id, type, summary, metadata
                ) VALUES (%s, %s, NULL, 'reply_received', %s, %s)
                """,
                (deal_id, contact_id, summary, Json(metadata)),
            )
