import { PromptTemplate, AIRun, AIResult } from '../types/ai';

// Predefined Prompt Templates
export const mockPromptTemplates: PromptTemplate[] = [
  {
    id: 'acq-fit-standard',
    name: 'Acquisition Fit - Standard',
    description: 'General acquisition fit assessment for profitable, growing companies',
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
      'company_name',
      'industry_label',
      'region',
      'revenue_latest',
      'revenue_cagr',
      'ebitda_margin',
      'employees_latest'
    ],
    scoringDimensions: [
      {
        id: 'market_position',
        name: 'Market Position',
        description: 'Competitive strength and industry attractiveness',
        weight: 0.25
      },
      {
        id: 'growth_potential',
        name: 'Growth Potential',
        description: 'Historical growth trajectory and future scalability',
        weight: 0.35
      },
      {
        id: 'financial_health',
        name: 'Financial Health',
        description: 'Profitability, margins, and financial stability',
        weight: 0.30
      },
      {
        id: 'operational_fit',
        name: 'Operational Fit',
        description: 'Management quality and operational efficiency',
        weight: 0.10
      }
    ],
    created_at: '2026-01-15T10:00:00Z',
    created_by: 'system'
  },
  {
    id: 'growth-focus',
    name: 'High-Growth Assessment',
    description: 'Focused on rapid growth companies, tolerates lower margins',
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
      'company_name',
      'industry_label',
      'revenue_latest',
      'revenue_cagr',
      'ebitda_margin',
      'employees_latest'
    ],
    scoringDimensions: [
      {
        id: 'growth_momentum',
        name: 'Growth Momentum',
        description: 'Revenue growth rate and consistency',
        weight: 0.40
      },
      {
        id: 'market_opportunity',
        name: 'Market Opportunity',
        description: 'TAM size and market trends',
        weight: 0.30
      },
      {
        id: 'scalability',
        name: 'Scalability',
        description: 'Business model leverage and expansion potential',
        weight: 0.20
      },
      {
        id: 'execution_risk',
        name: 'Execution Risk',
        description: 'Management quality and operational complexity',
        weight: 0.10
      }
    ],
    created_at: '2026-01-20T14:30:00Z',
    created_by: 'system'
  },
  {
    id: 'value-stability',
    name: 'Value & Stability Focus',
    description: 'Conservative approach prioritizing profitability and predictability',
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
      'company_name',
      'industry_label',
      'region',
      'revenue_latest',
      'revenue_cagr',
      'ebitda_margin',
      'employees_latest'
    ],
    scoringDimensions: [
      {
        id: 'profitability',
        name: 'Profitability',
        description: 'Margin quality and cash generation',
        weight: 0.35
      },
      {
        id: 'stability',
        name: 'Stability',
        description: 'Revenue predictability and business maturity',
        weight: 0.30
      },
      {
        id: 'asset_quality',
        name: 'Asset Quality',
        description: 'Balance sheet strength and working capital',
        weight: 0.20
      },
      {
        id: 'downside_protection',
        name: 'Downside Protection',
        description: 'Recession resilience and competitive moats',
        weight: 0.15
      }
    ],
    created_at: '2026-02-01T09:00:00Z',
    created_by: 'system'
  }
];

// Mock AI Runs
export const mockAIRuns: AIRun[] = [
  {
    id: 'run-001',
    name: 'Q1 2026 - Tech Services Batch',
    list_id: 'list-001',
    template_id: 'acq-fit-standard',
    status: 'completed',
    created_at: '2026-02-10T10:00:00Z',
    created_by: 'Anders Svensson',
    started_at: '2026-02-10T10:01:00Z',
    completed_at: '2026-02-10T10:15:00Z',
    total_companies: 12,
    processed_companies: 12,
    failed_companies: 0,
    estimated_cost: 2.40,
    actual_cost: 2.28,
    config: {
      auto_approve: false,
      overwrite_existing: false
    }
  },
  {
    id: 'run-002',
    name: 'High-Growth Manufacturing',
    list_id: 'list-002',
    template_id: 'growth-focus',
    status: 'running',
    created_at: '2026-02-15T14:30:00Z',
    created_by: 'Maria Lindberg',
    started_at: '2026-02-15T14:31:00Z',
    total_companies: 45,
    processed_companies: 23,
    failed_companies: 1,
    estimated_cost: 9.00,
    actual_cost: 4.60,
    config: {
      auto_approve: false,
      overwrite_existing: true
    }
  }
];

// Mock AI Results - Generate realistic results for companies
export const generateMockAIResult = (
  runId: string,
  companyOrgnr: string,
  templateId: string,
  approved: boolean = false
): AIResult => {
  const template = mockPromptTemplates.find(t => t.id === templateId)!;
  
  // Generate scores based on template type
  let dimensionScores: { [key: string]: number } = {};
  let overallScore = 0;
  
  if (templateId === 'acq-fit-standard') {
    dimensionScores = {
      market_position: 65 + Math.random() * 30,
      growth_potential: 60 + Math.random() * 35,
      financial_health: 70 + Math.random() * 25,
      operational_fit: 55 + Math.random() * 40
    };
  } else if (templateId === 'growth-focus') {
    dimensionScores = {
      growth_momentum: 70 + Math.random() * 25,
      market_opportunity: 65 + Math.random() * 30,
      scalability: 60 + Math.random() * 35,
      execution_risk: 50 + Math.random() * 40
    };
  } else {
    dimensionScores = {
      profitability: 75 + Math.random() * 20,
      stability: 70 + Math.random() * 25,
      asset_quality: 65 + Math.random() * 30,
      downside_protection: 60 + Math.random() * 35
    };
  }
  
  // Calculate weighted overall score
  template.scoringDimensions.forEach(dim => {
    overallScore += dimensionScores[dim.id] * dim.weight;
  });
  
  overallScore = Math.round(overallScore);
  
  // Determine recommendation
  let recommendation: 'strong_fit' | 'potential_fit' | 'weak_fit' | 'pass';
  if (overallScore >= 75) recommendation = 'strong_fit';
  else if (overallScore >= 60) recommendation = 'potential_fit';
  else if (overallScore >= 45) recommendation = 'weak_fit';
  else recommendation = 'pass';
  
  return {
    id: `result-${runId}-${companyOrgnr}`,
    run_id: runId,
    company_orgnr: companyOrgnr,
    status: approved ? 'approved' : 'pending',
    overall_score: overallScore,
    dimension_scores: dimensionScores,
    summary: `This company demonstrates ${recommendation === 'strong_fit' ? 'strong' : recommendation === 'potential_fit' ? 'moderate' : 'limited'} acquisition potential. The analysis reveals a company with ${overallScore >= 70 ? 'solid' : 'developing'} fundamentals and ${dimensionScores[template.scoringDimensions[0].id] >= 70 ? 'strong' : 'moderate'} market positioning.\n\nThe financial performance shows ${dimensionScores.financial_health >= 70 || dimensionScores.profitability >= 70 ? 'healthy margins and stable revenue generation' : 'room for operational improvement'}, while growth trajectory indicates ${dimensionScores.growth_potential >= 70 || dimensionScores.growth_momentum >= 70 ? 'strong momentum with clear expansion opportunities' : 'steady but moderate growth potential'}.\n\nOverall, this target ${recommendation === 'strong_fit' ? 'aligns well with investment criteria and warrants immediate follow-up' : recommendation === 'potential_fit' ? 'presents interesting opportunities but requires deeper due diligence' : 'falls short of key acquisition thresholds'}.`,
    strengths: [
      'Strong historical financial performance with consistent profitability',
      'Established market position in growing industry segment',
      'Experienced management team with domain expertise',
      'Diversified customer base reducing concentration risk',
      'Scalable business model with clear expansion pathways'
    ].slice(0, 3 + Math.floor(Math.random() * 2)),
    concerns: [
      'Limited geographic diversification increases regional risk',
      'Moderate customer concentration in top 3 accounts',
      'Aging technology infrastructure may require investment',
      'Competitive pressure from larger players entering market',
      'Key person dependency on founder leadership'
    ].slice(0, 2 + Math.floor(Math.random() * 3)),
    recommendation,
    prompt_used: template.prompt,
    tokens_used: 2500 + Math.floor(Math.random() * 1500),
    cost: 0.18 + Math.random() * 0.12,
    analyzed_at: new Date(Date.now() - Math.random() * 86400000).toISOString(),
    ...(approved && {
      approved_at: new Date().toISOString(),
      approved_by: 'Anders Svensson'
    })
  };
};

// Generate mock results for completed run
export const mockAIResults: AIResult[] = Array.from({ length: 12 }, (_, i) => 
  generateMockAIResult('run-001', `5560${String(i).padStart(6, '0')}-7890`, 'acq-fit-standard', i < 5)
);
