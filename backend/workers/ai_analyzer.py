from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, Optional

from openai import OpenAI

logger = logging.getLogger(__name__)

DEFAULT_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


class AIAnalyzer:
    def __init__(self, api_key: Optional[str] = None) -> None:
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.client: Optional[OpenAI] = None
        if self.api_key:
            self.client = OpenAI(api_key=self.api_key)

    def analyze(
        self,
        company_name: str,
        website: Optional[str],
        raw_text: Optional[str],
    ) -> Dict[str, Any]:
        if not raw_text:
            return self._fallback_result(company_name, website)

        if not self.client:
            logger.warning("OPENAI_API_KEY not configured, returning fallback analysis")
            return self._fallback_result(company_name, website)

        prompt = (
            "You are an investment analyst. Summarize the company using the text "
            "provided. Return JSON with keys: product_description, end_market, "
            "customer_types, strategic_fit_score (1-10), defensibility_score (1-10), "
            "value_chain_position, ai_notes."
        )

        response = self.client.responses.create(
            model=DEFAULT_MODEL,
            input=[
                {"role": "system", "content": prompt},
                {
                    "role": "user",
                    "content": f"Company: {company_name}\nWebsite: {website}\nContent:\n{raw_text[:6000]}",
                },
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "ai_profile_schema",
                    "schema": {
                        "type": "object",
                        "properties": {
                            "product_description": {"type": "string"},
                            "end_market": {"type": "string"},
                            "customer_types": {"type": "string"},
                            "strategic_fit_score": {"type": "integer"},
                            "defensibility_score": {"type": "integer"},
                            "value_chain_position": {"type": "string"},
                            "ai_notes": {"type": "string"},
                        },
                        "required": [
                            "product_description",
                            "end_market",
                            "customer_types",
                            "strategic_fit_score",
                            "defensibility_score",
                            "value_chain_position",
                            "ai_notes",
                        ],
                    },
                },
            },
        )
        try:
            content = response.output[0].content[0].text  # type: ignore[attr-defined]
            data = json.loads(content)
            data["strategic_fit_score"] = self._normalize_score(data.get("strategic_fit_score"))
            data["defensibility_score"] = self._normalize_score(data.get("defensibility_score"))
            return data
        except Exception as exc:  # pragma: no cover - fallback path
            logger.warning("Failed to parse AI response: %s", exc)
            return self._fallback_result(company_name, website)

    @staticmethod
    def _fallback_result(company_name: str, website: Optional[str]) -> Dict[str, Any]:
        return {
            "product_description": f"Summary unavailable for {company_name}",
            "end_market": "",
            "customer_types": "",
            "strategic_fit_score": 5,
            "defensibility_score": 5,
            "value_chain_position": "",
            "ai_notes": f"Website: {website or 'N/A'}",
        }

    @staticmethod
    def _normalize_score(value: Any) -> int:
        try:
            number = int(value)
        except (TypeError, ValueError):
            return 5
        return max(1, min(10, number))

