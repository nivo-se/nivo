"""Short-name / ticker brands (SCA, ICA, ABB) in domain identity — brand match without ≥4-char-only tokens."""

from __future__ import annotations

import unittest

from backend.services.screening_layer2.domain_identity import (
    TavilyHit,
    brand_match_tokens_for_scoring,
    domain_has_brand_keyword_match,
    is_short_name_company,
    same_brand_family,
    score_domain_cluster,
)


class ShortNameCompanyTest(unittest.TestCase):
    def test_core_len_four_is_short(self):
        self.assertTrue(is_short_name_company("SCA AB"))

    def test_uppercase_ticker_in_long_legal_name(self):
        self.assertTrue(is_short_name_company("ICA Gruppen AB"))

    def test_long_name_not_short(self):
        self.assertFalse(is_short_name_company("Getinge AB"))

    def test_brand_tokens_include_ticker_and_long_parts(self):
        toks = brand_match_tokens_for_scoring("SCA Hygiene AB")
        self.assertIn("sca", toks)
        self.assertIn("hygiene", toks)


class ShortNameDomainMatchTest(unittest.TestCase):
    def test_sca_com_matches_sca_hygiene(self):
        self.assertTrue(domain_has_brand_keyword_match("sca.com", "SCA Hygiene AB"))

    def test_sca_com_matches_short_legal(self):
        self.assertTrue(domain_has_brand_keyword_match("sca.com", "SCA AB"))

    def test_ica_gruppen_domain(self):
        self.assertTrue(domain_has_brand_keyword_match("icagruppen.se", "ICA Gruppen AB"))

    def test_unrelated_domain_fails_when_only_short_brand_expected(self):
        self.assertFalse(domain_has_brand_keyword_match("innofactor.com", "SCA Hygiene AB"))

    def test_scandinavian_label_not_confused_with_sca(self):
        self.assertFalse(domain_has_brand_keyword_match("scandinavian.com", "SCA Hygiene AB"))

    def test_long_name_unchanged_getinge(self):
        self.assertTrue(domain_has_brand_keyword_match("getinge.com", "Getinge AB"))


class ShortNameSameBrandFamilyTest(unittest.TestCase):
    def test_ica_tlds(self):
        self.assertTrue(
            same_brand_family("ica.se", "ica.com", "ICA Gruppen AB"),
        )


class ShortNameScoreClusterTest(unittest.TestCase):
    def test_sca_domain_gets_name_signal(self):
        hits = [
            TavilyHit(
                url="https://sca.com/",
                title="SCA Hygiene and Forest Products",
                content="SCA is a leading hygiene and forest products company.",
                score=0.8,
            )
        ]
        s = score_domain_cluster(
            "sca.com",
            hits,
            "SCA Hygiene AB",
            homepage_hint_domain=None,
            blocked_substrings=(),
        )
        self.assertGreater(s, 0.0)


if __name__ == "__main__":
    unittest.main()
