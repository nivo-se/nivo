"""Unit tests for CRM inbound token parsing (no FastAPI deps — run full suite in venv with pytest)."""

from __future__ import annotations

import unittest

from backend.services.crm_email_inbound.parse import (
    find_reply_recipient,
    parse_thread_token_from_recipient,
    validate_thread_token_format,
)


class ParseThreadTokenTest(unittest.TestCase):
    def test_valid_token(self):
        tok = "abcdef0123456789abcdef0123456789"
        self.assertTrue(validate_thread_token_format(tok))
        self.assertEqual(
            parse_thread_token_from_recipient(
                f"reply+{tok}@send.nivogroup.se",
                "send.nivogroup.se",
            ),
            tok,
        )

    def test_wrong_domain(self):
        self.assertIsNone(
            parse_thread_token_from_recipient(
                "reply+abcdef0123456789abcdef0123456789@other.com",
                "send.nivogroup.se",
            )
        )

    def test_find_reply_recipient(self):
        dom = "send.nivogroup.se"
        r = find_reply_recipient(
            ["someone@example.com", "reply+abcdef0123456789abcdef0123456789@" + dom],
            dom,
        )
        self.assertEqual(r, "reply+abcdef0123456789abcdef0123456789@" + dom)


if __name__ == "__main__":
    unittest.main()
