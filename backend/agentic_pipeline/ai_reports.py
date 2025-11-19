"""
AI Report Generation for Company Intelligence
Generates business model summaries, weakness detection, uplift assessment, and outreach angles.
"""
from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from typing import Any, Dict, Optional

from openai import OpenAI

logger = logging.getLogger(__name__)


@dataclass
class AIReport:
    """Structured AI report for a company."""
    orgnr: str
    company_id: Optional[str]
    business_model: str
    weaknesses: list[str]
    uplift_ops: list[Dict[str, Any]]  # [{name, impact, effort, category}]
    impact_range: str  # 'Low', 'Medium', 'High'
    outreach_angle: str


class AIReportGenerator:
    """Generates comprehensive AI reports for companies."""
    
    def __init__(self, openai_client: Optional[OpenAI] = None):
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key and openai_client is None:
            raise ValueError("OPENAI_API_KEY environment variable is required")
        self.client = openai_client or OpenAI(api_key=api_key)
        self.model = "gpt-4o-mini"
    
    def generate_report(
        self,
        orgnr: str,
        company_data: Dict[str, Any],
        intel_data: Optional[Dict[str, Any]] = None
    ) -> AIReport:
        """
        Generate comprehensive AI report for a company.
        
        Args:
            orgnr: Organization number
            company_data: Company financial and basic data
            intel_data: Optional intelligence data (tech stack, digital signals, etc.)
        """
        # Build context from company data and intel
        context = self._build_context(company_data, intel_data)
        
        # Generate all report sections
        business_model = self._generate_business_model(context)
        weaknesses = self._generate_weaknesses(context)
        uplift_assessment = self._generate_uplift_assessment(context)
        outreach_angle = self._generate_outreach_angle(context, business_model, weaknesses)
        
        return AIReport(
            orgnr=orgnr,
            company_id=company_data.get("company_id"),
            business_model=business_model,
            weaknesses=weaknesses,
            uplift_ops=uplift_assessment["levers"],
            impact_range=uplift_assessment["impact_range"],
            outreach_angle=outreach_angle,
        )
    
    def _build_context(self, company_data: Dict[str, Any], intel_data: Optional[Dict[str, Any]]) -> str:
        """Build context string from company and intel data."""
        context_parts = []
        
        # Company basics
        context_parts.append(f"Company: {company_data.get('company_name', 'Unknown')}")
        context_parts.append(f"Organization Number: {company_data.get('orgnr', 'N/A')}")
        
        if company_data.get('segment_name'):
            context_parts.append(f"Industry/Segment: {company_data['segment_name']}")
        
        # Financial data
        context_parts.append("\n### Financial Performance")
        if company_data.get('revenue'):
            context_parts.append(f"Revenue: {company_data['revenue']:,.0f} SEK")
        if company_data.get('revenue_growth'):
            context_parts.append(f"Revenue Growth (3Y CAGR): {company_data['revenue_growth']*100:.1f}%")
        if company_data.get('ebit_margin'):
            context_parts.append(f"EBIT Margin: {company_data['ebit_margin']*100:.1f}%")
        if company_data.get('net_margin'):
            context_parts.append(f"Net Margin: {company_data['net_margin']*100:.1f}%")
        if company_data.get('employees'):
            context_parts.append(f"Employees: {company_data['employees']:,.0f}")
        
        # Intelligence data
        if intel_data:
            context_parts.append("\n### Intelligence Data")
            if intel_data.get('tech_stack'):
                tech_stack = intel_data['tech_stack']
                if isinstance(tech_stack, list):
                    context_parts.append(f"Tech Stack: {', '.join(tech_stack[:10])}")
                elif isinstance(tech_stack, dict):
                    context_parts.append(f"Tech Stack: {', '.join(list(tech_stack.keys())[:10])}")
            
            if intel_data.get('digital_maturity_score'):
                context_parts.append(f"Digital Maturity Score: {intel_data['digital_maturity_score']}/100")
            
            if intel_data.get('industry'):
                context_parts.append(f"Industry Classification: {intel_data['industry']}")
        
        return "\n".join(context_parts)
    
    def _generate_business_model(self, context: str) -> str:
        """Generate business model summary."""
        prompt = f"""Based on this company's financial data and intelligence:

{context}

Write a 2-3 paragraph summary of their business model, including:
- What they do (products/services)
- Target customers (B2B, B2C, market segment)
- Value proposition
- Business model (recurring revenue, project-based, etc.)

Be specific and reference the financial data where relevant. Write in professional English."""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are a business analyst specializing in Nordic SMEs. Provide clear, concise business model summaries."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=400,
        )
        
        return response.choices[0].message.content.strip()
    
    def _generate_weaknesses(self, context: str) -> list[str]:
        """Generate list of operational weaknesses."""
        prompt = f"""Analyze this company's operational weaknesses:

{context}

Identify 3-5 key weaknesses or areas of concern, such as:
- Low digital presence
- Declining margins
- High debt levels
- Limited growth
- Operational inefficiencies
- Market position issues

Return as a JSON array of strings, each weakness in 1-2 sentences.

Example format:
["Weakness 1 description", "Weakness 2 description", ...]"""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are an operational analyst identifying improvement opportunities."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.4,
            max_tokens=300,
        )
        
        try:
            result = json.loads(response.choices[0].message.content)
            # Handle different response formats
            if isinstance(result, dict):
                weaknesses = result.get("weaknesses", result.get("items", []))
            elif isinstance(result, list):
                weaknesses = result
            else:
                weaknesses = []
            
            return weaknesses if isinstance(weaknesses, list) else []
        except (json.JSONDecodeError, KeyError) as e:
            logger.warning(f"Failed to parse weaknesses JSON: {e}")
            return []
    
    def _generate_uplift_assessment(self, context: str) -> Dict[str, Any]:
        """Generate operational uplift assessment."""
        prompt = f"""Analyze this company's operational improvement potential:

{context}

Identify 3-5 key uplift levers with:
- Lever name (e.g., "Implement CRM system", "Optimize pricing strategy")
- Impact estimate (e.g., "+15% conversion rate", "+8% margin improvement")
- Effort level: "Low", "Medium", or "High"
- Category: "Sales", "Pricing", "Operations", "Digital", "Customer Experience"

Also provide overall impact range: "Low" (5-10% margin improvement), "Medium" (10-20%), or "High" (20%+)

Return JSON format:
{{
  "levers": [
    {{
      "name": "Lever name",
      "impact": "Impact description",
      "effort": "Low|Medium|High",
      "category": "Category"
    }}
  ],
  "impact_range": "Low|Medium|High"
}}"""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are an operational improvement consultant specializing in SME value creation."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.4,
            max_tokens=500,
        )
        
        try:
            result = json.loads(response.choices[0].message.content)
            return {
                "levers": result.get("levers", []),
                "impact_range": result.get("impact_range", "Medium"),
            }
        except (json.JSONDecodeError, KeyError) as e:
            logger.warning(f"Failed to parse uplift assessment JSON: {e}")
            return {
                "levers": [],
                "impact_range": "Medium",
            }
    
    def _generate_outreach_angle(
        self,
        context: str,
        business_model: str,
        weaknesses: list[str]
    ) -> str:
        """Generate founder outreach angle."""
        prompt = f"""Based on this company analysis:

{context}

Business Model Summary:
{business_model}

Key Weaknesses:
{chr(10).join(f"- {w}" for w in weaknesses)}

Create a personalized outreach angle for the founder/owner. This should:
- Acknowledge their business strengths
- Reference specific improvement opportunities
- Position Nivo as a value-creation partner (not just a buyer)
- Be respectful and professional
- Be 2-3 sentences maximum

Write in Swedish (since this is a Swedish company)."""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are a corporate development professional crafting personalized outreach messages to company founders."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5,
            max_tokens=200,
        )
        
        return response.choices[0].message.content.strip()

