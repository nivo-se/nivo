// Mock data types
export interface Company {
  // Identity
  orgnr: string; // Primary identifier: organization number
  display_name: string; // User-friendly name
  legal_name: string; // Official registered name
  website_url?: string;
  region?: string; // Region/municipality
  municipality?: string;
  industry_code?: string;
  industry_label: string;
  status: 'active' | 'inactive';
  
  // Financial quality metadata
  fiscal_year_end?: string; // e.g., "12-31"
  currency: string; // e.g., "SEK"
  years_available: number;
  latest_year: number;
  
  // Screening metrics - Latest
  revenue_latest: number; // SEK
  ebitda_latest: number; // SEK
  ebitda_margin_latest: number; // ratio (0.12 = 12%)
  ebit_latest?: number; // SEK
  ebit_margin_latest?: number; // ratio
  revenue_growth_yoy_latest: number; // ratio
  revenue_cagr_3y: number; // ratio
  revenue_cagr_5y?: number; // ratio (if available)
  employees_latest: number;
  
  // Future metrics (placeholders)
  stability_score?: number; // 0-100
  leverage_ratio?: number;
  
  // Coverage & Quality flags
  has_homepage: boolean;
  has_ai_profile: boolean;
  has_3y_financials: boolean;
  data_quality_score: number; // 0-4
  is_stale: boolean;
  last_enriched_at?: string;
  
  // Full financial history (for drill-down)
  financials: {
    year: number;
    revenue: number; // SEK
    ebitda: number; // SEK
    ebit?: number; // SEK
    gross_margin: number; // ratio
    ebitda_margin: number; // ratio
    ebit_margin?: number; // ratio
  }[];
  
  // AI Profile (sparse - only ~0.6% have this)
  ai_profile?: {
    ai_summary_short?: string;
    ai_summary_long?: string;
    ai_tags?: string[];
    ai_value_levers?: string[];
    ai_risks?: string[];
    ai_fit_score?: number; // 0-100
    ai_confidence?: number; // 0-1 ratio
    ai_sources?: string[];
    ai_generated_at?: string;
  };
  
  // Audit trail
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
}

export interface FilterRule {
  id: string;
  field: string;
  operator: string;
  value: any;
  type?: string; // 'number' | 'text' | 'boolean' | 'date'
}

export interface FilterGroup {
  id: string;
  type: 'and' | 'or';
  rules: (FilterRule | FilterGroup)[];
}

export interface Filters {
  include: FilterGroup;
  exclude: FilterGroup;
}

export interface SavedView {
  id: string;
  name: string;
  owner_user_id: string;
  scope: 'private' | 'team';
  filters_json: Filters;
  columns_json: string[]; // ordered column names
  sort_json: { by: string; dir: 'asc' | 'desc' };
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export interface List {
  id: string;
  name: string;
  owner_user_id: string;
  scope: 'private' | 'team';
  source_view_id?: string;
  filters?: Filters; // If created from query
  companyIds: string[];
  stage: 'research' | 'ai_analysis' | 'prospects';
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export interface ListItem {
  list_id: string;
  orgnr: string;
  added_by: string;
  added_at: string;
  notes?: string;
}

export interface CompanyLabel {
  id: string;
  orgnr: string;
  label: string;
  scope: 'private' | 'team';
  created_by: string;
  created_at: string;
}

export interface ProspectStatus {
  companyId: string;
  status: 'new' | 'researching' | 'contacted' | 'in_discussion' | 'meeting_scheduled' | 'interested' | 'not_interested' | 'passed' | 'deal_in_progress';
  owner?: string;
  lastContact?: string;
  notes: { text: string; author: string; date: string }[];
  nextAction?: string;
}

export interface Run {
  id: string;
  type: 'enrichment' | 'analysis' | 'refresh';
  status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled';
  started_at?: string;
  finished_at?: string;
  progress?: number; // 0-100
  total_count?: number;
  processed_count?: number;
  error_count?: number;
  error_log?: string[];
  created_by: string;
}

export interface CoverageSnapshot {
  total_companies: number;
  with_homepage: number;
  with_ai_profile: number;
  with_3y_financials: number;
  high_quality: number; // data_quality_score >= 3
  stale_count: number;
  last_updated: string;
}

// Generate mock companies
export function generateMockCompanies(count: number = 13610): Company[] {
  const companies: Company[] = [];
  
  const companyPrefixes = ['ABC', 'XYZ', 'DEF', 'GHI', 'JKL', 'MNO', 'PQR', 'STU', 'VWX', 'YZA'];
  const companySuffixes = ['Tech', 'Solutions', 'Innovations', 'Systems', 'Enterprises', 'Group', 'Holdings', 'Corporation', 'Limited', 'AB'];
  const industries = ['Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail', 'Construction', 'Transportation', 'Energy', 'Telecommunications', 'Education'];
  const geographies = ['Stockholm', 'Gothenburg', 'Malmö', 'Uppsala', 'Västerås', 'Linköping', 'Örebro', 'Norrköping', 'Jönköping', 'Helsingborg'];
  
  for (let i = 0; i < count; i++) {
    const prefix = companyPrefixes[i % companyPrefixes.length];
    const suffix = companySuffixes[Math.floor(i / companyPrefixes.length) % companySuffixes.length];
    const industry = industries[i % industries.length];
    const geography = geographies[i % geographies.length];
    
    // Base revenue in SEK (Swedish Krona)
    // Typical Swedish SMB: 5M-200M SEK
    const baseRevenueSEK = (5 + Math.random() * 195) * 1_000_000;
    const growthRate = 0.05 + Math.random() * 0.25; // 5-30% growth
    const ebitdaMarginBase = 0.10 + Math.random() * 0.25; // 10-35% margin
    const ebitMarginBase = ebitdaMarginBase - 0.02; // EBIT slightly lower
    
    const financials = [];
    let has3YearData = true;
    let has5YearData = Math.random() < 0.60; // 60% have 5Y data
    
    const startYear = has5YearData ? 2020 : 2022;
    
    for (let year = startYear; year <= 2025; year++) {
      const yearOffset = year - startYear;
      const revenue = baseRevenueSEK * Math.pow(1 + growthRate, yearOffset);
      const grossMargin = 0.35 + Math.random() * 0.30; // 35-65%
      const ebitdaMargin = ebitdaMarginBase + (Math.random() - 0.5) * 0.05;
      const ebitMargin = ebitMarginBase + (Math.random() - 0.5) * 0.05;
      const ebitda = revenue * ebitdaMargin;
      const ebit = revenue * ebitMargin;
      
      // Some companies missing older data
      if (year < 2023 && Math.random() < 0.05) {
        has3YearData = false;
        continue;
      }
      
      financials.push({
        year,
        revenue: parseFloat(revenue.toFixed(2)),
        ebitda: parseFloat(ebitda.toFixed(2)),
        ebit: parseFloat(ebit.toFixed(2)),
        gross_margin: parseFloat(grossMargin.toFixed(4)),
        ebitda_margin: parseFloat(ebitdaMargin.toFixed(4)),
        ebit_margin: parseFloat(ebitMargin.toFixed(4))
      });
    }
    
    // Calculate CAGR
    const cagr3y = financials.length >= 4 ? 
      ((Math.pow(financials[financials.length - 1].revenue / financials[financials.length - 4].revenue, 1 / 3) - 1)) : 0;
    const cagr5y = financials.length >= 6 ?
      ((Math.pow(financials[financials.length - 1].revenue / financials[0].revenue, 1 / 5) - 1)) : undefined;
    
    const latestFinancial = financials[financials.length - 1];
    const previousYearRevenue = financials.length > 1 ? financials[financials.length - 2].revenue : latestFinancial.revenue;
    const yoyGrowth = (latestFinancial.revenue - previousYearRevenue) / previousYearRevenue;
    
    const displayName = `${prefix} ${suffix}`;
    const legalName = `${prefix} ${suffix} AB`;
    const isActive = Math.random() < 0.98; // 98% active
    
    companies.push({
      // Identity
      orgnr: `${556000000 + i}`, // Realistic Swedish org numbers start with 556...
      display_name: displayName,
      legal_name: legalName,
      website_url: Math.random() < 0.85 ? `https://${displayName.toLowerCase().replace(/\s+/g, '')}.se` : undefined,
      region: geography,
      municipality: geography,
      industry_code: `${(i % 10) + 1}`.padStart(2, '0'),
      industry_label: industry,
      status: isActive ? 'active' : 'inactive',
      
      // Financial quality metadata
      fiscal_year_end: '12-31',
      currency: 'SEK',
      years_available: financials.length,
      latest_year: 2025,
      
      // Latest metrics
      revenue_latest: latestFinancial.revenue,
      ebitda_latest: latestFinancial.ebitda,
      ebitda_margin_latest: latestFinancial.ebitda_margin,
      ebit_latest: latestFinancial.ebit,
      ebit_margin_latest: latestFinancial.ebit_margin,
      revenue_growth_yoy_latest: parseFloat(yoyGrowth.toFixed(4)),
      revenue_cagr_3y: parseFloat(cagr3y.toFixed(4)),
      revenue_cagr_5y: cagr5y ? parseFloat(cagr5y.toFixed(4)) : undefined,
      employees_latest: Math.floor(10 + Math.random() * 200),
      
      // Future metrics
      stability_score: Math.random() < 0.3 ? Math.floor(60 + Math.random() * 40) : undefined,
      leverage_ratio: Math.random() < 0.4 ? parseFloat((0.2 + Math.random() * 2.0).toFixed(2)) : undefined,
      
      // Coverage flags (realistic percentages)
      has_homepage: Math.random() < 0.85, // 85% have homepage
      has_ai_profile: Math.random() < 0.006, // ~0.6% have AI profile (78/13610)
      has_3y_financials: has3YearData,
      data_quality_score: Math.floor(Math.random() * 5), // 0-4
      is_stale: Math.random() < 0.15, // 15% are stale
      last_enriched_at: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString(),
      
      financials,
      
      // AI profile - very sparse (only ~0.6% have this)
      ai_profile: Math.random() < 0.006 ? {
        ai_summary_short: `${industry} company in ${geography} with ${financials.length}Y track record`,
        ai_summary_long: `A ${industry.toLowerCase()} company serving the ${geography} market with ${financials.length} years of financial history. Shows ${yoyGrowth > 0.1 ? 'strong' : 'stable'} revenue growth and ${latestFinancial.ebitda_margin > 0.15 ? 'healthy' : 'moderate'} profitability.`,
        ai_tags: [industry, `${geography} Regional`, yoyGrowth > 0.15 ? 'High Growth' : 'Stable Growth'],
        ai_value_levers: ['Market Position', 'Operational Excellence', 'Customer Relationships'],
        ai_risks: Math.random() < 0.3 ? ['Customer Concentration', 'Market Volatility'] : [],
        ai_fit_score: Math.floor(50 + Math.random() * 50),
        ai_confidence: parseFloat((0.6 + Math.random() * 0.4).toFixed(2)),
        ai_sources: ['Company Website', 'Public Filings', 'Industry Reports'],
        ai_generated_at: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString()
      } : undefined,
      
      // Audit trail
      created_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      created_by: 'system',
      updated_by: 'system'
    });
  }
  
  return companies;
}

// Calculate derived metrics
export function calculateRevenueCagr(company: Company, years: number = 3): number {
  if (company.financials.length < years + 1) return 0;
  const latest = company.financials[company.financials.length - 1].revenue;
  const earliest = company.financials[company.financials.length - years - 1].revenue;
  return parseFloat(((Math.pow(latest / earliest, 1 / years) - 1)).toFixed(4));
}

export function getLatestFinancials(company: Company) {
  return company.financials[company.financials.length - 1];
}

// Helper to format SEK values
export function formatSEK(value: number, decimals: number = 1): string {
  const millions = value / 1_000_000;
  return `${millions.toFixed(decimals)}M SEK`;
}

// Helper to format percentages
export function formatPercent(ratio: number, decimals: number = 1): string {
  return `${(ratio * 100).toFixed(decimals)}%`;
}

// Pre-generate companies for performance
export const mockCompanies = generateMockCompanies(13610);