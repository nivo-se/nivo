"""Unit tests for the Attio HTTP client (no network — uses httpx MockTransport)."""

from __future__ import annotations

import os
import unittest
from typing import Callable

import httpx

from backend.services.attio.client import (
    AttioClient,
    AttioError,
    AttioRateLimitError,
)


def _make_client(
    handler: Callable[[httpx.Request], httpx.Response],
    *,
    max_retries: int = 3,
) -> AttioClient:
    transport = httpx.MockTransport(handler)
    http = httpx.Client(
        base_url="https://api.attio.com/v2",
        transport=transport,
        headers={"Authorization": "Bearer test"},
    )
    return AttioClient(api_key="test", max_retries=max_retries, http_client=http)


class ConstructorTest(unittest.TestCase):
    def test_raises_when_api_key_missing(self):
        prior = os.environ.pop("ATTIO_API_KEY", None)
        try:
            with self.assertRaises(AttioError):
                AttioClient()
        finally:
            if prior is not None:
                os.environ["ATTIO_API_KEY"] = prior


class AssertCompanyTest(unittest.TestCase):
    def test_sends_put_with_matching_attribute_query(self):
        captured: dict = {}

        def handler(request: httpx.Request) -> httpx.Response:
            captured["method"] = request.method
            captured["url"] = str(request.url)
            captured["body"] = request.read()
            return httpx.Response(
                200, json={"data": {"id": {"record_id": "rec_1"}}}
            )

        with _make_client(handler) as client:
            response = client.assert_company(values={"name": "Acme"})

        self.assertEqual(captured["method"], "PUT")
        self.assertIn("/objects/companies/records", captured["url"])
        self.assertIn("matching_attribute=domains", captured["url"])
        self.assertEqual(response["data"]["id"]["record_id"], "rec_1")

    def test_raises_attio_error_on_4xx(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(400, json={"error": "bad request"})

        with _make_client(handler) as client:
            with self.assertRaises(AttioError):
                client.assert_company(values={"name": "Acme"})


class RateLimitRetryTest(unittest.TestCase):
    def test_retries_on_429_then_succeeds(self):
        calls = {"n": 0}

        def handler(request: httpx.Request) -> httpx.Response:
            calls["n"] += 1
            if calls["n"] == 1:
                return httpx.Response(
                    429, headers={"Retry-After": "0"}, json={"error": "rate"}
                )
            return httpx.Response(200, json={"ok": True})

        with _make_client(handler) as client:
            result = client.request("GET", "/self")

        self.assertEqual(calls["n"], 2)
        self.assertEqual(result, {"ok": True})

    def test_raises_after_max_retries(self):
        calls = {"n": 0}

        def handler(request: httpx.Request) -> httpx.Response:
            calls["n"] += 1
            return httpx.Response(
                429, headers={"Retry-After": "0"}, json={"error": "rate"}
            )

        with _make_client(handler, max_retries=2) as client:
            with self.assertRaises(AttioRateLimitError):
                client.request("GET", "/self")
        self.assertEqual(calls["n"], 3)  # initial + 2 retries

    def test_caps_backoff_for_long_retry_after(self):
        client = _make_client(lambda r: httpx.Response(200))
        try:
            self.assertEqual(client._retry_after_seconds("999"), client._backoff_cap_sec)
            self.assertEqual(client._retry_after_seconds(None), 1.0)
            self.assertEqual(client._retry_after_seconds("garbage"), 1.0)
        finally:
            client.close()


if __name__ == "__main__":
    unittest.main()
