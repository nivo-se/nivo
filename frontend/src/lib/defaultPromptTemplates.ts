/**
 * Built-in prompt templates from Figma export (nivo-figma-app).
 * Used when backend has no AI templates yet.
 */
import type { PromptTemplate } from "@/types/figma";

export const DEFAULT_PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: "acq-fit-standard",
    name: "Acquisition Fit - Standard",
    description:
      "General acquisition fit assessment for profitable, growing companies",
    prompt: `Analyze {{company_name}}, a {{industry_label}} company in {{region}}, Sweden, for acquisition potential.

**Financial Profile:**
- Latest Revenue: {{revenue_latest}} SEK ({{revenue_cagr}}% 3Y CAGR)
- EBITDA Margin: {{ebitda_margin}}%
- Employees: {{employees_latest}}

**Analysis Instructions:**
Evaluate this company as a potential acquisition target for a private equity firm focused on profitable, growing Swedish SMEs. Score the company on:

1. **Market Position (0-100):** Assess competitive strength, market share potential, and industry attractiveness
2. **Growth Potential (0-100):** Evaluate historical growth, market tailwinds, and scalability
3. **Financial Health (0-100):** Analyze profitability, margins, and financial stability
4. **Operational Fit (0-100):** Consider management quality, scalability, and operational efficiency

Provide:
- Overall recommendation: strong_fit | potential_fit | weak_fit | pass
- 2-3 paragraph summary of key findings
- 3-5 key strengths (bullet points)
- 3-5 concerns or red flags (bullet points)

Be specific and data-driven. Reference the actual numbers provided.`,
    variables: [
      "company_name",
      "industry_label",
      "region",
      "revenue_latest",
      "revenue_cagr",
      "ebitda_margin",
      "employees_latest",
    ],
    scoringDimensions: [
      {
        id: "market_position",
        name: "Market Position",
        description: "Competitive strength and industry attractiveness",
        weight: 0.25,
      },
      {
        id: "growth_potential",
        name: "Growth Potential",
        description: "Historical growth trajectory and future scalability",
        weight: 0.35,
      },
      {
        id: "financial_health",
        name: "Financial Health",
        description: "Profitability, margins, and financial stability",
        weight: 0.3,
      },
      {
        id: "operational_fit",
        name: "Operational Fit",
        description: "Management quality and operational efficiency",
        weight: 0.1,
      },
    ],
    created_at: "2026-01-15T10:00:00Z",
    created_by: "system",
  },
  {
    id: "growth-focus",
    name: "High-Growth Assessment",
    description:
      "Focused on rapid growth companies, tolerates lower margins",
    prompt: `Analyze {{company_name}}, operating in {{industry_label}}, for high-growth acquisition potential.

**Financial Snapshot:**
- Revenue: {{revenue_latest}} SEK ({{revenue_cagr}}% CAGR)
- EBITDA Margin: {{ebitda_margin}}%
- Team Size: {{employees_latest}} employees

**Focus Areas:**
This analysis prioritizes growth trajectory over current profitability. Score on:

1. **Growth Momentum (0-100):** Revenue growth rate, consistency, and acceleration
2. **Market Opportunity (0-100):** TAM size, market trends, competitive dynamics
3. **Scalability (0-100):** Business model leverage, unit economics, expansion potential
4. **Execution Risk (0-100):** Management team, operational complexity, dependencies

Provide clear recommendation on whether this fits a high-growth investment thesis. Be critical of companies with decelerating growth or mature markets.`,
    variables: [
      "company_name",
      "industry_label",
      "revenue_latest",
      "revenue_cagr",
      "ebitda_margin",
      "employees_latest",
    ],
    scoringDimensions: [
      {
        id: "growth_momentum",
        name: "Growth Momentum",
        description: "Revenue growth rate and consistency",
        weight: 0.4,
      },
      {
        id: "market_opportunity",
        name: "Market Opportunity",
        description: "TAM size and market trends",
        weight: 0.3,
      },
      {
        id: "scalability",
        name: "Scalability",
        description: "Business model leverage and expansion potential",
        weight: 0.2,
      },
      {
        id: "execution_risk",
        name: "Execution Risk",
        description: "Management quality and operational complexity",
        weight: 0.1,
      },
    ],
    created_at: "2026-01-20T14:30:00Z",
    created_by: "system",
  },
  {
    id: "value-stability",
    name: "Value & Stability Focus",
    description:
      "Conservative approach prioritizing profitability and predictability",
    prompt: `Assess {{company_name}} ({{industry_label}}, {{region}}) for value-oriented acquisition.

**Financials:**
- Revenue: {{revenue_latest}} SEK ({{revenue_cagr}}% growth)
- EBITDA Margin: {{ebitda_margin}}%
- Headcount: {{employees_latest}}

**Investment Criteria:**
Evaluate for a value-focused strategy emphasizing:

1. **Profitability (0-100):** Current margins, cash generation, financial discipline
2. **Stability (0-100):** Revenue predictability, customer concentration, market maturity
3. **Asset Quality (0-100):** Balance sheet strength, working capital, tangible assets
4. **Downside Protection (0-100):** Recession resilience, competitive moats, switching costs

Prefer established, profitable businesses with steady cash flows over high-growth, high-risk plays. Flag any volatility or execution concerns.`,
    variables: [
      "company_name",
      "industry_label",
      "region",
      "revenue_latest",
      "revenue_cagr",
      "ebitda_margin",
      "employees_latest",
    ],
    scoringDimensions: [
      {
        id: "profitability",
        name: "Profitability",
        description: "Margin quality and cash generation",
        weight: 0.35,
      },
      {
        id: "stability",
        name: "Stability",
        description: "Revenue predictability and business maturity",
        weight: 0.3,
      },
      {
        id: "asset_quality",
        name: "Asset Quality",
        description: "Balance sheet strength and working capital",
        weight: 0.2,
      },
      {
        id: "downside_protection",
        name: "Downside Protection",
        description: "Recession resilience and competitive moats",
        weight: 0.15,
      },
    ],
    created_at: "2026-02-01T09:00:00Z",
    created_by: "system",
  },
];
