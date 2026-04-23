"""Thin httpx wrapper around the Attio REST API.

Scope is deliberately narrow: only the verbs we use for the one-way push
(assert record, create note). Anything more should be added explicitly here
rather than letting callers hand-craft URLs.

Rate limits (https://docs.attio.com/rest-api/guides/rate-limiting):
    100 reads/sec, 25 writes/sec, plus a score-based sliding window on
    list-records / list-entries. The client retries 429 responses up to
    `max_retries` times, honoring `Retry-After`.
"""

from __future__ import annotations

import logging
import os
import time
from email.utils import parsedate_to_datetime
from typing import Any, Mapping, Optional

import httpx

logger = logging.getLogger(__name__)

ATTIO_BASE_URL = "https://api.attio.com/v2"
DEFAULT_TIMEOUT_SEC = 30.0
DEFAULT_MAX_RETRIES = 5
DEFAULT_BACKOFF_CAP_SEC = 5.0


class AttioError(RuntimeError):
    """Base class for all Attio client failures."""


class AttioRateLimitError(AttioError):
    """Raised when Attio returns 429 after `max_retries` retries."""


class AttioClient:
    """Synchronous Attio REST client.

    Construction is cheap; the underlying httpx.Client is lazy. Reuse a single
    instance per process to amortize connection setup.
    """

    def __init__(
        self,
        *,
        api_key: Optional[str] = None,
        base_url: str = ATTIO_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT_SEC,
        max_retries: int = DEFAULT_MAX_RETRIES,
        backoff_cap_sec: float = DEFAULT_BACKOFF_CAP_SEC,
        http_client: Optional[httpx.Client] = None,
    ) -> None:
        self._api_key = api_key or os.environ.get("ATTIO_API_KEY", "").strip()
        if not self._api_key:
            raise AttioError(
                "ATTIO_API_KEY is not set. Generate one in Attio → Settings → "
                "Developers → API key, then export ATTIO_API_KEY."
            )
        self._base_url = base_url.rstrip("/")
        self._max_retries = max_retries
        self._backoff_cap_sec = backoff_cap_sec
        self._http: httpx.Client = http_client or httpx.Client(
            base_url=self._base_url,
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Accept": "application/json",
                "Content-Type": "application/json",
                "User-Agent": "nivo-attio/0.1",
            },
            timeout=timeout,
        )

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> "AttioClient":
        return self

    def __exit__(self, *exc_info: Any) -> None:
        self.close()

    # ------------------------------------------------------------------ core --

    def request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Mapping[str, Any]] = None,
        json: Optional[Mapping[str, Any]] = None,
    ) -> dict[str, Any]:
        """Issue a request, retrying on 429 honoring Retry-After.

        Returns the parsed JSON body. Raises AttioError on any non-2xx after
        retries are exhausted.
        """
        attempt = 0
        while True:
            attempt += 1
            response = self._http.request(method, path, params=params, json=json)
            if response.status_code == 429:
                if attempt > self._max_retries:
                    raise AttioRateLimitError(
                        f"Attio rate-limited after {self._max_retries} retries "
                        f"on {method} {path}"
                    )
                wait_sec = self._retry_after_seconds(response.headers.get("Retry-After"))
                logger.warning(
                    "attio rate limit hit method=%s path=%s attempt=%d retry_in=%.2fs",
                    method, path, attempt, wait_sec,
                )
                time.sleep(wait_sec)
                continue

            if response.status_code >= 400:
                body_preview = response.text[:500]
                raise AttioError(
                    f"Attio {method} {path} failed: HTTP {response.status_code}: {body_preview}"
                )

            if not response.content:
                return {}
            return response.json()

    # ----------------------------------------------------------------- verbs --

    def identify(self) -> dict[str, Any]:
        """Return token + workspace info (cheap connectivity check)."""
        return self.request("GET", "/self")

    def assert_company(
        self, *, values: Mapping[str, Any], matching_attribute: str = "domains"
    ) -> dict[str, Any]:
        """Idempotent upsert of a company record.

        `values` is the Attio attribute payload (already in Attio shape). Use
        `mappings.nivo_company_to_attio_values` to build it.
        """
        return self.request(
            "PUT",
            "/objects/companies/records",
            params={"matching_attribute": matching_attribute},
            json={"data": {"values": dict(values)}},
        )

    def assert_person(
        self, *, values: Mapping[str, Any], matching_attribute: str = "email_addresses"
    ) -> dict[str, Any]:
        """Idempotent upsert of a person record."""
        return self.request(
            "PUT",
            "/objects/people/records",
            params={"matching_attribute": matching_attribute},
            json={"data": {"values": dict(values)}},
        )

    def create_note(
        self,
        *,
        parent_object: str,
        parent_record_id: str,
        title: str,
        content_markdown: str,
    ) -> dict[str, Any]:
        """Append a note to a record. Notes are not idempotent server-side; the
        caller is responsible for deciding whether to skip duplicates."""
        return self.request(
            "POST",
            "/notes",
            json={
                "data": {
                    "parent_object": parent_object,
                    "parent_record_id": parent_record_id,
                    "title": title,
                    "format": "markdown",
                    "content": content_markdown,
                }
            },
        )

    # ---------------------------------------------------------------- helpers --

    def _retry_after_seconds(self, header_value: Optional[str]) -> float:
        """Parse a Retry-After header (delta-seconds or HTTP-date) to a small
        bounded sleep duration."""
        if not header_value:
            return 1.0
        header_value = header_value.strip()
        if header_value.isdigit():
            return min(float(header_value), self._backoff_cap_sec)
        try:
            target = parsedate_to_datetime(header_value)
        except (TypeError, ValueError):
            return 1.0
        if target is None:
            return 1.0
        delta = target.timestamp() - time.time()
        return max(0.0, min(delta, self._backoff_cap_sec))
