"""Unit tests for screening Layer 2 schema and blend helper."""

from __future__ import annotations

import unittest

from backend.services.screening_layer2.blend import blend_score
from backend.services.screening_layer2.evidence_fetch import _substantive_body_chars
from backend.services.screening_layer2.models import Layer2Classification, openai_json_schema_strict


class ScreeningLayer2ModelsTest(unittest.TestCase):
    def test_openai_schema_is_object_with_required(self):
        schema = openai_json_schema_strict()
        self.assertEqual(schema.get("type"), "object")
        self.assertIn("orgnr", schema.get("required", []))
        self.assertFalse(schema.get("additionalProperties", True))

    def test_round_trip_pydantic(self):
        raw = {
            "orgnr": "5562146018",
            "company_name": "Example AB",
            "is_fit_for_nivo": True,
            "fit_confidence": 0.72,
            "business_type": "product_company",
            "operating_model": "brand_owner",
            "is_subsidiary_or_group_company": False,
            "is_service_heavy": False,
            "is_construction_or_installation": False,
            "is_generic_distributor": False,
            "is_hospitality_or_property_company": False,
            "niche_indicator": "high",
            "differentiation_indicator": "medium",
            "repeat_purchase_indicator": "medium",
            "scalable_business_indicator": "high",
            "reason_summary": "Product-led brand; clear SKU language on site.",
            "red_flags": [],
            "evidence": ["Homepage: product categories listed"],
        }
        obj = Layer2Classification.model_validate(raw)
        self.assertTrue(obj.is_fit_for_nivo)

    def test_substantive_body_chars_ignores_notes(self):
        chunks = [
            "=== NOTE: x ===\nboilerplate " + "x" * 500,
            "=== PAGE: https://a.se/ ===\nhello world product",
        ]
        self.assertEqual(_substantive_body_chars(chunks), len("hello world product"))

    def test_blend_formula(self):
        hi = blend_score(90.0, True, 0.8, 0.4, 0.6)
        lo = blend_score(90.0, False, 0.8, 0.4, 0.6)
        self.assertGreater(hi, lo)
        # wsum zero → Stage 1 only
        self.assertAlmostEqual(blend_score(50.0, False, 0.0, 0.0, 0.0), 50.0)


if __name__ == "__main__":
    unittest.main()
