"""Attio integration package.

One-way push from Nivo (research engine) into Attio (CRM source of truth).
Read-back is intentionally not supported here — humans edit Attio directly,
optionally via Claude + Attio's MCP server.

Public surface:
    AttioClient   — thin httpx wrapper with rate-limit handling
    push          — high-level idempotent operations (assert_company, …)
    mappings      — pure functions converting Nivo rows to Attio attribute payloads

All push operations are no-ops when ATTIO_SYNC_ENABLED is not "true",
so importing this package never has side effects.
"""

from .client import AttioClient, AttioError, AttioRateLimitError  # noqa: F401

__all__ = ["AttioClient", "AttioError", "AttioRateLimitError"]
