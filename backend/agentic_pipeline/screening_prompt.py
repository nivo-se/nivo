"""
Screening Analysis Prompts for Two-Stage AI Analysis

This module provides optimized prompts for rapid company screening analysis.
Screening mode focuses on quick assessment with minimal token usage.
"""

SCREENING_SYSTEM_PROMPT = """You are a rapid M&A screening analyst for a Swedish private equity firm.

Your task is to quickly assess companies based on their financial data and provide:
1. **Screening Score (1-100)**: Overall investment attractiveness
   - 80-100: Strong candidate - excellent financials and growth
   - 60-79: Good candidate - solid fundamentals, worth deeper look
   - 40-59: Moderate candidate - some concerns but potential
   - 0-39: Weak candidate - significant issues or red flags

2. **Risk Flag**: (Low/Medium/High)
   - Low: Stable financials, consistent performance
   - Medium: Some concerns (volatility, debt, declining margins)
   - High: Major red flags (losses, high debt, negative trends)

3. **Brief Summary**: 2-3 sentences maximum
   - Key financial strengths or weaknesses
   - Notable trends (growth, decline, stability)
   - Primary concern or opportunity

**Focus areas:**
- Revenue trends (growth, stability, seasonality)
- Profitability (margins, consistency)
- Financial health (debt levels, liquidity)
- Growth trajectory (last 2-4 years)

**Data considerations:**
- Flag if critical financial data is missing
- Use most recent 4 years when available
- Be concise - this is rapid screening, not full due diligence

Respond in Swedish where appropriate for company context."""


def get_screening_prompt(company_name: str, orgnr: str, financial_data: dict) -> str:
    """
    Build screening analysis prompt for a single company.
    
    Args:
        company_name: Company name
        orgnr: Organization number
        financial_data: Dictionary with financial metrics
        
    Returns:
        Formatted prompt string
    """
    return f"""Analysera följande företag för snabb screening:

**Företag:** {company_name} (Org.nr: {orgnr})

**Finansiell data:**
{_format_financial_data(financial_data)}

Ge en snabb bedömning enligt screeningkriterier (score, risk, sammanfattning)."""


def get_batch_screening_prompt(companies: list[dict]) -> str:
    """
    Build screening prompt for multiple companies (batch processing).
    
    Args:
        companies: List of company dicts with name, orgnr, and financial_data
        
    Returns:
        Formatted prompt for batch analysis
    """
    company_sections = []
    for idx, company in enumerate(companies, 1):
        section = f"""
### Företag {idx}: {company['name']} (Org.nr: {company['orgnr']})
{_format_financial_data(company.get('financial_data', {}))}
"""
        company_sections.append(section)
    
    return f"""Analysera följande {len(companies)} företag för snabb screening.

För varje företag, ge:
- Screening Score (1-100)
- Risk Flag (Low/Medium/High)
- Brief Summary (2-3 meningar)

{''.join(company_sections)}

Svara i JSON-format med en array av resultat, ett för varje företag i samma ordning."""


def _format_financial_data(data: dict) -> str:
    """
    Format financial data dictionary into readable text.
    
    Args:
        data: Dictionary with financial metrics (revenue, profit, etc.)
        
    Returns:
        Formatted string
    """
    if not data:
        return "Ingen finansiell data tillgänglig."
    
    lines = []
    
    # Revenue
    if 'revenue' in data:
        lines.append(f"Omsättning: {_format_series(data['revenue'])}")
    
    # Profit
    if 'profit' in data:
        lines.append(f"Resultat: {_format_series(data['profit'])}")
    
    # Margins
    if 'margin' in data:
        lines.append(f"Marginal: {_format_series(data['margin'])}")
    
    # Equity
    if 'equity' in data:
        lines.append(f"Eget kapital: {_format_series(data['equity'])}")
    
    # Debt
    if 'debt' in data:
        lines.append(f"Skulder: {_format_series(data['debt'])}")
    
    # Growth rates
    if 'revenue_growth' in data:
        lines.append(f"Omsättningstillväxt: {data['revenue_growth']}")
    
    return '\n'.join(lines) if lines else "Begränsad finansiell data."


def _format_series(values: dict | list) -> str:
    """
    Format time series data (e.g., {2020: 1000, 2021: 1200}).
    
    Args:
        values: Dictionary or list of values over time
        
    Returns:
        Formatted string like "2020: 1000, 2021: 1200"
    """
    if isinstance(values, dict):
        return ', '.join([f"{year}: {val:,.0f}" for year, val in sorted(values.items())])
    elif isinstance(values, list):
        return ', '.join([f"{val:,.0f}" for val in values])
    else:
        return str(values)


__all__ = [
    'SCREENING_SYSTEM_PROMPT',
    'get_screening_prompt',
    'get_batch_screening_prompt'
]
