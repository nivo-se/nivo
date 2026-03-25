"""Trusted identity path for Layer 2 (narrow recall recovery without global threshold cuts)."""

from __future__ import annotations

import unittest

from backend.services.screening_layer2.domain_identity import (
    TavilyHit,
    compute_layer2_identity_low,
    compute_trusted_identity,
    competing_entity_detected,
)


class TrustedIdentityTest(unittest.TestCase):
    def _fp(self, dom: str, sc: float, n: int) -> tuple:
        hits = [
            TavilyHit(url=f"https://{dom}/", title="x", content="y", score=0.5) for _ in range(n)
        ]
        return (dom, sc, hits)

    def test_stage1_trusted_allows_noisy_second_cluster(self):
        """High stage1 + single FP + unrelated #2 in no_block → not identity_low when trusted."""
        ranked_fp = [self._fp("getinge.com", 7.5, 4)]
        ranked_nb = [
            self._fp("getinge.com", 7.5, 4),
            ("matrixbcg.com", 3.5, [TavilyHit("https://m.com/", "t", "c", 0.3)]),
        ]
        tr = compute_trusted_identity(
            "Getinge AB",
            homepage_hint=None,
            stage1_total_score=86.0,
            ranked_fp_only=ranked_fp,
            ranked_no_block=ranked_nb,
        )
        self.assertTrue(tr)
        low = compute_layer2_identity_low(
            ranked_fp,
            ranked_nb,
            "Getinge AB",
            homepage_verified=False,
            had_top_fp_candidate=True,
            trusted_identity=tr,
        )
        self.assertFalse(low)

    def test_competing_two_fp_blocks_trusted(self):
        """Two score-near FP clusters, different brands → no trusted."""
        a = self._fp("alpha.com", 5.0, 2)
        b = self._fp("beta.com", 4.9, 2)
        tr = compute_trusted_identity(
            "Alpha AB",
            homepage_hint=None,
            stage1_total_score=90.0,
            ranked_fp_only=[a, b],
            ranked_no_block=[a, b],
        )
        self.assertFalse(tr)

    def test_competing_entity_detected(self):
        a = self._fp("alpha.com", 5.0, 2)
        b = self._fp("beta.com", 4.9, 2)
        self.assertTrue(competing_entity_detected([a, b], "Alpha AB"))

    def test_homepage_csv_match_trusted(self):
        ranked_fp = [self._fp("elekta.com", 5.5, 1)]
        ranked_nb = [ranked_fp[0], ("go.jp", 3.5, [TavilyHit("https://go.jp/", "t", "c", 0.3)])]
        tr = compute_trusted_identity(
            "Elekta AB",
            homepage_hint="https://www.elekta.com",
            stage1_total_score=70.0,
            ranked_fp_only=ranked_fp,
            ranked_no_block=ranked_nb,
        )
        self.assertTrue(tr)
        low = compute_layer2_identity_low(
            ranked_fp,
            ranked_nb,
            "Elekta AB",
            homepage_verified=False,
            had_top_fp_candidate=True,
            trusted_identity=tr,
        )
        self.assertFalse(low)

    def test_untrusted_still_strict(self):
        # Weak cluster (not ``very_strong_cluster_signal``) and low stage1 → no trusted path.
        ranked_fp = [self._fp("getinge.com", 4.5, 2)]
        ranked_nb = [
            ranked_fp[0],
            ("matrixbcg.com", 3.5, [TavilyHit("https://m.com/", "t", "c", 0.3)]),
        ]
        tr = compute_trusted_identity(
            "Getinge AB",
            homepage_hint=None,
            stage1_total_score=50.0,
            ranked_fp_only=ranked_fp,
            ranked_no_block=ranked_nb,
        )
        self.assertFalse(tr)
        low = compute_layer2_identity_low(
            ranked_fp,
            ranked_nb,
            "Getinge AB",
            homepage_verified=False,
            had_top_fp_candidate=True,
            trusted_identity=False,
        )
        self.assertTrue(low)


if __name__ == "__main__":
    unittest.main()
