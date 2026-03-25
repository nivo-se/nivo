"""Unit tests for shared homepage + About fetch helpers."""

from __future__ import annotations

import unittest

from backend.services.web_intel.site_about_fetch import (
    normalize_homepage,
    pick_best,
    score_about,
)


class TestSiteAboutFetch(unittest.TestCase):
    def test_normalize_homepage(self) -> None:
        self.assertIsNone(normalize_homepage(None))
        self.assertIsNone(normalize_homepage(""))
        self.assertEqual(normalize_homepage("example.com"), "https://example.com")
        self.assertEqual(normalize_homepage("https://foo.se/path"), "https://foo.se/path")

    def test_pick_best_about(self) -> None:
        cands = [
            ("https://x.se/products", "Produkter"),
            ("https://x.se/om-oss", "Om oss"),
        ]
        excl: set[str] = set()
        best = pick_best(cands, score_about, excl)
        self.assertEqual(best, "https://x.se/om-oss")


if __name__ == "__main__":
    unittest.main()
