"""
Stage 3: AI Analysis

Generates investment memos using OpenAI based on financial and research data.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from typing import List, Optional

from openai import OpenAI

from .stage2_research import ResearchData

logger = logging.getLogger(__name__)


@dataclass
class AnalysisResult:
    """AI analysis result for a company"""
    orgnr: str
    business_model: Optional[str] = None
    products_summary: Optional[str] = None
    market_position: Optional[str] = None
    swot_strengths: List[str] = field(default_factory=list)
    swot_weaknesses: List[str] = field(default_factory=list)
    swot_opportunities: List[str] = field(default_factory=list)
    swot_threats: List[str] = field(default_factory=list)
    strategic_fit_score: int = 5
    recommendation: str = "watch"  # buy, pass, watch
    investment_memo: str = ""
    raw_analysis: dict = field(default_factory=dict)


SYSTEM_PROMPT = """You are an M&A analyst evaluating companies for acquisition.

Analyze the provided company data and generate a structured investment analysis.

Your analysis should include:
1. Business Model - How the company makes money
2. Products/Services - What they offer and to whom
3. Market Position - Their competitive standing
4. SWOT Analysis - Strengths, Weaknesses, Opportunities, Threats
5. Strategic Fit Score - Rate 1-10 how good an acquisition target this is
6. Recommendation - buy, pass, or watch

Be concise but insightful. Focus on acquisition potential."""


class AIAnalyzer:
    """Analyzes companies using OpenAI"""
    
    def __init__(self):
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY not set")
        
        self.client = OpenAI(api_key=api_key)
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    
    async def analyze_company(
        self,
        orgnr: str,
        company_name: str,
        financial_data: dict,
        research_data: Optional[ResearchData] = None
    ) -> AnalysisResult:
        """
        Analyze a company and generate investment memo
        
        Args:
            orgnr: Organization number
            company_name: Company name
            financial_data: Financial metrics
            research_data: Web research results
            
        Returns:
            AnalysisResult with analysis
        """
        logger.info(f"Analyzing company: {company_name} ({orgnr})")
        
        # Build prompt
        prompt = self._build_prompt(company_name, financial_data, research_data)
        
        try:
            # Call OpenAI
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.7,
            )
            
            # Parse response
            content = response.choices[0].message.content
            if not content:
                raise ValueError("Empty response from OpenAI")
            
            analysis_json = json.loads(content)
            
            # Build result
            result = AnalysisResult(
                orgnr=orgnr,
                business_model=analysis_json.get("business_model"),
                products_summary=analysis_json.get("products_summary"),
                market_position=analysis_json.get("market_position"),
                swot_strengths=analysis_json.get("swot", {}).get("strengths", []),
                swot_weaknesses=analysis_json.get("swot", {}).get("weaknesses", []),
                swot_opportunities=analysis_json.get("swot", {}).get("opportunities", []),
                swot_threats=analysis_json.get("swot", {}).get("threats", []),
                strategic_fit_score=analysis_json.get("strategic_fit_score", 5),
                recommendation=analysis_json.get("recommendation", "watch"),
                investment_memo=self._generate_memo(company_name, analysis_json),
                raw_analysis=analysis_json
            )
            
            logger.info(
                f"Analysis complete for {company_name}: "
                f"score={result.strategic_fit_score}, rec={result.recommendation}"
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to analyze {company_name}: {e}")
            raise
    
    def _build_prompt(
        self,
        company_name: str,
        financial_data: dict,
        research_data: Optional[ResearchData]
    ) -> str:
        """Build analysis prompt"""
        
        prompt_parts = [f"Company: {company_name}\n"]
        
        # Financial data
        prompt_parts.append("FINANCIAL DATA:")
        prompt_parts.append(f"- Revenue: {financial_data.get('revenue', 'N/A')} SEK")
        prompt_parts.append(f"- EBITDA Margin: {financial_data.get('ebitda_margin', 'N/A')}")
        prompt_parts.append(f"- 3Y Growth (CAGR): {financial_data.get('growth', 'N/A')}")
        prompt_parts.append(f"- Employees: {financial_data.get('employees', 'N/A')}\n")
        
        # Research data
        if research_data:
            prompt_parts.append("BUSINESS INTELLIGENCE:")
            
            if research_data.website_content:
                prompt_parts.append(f"Website: {research_data.website_content[:500]}...")
            
            if research_data.about_text:
                prompt_parts.append(f"About: {research_data.about_text[:300]}...")
            
            if research_data.products_text:
                prompt_parts.append(f"Products: {research_data.products_text[:300]}...")
            
            if research_data.search_results:
                prompt_parts.append("Search Results:")
                for query, results in list(research_data.search_results.items())[:2]:
                    for result in results[:2]:
                        snippet = result.get("snippet", "")
                        if snippet:
                            prompt_parts.append(f"  - {snippet}")
            
            prompt_parts.append(f"Digital Score: {research_data.digital_score}/100\n")
        
        prompt_parts.append("""
TASK:
Analyze this company and return a JSON object with:
{
  "business_model": "How they make money (2-3 sentences)",
  "products_summary": "What they offer (2-3 sentences)",
  "market_position": "Their competitive standing (2-3 sentences)",
  "swot": {
    "strengths": ["strength 1", "strength 2", "strength 3"],
    "weaknesses": ["weakness 1", "weakness 2"],
    "opportunities": ["opportunity 1", "opportunity 2"],
    "threats": ["threat 1", "threat 2"]
  },
  "strategic_fit_score": 7,
  "recommendation": "buy",
  "key_insights": ["insight 1", "insight 2", "insight 3"]
}

Recommendation must be one of: "buy", "pass", "watch"
Strategic fit score must be 1-10 (10 = perfect acquisition target)
""")
        
        return "\n".join(prompt_parts)
    
    def _generate_memo(self, company_name: str, analysis: dict) -> str:
        """Generate markdown investment memo"""
        
        memo_parts = [
            f"# Investment Memo: {company_name}\n",
            f"**Recommendation:** {analysis.get('recommendation', 'watch').upper()}",
            f"**Strategic Fit Score:** {analysis.get('strategic_fit_score', 5)}/10\n",
            "## Business Model",
            analysis.get('business_model', 'N/A'),
            "\n## Products & Services",
            analysis.get('products_summary', 'N/A'),
            "\n## Market Position",
            analysis.get('market_position', 'N/A'),
            "\n## SWOT Analysis\n",
        ]
        
        swot = analysis.get('swot', {})
        
        if swot.get('strengths'):
            memo_parts.append("### Strengths")
            for strength in swot['strengths']:
                memo_parts.append(f"- {strength}")
            memo_parts.append("")
        
        if swot.get('weaknesses'):
            memo_parts.append("### Weaknesses")
            for weakness in swot['weaknesses']:
                memo_parts.append(f"- {weakness}")
            memo_parts.append("")
        
        if swot.get('opportunities'):
            memo_parts.append("### Opportunities")
            for opp in swot['opportunities']:
                memo_parts.append(f"- {opp}")
            memo_parts.append("")
        
        if swot.get('threats'):
            memo_parts.append("### Threats")
            for threat in swot['threats']:
                memo_parts.append(f"- {threat}")
            memo_parts.append("")
        
        if analysis.get('key_insights'):
            memo_parts.append("## Key Insights")
            for insight in analysis['key_insights']:
                memo_parts.append(f"- {insight}")
        
        return "\n".join(memo_parts)
