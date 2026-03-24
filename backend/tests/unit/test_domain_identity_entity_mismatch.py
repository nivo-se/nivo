"""Hard entity-mismatch filter for Layer 2 domain clustering."""

from __future__ import annotations

import unittest

from backend.services.screening_layer2.domain_identity import (
    TavilyHit,
    filter_grouped_domains_entity_mismatch,
    should_remove_entity_mismatch_domain,
)


class EntityMismatchFilterTest(unittest.TestCase):
    def test_innofactor_like_cluster_removed_for_cramo(self):
        hits = [
            TavilyHit(
                url="https://www.innofactor.com/foo",
                title="Innofactor — investor news",
                content="Innofactor reports quarterly results for Nordic software business.",
                score=0.9,
            )
        ]
        self.assertTrue(
            should_remove_entity_mismatch_domain("innofactor.com", hits, "Cramo AB"),
        )
        g = filter_grouped_domains_entity_mismatch(
            {
                "innofactor.com": hits,
                "cramo.se": [
                    TavilyHit(
                        url="https://www.cramo.se/",
                        title="Cramo — equipment rental",
                        content="Cramo rents machinery across Sweden.",
                        score=0.85,
                    )
                ],
            },
            "Cramo AB",
        )
        self.assertEqual(list(g.keys()), ["cramo.se"])

    def test_keeps_domain_when_target_name_in_snippet(self):
        """Partnership / dual mention — target token present → do not remove."""
        hits = [
            TavilyHit(
                url="https://partner.com/pr",
                title="Innofactor acquires stake in Cramo operations",
                content="Cramo and Innofactor announce collaboration.",
                score=0.8,
            )
        ]
        self.assertFalse(
            should_remove_entity_mismatch_domain("partner.com", hits, "Cramo AB"),
        )

    def test_keeps_when_domain_reflects_target(self):
        hits = [
            TavilyHit(
                url="https://cramo.se/",
                title="Welcome",
                content="Equipment rental leader.",
                score=0.9,
            )
        ]
        self.assertFalse(
            should_remove_entity_mismatch_domain("cramo.se", hits, "Cramo AB"),
        )


if __name__ == "__main__":
    unittest.main()
