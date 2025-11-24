"""
Stage 1: Financial Filtering

Filters companies based on hard financial metrics to create initial shortlist.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from typing import List, Optional

from openai import OpenAI

from ..services.db_factory import get_database_service

logger = logging.getLogger(__name__)


@dataclass
class FilterCriteria:
    """Financial filtering criteria"""
    min_revenue: float = 0
    min_ebitda_margin: float = -1.0
    min_growth: float = -1.0
    industries: Optional[List[str]] = None
    max_results: int = 500
    custom_sql_conditions: List[str] = field(default_factory=list)
    description: str = ""  # The user's natural language request
    suggestions: List[str] = field(default_factory=list) # AI generated follow-up questions

class IntentAnalyzer:
    """Analyzes user intent to create filter criteria"""
    
    def __init__(self):
        api_key = os.getenv("OPENAI_API_KEY")
        self.client = OpenAI(api_key=api_key)
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    def parse_prompt(self, prompt: str, current_criteria: Optional[FilterCriteria] = None) -> FilterCriteria:
        """
        Convert natural language prompt to FilterCriteria
        """
        logger.info(f"Parsing prompt: {prompt}")
        
        system_prompt = """You are an expert data analyst translating M&A theses into SQL filters.
        
        Database Schema:
        - companies (c): orgnr, company_name, description, city, country
        - company_metrics (m): latest_revenue_sek, avg_ebitda_margin (0.15=15%), revenue_cagr_3y (0.10=10%), employees_latest
        
        Task:
        1. Update the filter criteria based on the user's latest message.
        2. Generate 2-3 relevant follow-up questions (suggestions) to help the user refine their search.
        
        If the user says "refine" or "add", keep existing criteria and add new ones.
        If the user says "start over" or changes topic completely, reset.
        
        Return JSON:
        {
            "min_revenue": 10000000,
            "min_ebitda_margin": 0.05,
            "min_growth": 0.10,
            "industries": ["46", "47"], // NACE codes if mentioned
            "custom_sql_conditions": ["c.city = 'Stockholm'", "c.company_name LIKE '%Tech%'"],
            "explanation": "I've filtered for Tech companies in Stockholm with >10M revenue.",
            "suggestions": [
                "Would you like to focus on companies with >20 employees?",
                "Should we filter for high growth (>20% YoY)?",
                "Do you want to limit the search to the Stockholm region?"
            ]
        }
        
        Rules:
        - Revenue is in SEK. "100m" usually means 100 million SEK.
        - Margins/Growth are decimals (0.1 = 10%).
        - Use custom_sql_conditions for things like location, name matching, or specific exclusions.
        - Be smart about "profitable" (margin > 0) or "high growth" (growth > 0.2).
        """
        
        # Build context from current criteria if exists
        context = ""
        if current_criteria:
            context = f"Current Criteria: Revenue>{current_criteria.min_revenue}, Margin>{current_criteria.min_ebitda_margin}, Growth>{current_criteria.min_growth}"

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"{context}\nUser Request: {prompt}"}
                ],
                response_format={"type": "json_object"},
                temperature=0.0
            )
            
            data = json.loads(response.choices[0].message.content)
            
            return FilterCriteria(
                min_revenue=data.get("min_revenue", 0),
                min_ebitda_margin=data.get("min_ebitda_margin", -1.0),
                min_growth=data.get("min_growth", -1.0),
                industries=data.get("industries"),
                max_results=data.get("limit", 500),
                custom_sql_conditions=data.get("custom_sql_conditions", []),
                description=data.get("explanation", "Updated filters based on request."),
                suggestions=data.get("suggestions", [])
            )
            
        except Exception as e:
            logger.error(f"Failed to parse intent: {e}")
            # Fallback to basic criteria or return current
            return current_criteria or FilterCriteria()

class FinancialFilter:
    """Filters companies based on financial metrics"""
    
    def __init__(self):
        self.db = get_database_service()
    
    def _build_where_clause(self, criteria: FilterCriteria) -> str:
        """Build SQL WHERE clause from criteria"""
        where_parts = ["1=1"]
        
        if criteria.min_revenue > 0:
            where_parts.append(f"m.latest_revenue_sek >= {criteria.min_revenue}")
            
        if criteria.min_ebitda_margin > -1.0:
            where_parts.append(f"m.avg_ebitda_margin >= {criteria.min_ebitda_margin}")
            
        if criteria.min_growth > -1.0:
            where_parts.append(f"m.revenue_cagr_3y >= {criteria.min_growth}")
        
        if criteria.industries:
            # Check if using SQLite (LocalDBService)
            is_sqlite = self.db.__class__.__name__ == 'LocalDBService'
            
            if is_sqlite:
                # SQLite doesn't support array operators, use LIKE as a fallback for JSON strings
                or_conditions = []
                for code in criteria.industries:
                    or_conditions.append(f"c.nace_codes LIKE '%\"{code}\"%'")
                if or_conditions:
                    where_parts.append(f"({' OR '.join(or_conditions)})")
            else:
                # Postgres array containment
                nace_array = "{" + ",".join(f'"{code}"' for code in criteria.industries) + "}"
                where_parts.append(f"c.nace_codes ?| ARRAY{nace_array}::text[]")
            
        # Add custom SQL conditions from LLM
        if criteria.custom_sql_conditions:
            for condition in criteria.custom_sql_conditions:
                # Basic sanitization
                if ";" not in condition and "--" not in condition:
                    where_parts.append(condition)
        
        return " AND ".join(where_parts)

    def filter(self, criteria: FilterCriteria) -> List[str]:
        """Filter companies and return list of orgnr"""
        where_clause = self._build_where_clause(criteria)
        
        sql = f"""
        SELECT c.orgnr
        FROM companies c
        JOIN company_metrics m ON m.orgnr = c.orgnr
        WHERE {where_clause}
        ORDER BY m.revenue_cagr_3y DESC, m.latest_revenue_sek DESC
        LIMIT {criteria.max_results}
        """
        
        logger.debug(f"Executing SQL: {sql}")
        
        try:
            rows = self.db.run_raw_query(sql)
            return [row["orgnr"] for row in rows]
        except Exception as e:
            logger.error(f"Failed to execute filter query: {e}")
            raise
    
    def get_filter_stats(self, criteria: FilterCriteria) -> dict:
        """
        Get statistics about the filter results without running the full query
        
        Returns:
            Dictionary with count and sample companies
        """
        where_clause = self._build_where_clause(criteria)
        
        count_sql = f"""
        SELECT COUNT(*) as total
        FROM companies c
        JOIN company_metrics m ON m.orgnr = c.orgnr
        WHERE {where_clause}
        """
        
        try:
            result = self.db.run_raw_query(count_sql)
            total = result[0]["total"] if result else 0
            
            return {
                "total_matches": total,
                "will_return": min(total, criteria.max_results),
                "criteria": {
                    "min_revenue": criteria.min_revenue,
                    "min_ebitda_margin": criteria.min_ebitda_margin,
                    "min_growth": criteria.min_growth,
                    "industries": criteria.industries,
                }
            }
        except Exception as e:
            logger.error(f"Failed to get filter stats: {e}")
            raise
