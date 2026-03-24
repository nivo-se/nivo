"""
Pydantic model + OpenAI strict JSON Schema for screening Layer 2 classification.
"""

from __future__ import annotations

from typing import List, Literal

from pydantic import BaseModel, ConfigDict, Field


class Layer2Classification(BaseModel):
    """One structured judgment per company (no long-form report)."""

    model_config = ConfigDict(extra="forbid")

    orgnr: str = Field(..., description="Swedish org number, digits only")
    company_name: str
    is_fit_for_nivo: bool
    fit_confidence: float = Field(..., ge=0.0, le=1.0)
    business_type: Literal["product_company", "hybrid", "service_company", "unknown"]
    operating_model: Literal[
        "manufacturer",
        "brand_owner",
        "distributor",
        "installer",
        "consultancy",
        "software",
        "unknown",
    ]
    is_subsidiary_or_group_company: bool
    is_service_heavy: bool
    is_construction_or_installation: bool
    is_generic_distributor: bool
    is_hospitality_or_property_company: bool
    niche_indicator: Literal["low", "medium", "high"]
    differentiation_indicator: Literal["low", "medium", "high"]
    repeat_purchase_indicator: Literal["low", "medium", "high"]
    scalable_business_indicator: Literal["low", "medium", "high"]
    reason_summary: str = Field(..., max_length=800)
    red_flags: List[str] = Field(default_factory=list)
    evidence: List[str] = Field(
        default_factory=list,
        description="Short bullets citing what was seen on fetched pages (URLs or page titles)",
    )


def openai_json_schema_strict() -> dict:
    """
    JSON Schema for OpenAI chat.completions response_format json_schema strict mode.
    """
    return {
        "type": "object",
        "properties": {
            "orgnr": {"type": "string"},
            "company_name": {"type": "string"},
            "is_fit_for_nivo": {"type": "boolean"},
            "fit_confidence": {"type": "number", "minimum": 0, "maximum": 1},
            "business_type": {
                "type": "string",
                "enum": ["product_company", "hybrid", "service_company", "unknown"],
            },
            "operating_model": {
                "type": "string",
                "enum": [
                    "manufacturer",
                    "brand_owner",
                    "distributor",
                    "installer",
                    "consultancy",
                    "software",
                    "unknown",
                ],
            },
            "is_subsidiary_or_group_company": {"type": "boolean"},
            "is_service_heavy": {"type": "boolean"},
            "is_construction_or_installation": {"type": "boolean"},
            "is_generic_distributor": {"type": "boolean"},
            "is_hospitality_or_property_company": {"type": "boolean"},
            "niche_indicator": {"type": "string", "enum": ["low", "medium", "high"]},
            "differentiation_indicator": {"type": "string", "enum": ["low", "medium", "high"]},
            "repeat_purchase_indicator": {"type": "string", "enum": ["low", "medium", "high"]},
            "scalable_business_indicator": {"type": "string", "enum": ["low", "medium", "high"]},
            "reason_summary": {"type": "string"},
            "red_flags": {"type": "array", "items": {"type": "string"}},
            "evidence": {"type": "array", "items": {"type": "string"}},
        },
        "required": [
            "orgnr",
            "company_name",
            "is_fit_for_nivo",
            "fit_confidence",
            "business_type",
            "operating_model",
            "is_subsidiary_or_group_company",
            "is_service_heavy",
            "is_construction_or_installation",
            "is_generic_distributor",
            "is_hospitality_or_property_company",
            "niche_indicator",
            "differentiation_indicator",
            "repeat_purchase_indicator",
            "scalable_business_indicator",
            "reason_summary",
            "red_flags",
            "evidence",
        ],
        "additionalProperties": False,
    }
