from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from openai import OpenAI

from .prompt_config import PromptConfig, PromptConfigError
from .strategic_fit_analyzer import StrategicFitAnalyzer, StrategicFitResult

logger = logging.getLogger(__name__)

DEFAULT_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
DEFAULT_AGENT_TYPE = os.getenv("AI_ANALYZER_AGENT", "default")
MAX_CONTEXT_CHARS = 6000
MAX_EXCERPT_CHARS = 1200
INLINE_CONTEXT_LIMIT = 2400

CONTENT_SCHEMA = {
    "type": "object",
    "properties": {
        "product_description": {"type": "string"},
        "end_market": {"type": "string"},
        "customer_types": {"type": "string"},
        "value_chain_position": {"type": "string"},
        "business_model_summary": {"type": "string"},
        "ai_notes": {"type": "string"},
    },
    "required": [
        "product_description",
        "end_market",
        "customer_types",
        "value_chain_position",
        "business_model_summary",
        "ai_notes",
    ],
}

INDUSTRY_SCHEMA = {
    "type": "object",
    "properties": {
        "industry_sector": {"type": "string"},
        "industry_subsector": {"type": "string"},
        "market_regions": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["industry_sector", "industry_subsector", "market_regions"],
}

STRATEGIC_FIT_SCHEMA = {
    "type": "object",
    "properties": {
        "strategic_fit_score": {"type": "integer"},
        "defensibility_score": {"type": "integer"},
        "risk_flags": {"type": "array", "items": {"type": "string"}},
        "upside_potential": {"type": "string"},
        "fit_rationale": {"type": "string"},
        "acquisition_angle": {"type": "string"},
    },
    "required": [
        "strategic_fit_score",
        "defensibility_score",
        "risk_flags",
        "upside_potential",
        "fit_rationale",
    ],
}

PLAYBOOK_SCHEMA = {
    "type": "object",
    "properties": {
        "strategic_playbook": {"type": "string"},
        "next_steps": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["strategic_playbook", "next_steps"],
}

BUSINESS_SUMMARY_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
    },
    "required": ["summary"],
}

INDUSTRY_KEYWORDS_SCHEMA = {
    "type": "object",
    "properties": {
        "keywords": {
            "type": "array",
            "items": {"type": "string"},
            "maxItems": 6,
        }
    },
    "required": ["keywords"],
}

DEFAULT_USER_TEMPLATES = {
    "content_summarization": (
        "Company: {company_name} ({website})\n"
        "Scraped Content:\n{scraped_pages_excerpt}\n\n"
        "Financial Snapshot:\n{financial_overview}\n\n"
        "Task: Summarize the company's product offering, end markets, customer types, "
        "value chain position, and business model. Capture factual highlights only."
    ),
    "industry_classification": (
        "Company: {company_name}\n"
        "Summary JSON:\n{summary_json}\n"
        "Scraped Content:\n{scraped_pages_excerpt}\n\n"
        "Task: Classify sector/subsector and list key geographic markets served."
    ),
    "strategic_fit": (
        "Company: {company_name}\n"
        "Summary JSON:\n{summary_json}\n"
        "Industry JSON:\n{industry_json}\n"
        "Financial Snapshot:\n{financial_overview}\n"
        "Investment Criteria:\n{investment_criteria_json}\n\n"
        "Task: Score strategic fit (1-10) and defensibility (1-10) vs the thesis. "
        "List key risks and upside angles."
    ),
    "playbook_generation": (
        "Company: {company_name}\n"
        "Summary JSON:\n{summary_json}\n"
        "Industry JSON:\n{industry_json}\n"
        "Strategic Fit JSON:\n{strategic_fit_json}\n"
        "Financial Snapshot:\n{financial_overview}\n\n"
        "Task: Provide a strategic playbook (markdown) and 3-5 next steps for diligence."
    ),
}


@dataclass
class AnalysisStepResult:
    data: Dict[str, Any]
    raw_text: str


class AIAnalyzer:
    def __init__(
        self,
        api_key: Optional[str] = None,
        agent_type: Optional[str] = None,
        model: Optional[str] = None,
        llm_provider=None,
    ) -> None:
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.llm_provider = llm_provider
        self.client: Optional[OpenAI] = None
        if not llm_provider and self.api_key:
            self.client = OpenAI(api_key=self.api_key)

        self.model = model or DEFAULT_MODEL
        self.temperature = float(os.getenv("OPENAI_TEMPERATURE", "0.1"))
        self.default_agent_type = agent_type or DEFAULT_AGENT_TYPE or "default"
        self._prompt_cache: Dict[str, PromptConfig] = {}
        self._strategic_analyzer = StrategicFitAnalyzer()

    def analyze(
        self,
        company_name: str,
        website: Optional[str],
        raw_text: Optional[str],
        scraped_pages: Optional[Dict[str, str]] = None,
        financial_metrics: Optional[Dict[str, Any]] = None,
        investment_criteria: Optional[Dict[str, Any]] = None,
        agent_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        scraped_pages = scraped_pages or {}
        combined_content = self._build_context_blob(scraped_pages, raw_text)
        agent_key = agent_type or self.default_agent_type
        prompt_config = self._get_prompt_config(agent_key)

        if not combined_content or (not self.client and not self.llm_provider):
            if not combined_content:
                logger.warning("No website content provided for %s, returning fallback analysis", company_name)
            if not self.client and not self.llm_provider:
                logger.warning("OpenAI/LLM not configured, returning fallback analysis")
            fallback = self._fallback_result(company_name, website)
            fallback["agent_type"] = agent_key
            fallback["scraped_pages"] = self._normalize_list(list(scraped_pages.keys()))
            fallback["used_llm"] = False
            return fallback

        financial_overview = self._format_financial_metrics(financial_metrics)
        context = {
            "company_name": company_name,
            "website": website or "N/A",
            "scraped_pages_excerpt": self._build_scraped_pages_excerpt(scraped_pages, raw_text),
            "financial_overview": financial_overview,
            "combined_content": combined_content,
            "investment_criteria_json": self._format_json(investment_criteria),
            "agent_metadata": json.dumps(prompt_config.metadata() or {}, ensure_ascii=False),
        }

        summary = self.analyze_content_summary(prompt_config, context)
        summary_json = self._format_json(summary.data)
        context["summary_json"] = summary_json

        industry = self.classify_industry(prompt_config, {**context})
        industry_json = self._format_json(industry.data)
        context["industry_json"] = industry_json

        baseline_fit = self._strategic_analyzer.evaluate(
            company_name=company_name,
            financial_metrics=financial_metrics,
            summary=summary.data,
        )
        context["strategy_baseline_json"] = self._format_json(
            {
                "score": baseline_fit.score,
                "defensibility": baseline_fit.defensibility,
                "risk_flags": baseline_fit.risk_flags,
                "upside": baseline_fit.upside_potential,
                "rationale": baseline_fit.rationale,
                "strategy": baseline_fit.matched_strategy,
            }
        )

        strategic_fit = self.analyze_strategic_fit(
            prompt_config,
            {**context, "investment_criteria_json": self._format_json(investment_criteria)},
        )
        strategic_fit_json = self._format_json(strategic_fit.data)
        context["strategic_fit_json"] = strategic_fit_json

        playbook = self.generate_playbook(prompt_config, context)

        business_summary_text = self.generate_business_summary(
            company_name=company_name,
            combined_content=combined_content,
            financial_overview=financial_overview,
        )
        keywords = self.extract_industry_keywords(
            company_name=company_name,
            combined_content=combined_content,
            summary=summary.data,
            industry=industry.data,
        )

        result = {
            **summary.data,
            **industry.data,
            **strategic_fit.data,
            **playbook.data,
            "agent_type": agent_key,
            "scraped_pages": self._normalize_list(list(scraped_pages.keys())),
            "used_llm": True,
            "business_summary": business_summary_text or summary.data.get("business_model_summary"),
            "industry_keywords": self._normalize_list(keywords),
        }
        result["strategic_fit_score"] = self._normalize_score(
            result.get("strategic_fit_score") or baseline_fit.score
        )
        result["defensibility_score"] = self._normalize_score(
            result.get("defensibility_score") or baseline_fit.defensibility
        )
        risk_flags = result.get("risk_flags") or baseline_fit.risk_flags
        if baseline_fit.rationale and not result.get("fit_rationale"):
            result["fit_rationale"] = baseline_fit.rationale
        if not result.get("upside_potential"):
            result["upside_potential"] = baseline_fit.upside_potential
        result["risk_flags"] = self._normalize_list(risk_flags)
        result["market_regions"] = self._normalize_list(result.get("market_regions"))
        result["next_steps"] = self._normalize_list(result.get("next_steps"))
        if not result.get("acquisition_angle"):
            result["acquisition_angle"] = baseline_fit.acquisition_angle
        return result

    def analyze_content_summary(
        self,
        prompt_config: PromptConfig,
        context: Dict[str, Any],
    ) -> AnalysisStepResult:
        return self._invoke_step(
            step="content_summarization",
            prompt_config=prompt_config,
            context=context,
            schema=CONTENT_SCHEMA,
        )

    def classify_industry(
        self,
        prompt_config: PromptConfig,
        context: Dict[str, Any],
    ) -> AnalysisStepResult:
        return self._invoke_step(
            step="industry_classification",
            prompt_config=prompt_config,
            context=context,
            schema=INDUSTRY_SCHEMA,
        )

    def analyze_strategic_fit(
        self,
        prompt_config: PromptConfig,
        context: Dict[str, Any],
    ) -> AnalysisStepResult:
        return self._invoke_step(
            step="strategic_fit",
            prompt_config=prompt_config,
            context=context,
            schema=STRATEGIC_FIT_SCHEMA,
        )

    def generate_playbook(
        self,
        prompt_config: PromptConfig,
        context: Dict[str, Any],
    ) -> AnalysisStepResult:
        return self._invoke_step(
            step="playbook_generation",
            prompt_config=prompt_config,
            context=context,
            schema=PLAYBOOK_SCHEMA,
        )

    def generate_business_summary(
        self,
        company_name: str,
        combined_content: str,
        financial_overview: str,
    ) -> Optional[str]:
        if (not self.client and not self.llm_provider) or not combined_content:
            return None

        excerpt = combined_content[:INLINE_CONTEXT_LIMIT]
        system_prompt = (
            "You are drafting a concise investment memo summary. "
            "Write 1-2 factual sentences that describe what the company sells, who they serve, "
            "and any differentiators. Keep tone neutral and avoid superlatives."
        )
        user_prompt = (
            f"Company: {company_name}\n"
            f"Financial snapshot:\n{financial_overview}\n\n"
            f"Website excerpt:\n{excerpt}\n"
        )
        try:
            response = self._call_openai(system_prompt, user_prompt, BUSINESS_SUMMARY_SCHEMA)
            summary = (response.get("data") or {}).get("summary")
            return summary.strip() if summary else None
        except Exception as exc:
            logger.debug("Business summary generation failed for %s: %s", company_name, exc)
            return None

    def extract_industry_keywords(
        self,
        company_name: str,
        combined_content: str,
        summary: Dict[str, Any],
        industry: Dict[str, Any],
    ) -> Optional[List[str]]:
        if (not self.client and not self.llm_provider) or not combined_content:
            return None

        excerpt = combined_content[:INLINE_CONTEXT_LIMIT]
        existing_terms = ", ".join(
            filter(
                None,
                [
                    summary.get("product_description"),
                    industry.get("industry_sector"),
                    industry.get("industry_subsector"),
                ],
            )
        )
        system_prompt = (
            "You are tagging a company with concise industry keywords. "
            "Return up to 5 short keywords (1-3 words each) that describe products, technologies, "
            "or industries relevant for sourcing. Avoid duplicates and generic words like 'company'."
        )
        user_prompt = (
            f"Company: {company_name}\n"
            f"Existing descriptors: {existing_terms or 'N/A'}\n"
            f"Website excerpt:\n{excerpt}\n"
        )
        try:
            response = self._call_openai(system_prompt, user_prompt, INDUSTRY_KEYWORDS_SCHEMA)
            keywords = (response.get("data") or {}).get("keywords")
            if not keywords:
                return None
            return [keyword.strip() for keyword in keywords if keyword and keyword.strip()]
        except Exception as exc:
            logger.debug("Industry keyword extraction failed for %s: %s", company_name, exc)
            return None

    def _invoke_step(
        self,
        step: str,
        prompt_config: PromptConfig,
        context: Dict[str, Any],
        schema: Dict[str, Any],
    ) -> AnalysisStepResult:
        system_prompt = prompt_config.get_system_prompt(step)
        user_prompt = self._build_user_prompt(prompt_config, step, **context)
        response = self._call_openai(system_prompt, user_prompt, schema)
        return AnalysisStepResult(data=response["data"], raw_text=response["raw"])

    def _call_openai(
        self,
        system_prompt: str,
        user_prompt: str,
        schema: Dict[str, Any],
    ) -> Dict[str, Any]:
        if self.llm_provider:
            return self.llm_provider.generate_json(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                schema_hint=schema,
                model=self.model,
                temperature=self.temperature,
            )
        if not self.client:
            raise RuntimeError("OpenAI client not configured")

        formatted_schema = {
            "name": "ai_analyzer_step",
            "schema": schema,
        }
        response = self.client.chat.completions.create(
            model=self.model,
            temperature=self.temperature,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_schema", "json_schema": formatted_schema},
        )

        choice = response.choices[0]
        content: Any = choice.message.content if choice.message else ""
        if isinstance(content, list):
            content = "".join(part.get("text", "") for part in content if isinstance(part, dict))

        try:
            parsed = json.loads(content or "{}")
        except json.JSONDecodeError:
            parsed = {}

        return {"data": parsed, "raw": content or ""}

    def _get_prompt_config(self, agent_type: str) -> PromptConfig:
        if agent_type not in self._prompt_cache:
            try:
                self._prompt_cache[agent_type] = PromptConfig(agent_type=agent_type)
            except PromptConfigError as exc:
                logger.warning("Failed to load PromptConfig (%s), falling back to default: %s", agent_type, exc)
                self._prompt_cache[agent_type] = PromptConfig(agent_type="default")
        return self._prompt_cache[agent_type]

    @staticmethod
    def _build_context_blob(scraped_pages: Dict[str, str], raw_text: Optional[str]) -> str:
        sections: List[str] = []
        for url, text in (scraped_pages or {}).items():
            snippet = text.strip()
            if snippet:
                sections.append(f"[{url}]\n{snippet}")
        if not sections and raw_text:
            sections.append(raw_text.strip())
        combined = "\n\n".join(sections)
        return combined[:MAX_CONTEXT_CHARS]

    @staticmethod
    def _build_scraped_pages_excerpt(
        scraped_pages: Dict[str, str],
        raw_text: Optional[str],
        limit_per_page: int = MAX_EXCERPT_CHARS,
        max_pages: int = 5,
    ) -> str:
        excerpts: List[str] = []
        for idx, (url, text) in enumerate((scraped_pages or {}).items()):
            if idx >= max_pages:
                break
            snippet = (text or "").strip()
            if snippet:
                excerpts.append(f"URL: {url}\n{snippet[:limit_per_page]}")
        if excerpts:
            return "\n\n".join(excerpts)
        if raw_text:
            return raw_text[: limit_per_page * max_pages]
        return "Ingen webbplatsdata tillgänglig."

    @staticmethod
    def _format_financial_metrics(metrics: Optional[Dict[str, Any]]) -> str:
        if not metrics:
            return "Inga finansiella nyckeltal tillgängliga."

        parts: List[str] = []
        for key, value in metrics.items():
            if isinstance(value, (int, float)):
                parts.append(f"{key}: {value:,.0f}")
            elif isinstance(value, dict):
                parts.append(f"{key}: {json.dumps(value, ensure_ascii=False)}")
            else:
                parts.append(f"{key}: {value}")
        return "\n".join(parts)

    @staticmethod
    def _build_user_prompt(
        prompt_config: PromptConfig,
        step: str,
        **context: Any,
    ) -> str:
        try:
            return prompt_config.build_user_prompt(step, **context)
        except PromptConfigError as exc:
            logger.warning("Missing prompt template for %s: %s. Falling back to default template.", step, exc)
            template = DEFAULT_USER_TEMPLATES.get(step, DEFAULT_USER_TEMPLATES["content_summarization"])
            return template.format(**context)

    @staticmethod
    def _format_json(data: Optional[Dict[str, Any]]) -> str:
        if not data:
            return "{}"
        return json.dumps(data, ensure_ascii=False, indent=2)

    @staticmethod
    def _normalize_list(value: Any) -> Optional[List[Any]]:
        if not value:
            return None
        if isinstance(value, list):
            return value
        return [value]

    @staticmethod
    def _fallback_result(company_name: str, website: Optional[str]) -> Dict[str, Any]:
        return {
            "product_description": f"Summary unavailable for {company_name}",
            "end_market": "",
            "customer_types": "",
            "value_chain_position": "",
            "business_model_summary": "",
            "industry_sector": "",
            "industry_subsector": "",
            "market_regions": None,
            "strategic_fit_score": 5,
            "defensibility_score": 5,
            "risk_flags": None,
            "upside_potential": "",
            "strategic_playbook": "",
            "next_steps": None,
            "ai_notes": f"Website: {website or 'N/A'}",
        }

    @staticmethod
    def _normalize_score(value: Any) -> int:
        try:
            number = int(value)
        except (TypeError, ValueError):
            return 5
        return max(1, min(10, number))


__all__ = ["AIAnalyzer", "AnalysisStepResult"]
