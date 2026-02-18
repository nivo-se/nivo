/**
 * Types for Figma export app - compatible with nivo-figma-app DataContext.
 * Used by figmaApi adapter when migrating from mock data to Nivo backend.
 */

// Company - from mockData / universe query
export interface Company {
  orgnr: string;
  display_name: string;
  legal_name: string;
  website_url?: string;
  email?: string;
  phone?: string;
  region?: string;
  municipality?: string;
  industry_code?: string;
  industry_label: string;
  segment_names?: string[] | null;
  status: "active" | "inactive";
  fiscal_year_end?: string;
  currency: string;
  years_available: number;
  latest_year: number;
  revenue_latest: number | null;
  ebitda_latest?: number | null;
  ebitda_margin_latest: number | null;
  ebit_latest?: number;
  ebit_margin_latest?: number;
  revenue_growth_yoy_latest?: number;
  revenue_cagr_3y: number | null;
  revenue_cagr_5y?: number | null;
  employees_latest: number | null;
  stability_score?: number;
  leverage_ratio?: number;
  equity_ratio_latest?: number | null;
  debt_to_equity_latest?: number | null;
  has_homepage: boolean;
  has_ai_profile: boolean;
  has_3y_financials: boolean;
  data_quality_score: number | null;
  is_stale: boolean;
  last_enriched_at?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  financials?: { year: number; revenue: number; ebitda: number; ebit?: number; gross_margin: number; ebitda_margin: number; ebit_margin?: number }[];
  ai_profile?: {
    ai_summary_short?: string;
    ai_summary_long?: string;
    ai_tags?: string[];
    ai_value_levers?: string[];
    ai_risks?: string[];
    ai_fit_score?: number;
    ai_confidence?: number;
    ai_sources?: string[];
    ai_generated_at?: string;
  };
}

// Filters - from mockData
export interface FilterRule {
  id: string;
  field: string;
  operator: string;
  value: unknown;
  type?: string;
}

export interface FilterGroup {
  id: string;
  type: "and" | "or";
  rules: (FilterRule | FilterGroup)[];
}

export interface Filters {
  include: FilterGroup;
  exclude: FilterGroup;
}

// List - from mockData
export interface List {
  id: string;
  name: string;
  owner_user_id: string;
  scope: "private" | "team";
  source_view_id?: string;
  filters?: Filters;
  companyIds: string[];
  stage: "research" | "ai_analysis" | "prospects";
  created_at: string;
  updated_at: string;
  created_by: string;
  created_by_name?: string;
  updated_by: string;
}

// Prospect - from mockData
export interface ProspectStatus {
  id?: string;
  companyId: string;
  status: "new" | "researching" | "contacted" | "in_discussion" | "meeting_scheduled" | "interested" | "not_interested" | "passed" | "deal_in_progress";
  owner?: string;
  lastContact?: string;
  notes: { id?: string; text: string; author: string; date: string }[];
  nextAction?: string;
}

// AI types - from nivo-figma-app/types/ai.ts
export type AIRunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface ScoringDimension {
  id: string;
  name: string;
  description: string;
  weight: number;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  prompt: string;
  variables: string[];
  scoringDimensions: ScoringDimension[];
  created_at: string;
  created_by: string;
}

export interface AIRun {
  id: string;
  name: string;
  list_id: string;
  template_id: string;
  status: AIRunStatus;
  created_at: string;
  created_by: string;
  started_at?: string;
  completed_at?: string;
  total_companies: number;
  processed_companies: number;
  failed_companies: number;
  estimated_cost: number;
  actual_cost: number;
  config: {
    auto_approve: boolean;
    overwrite_existing: boolean;
  };
}

export interface AIResult {
  id: string;
  run_id: string;
  company_orgnr: string;
  status: "pending" | "approved" | "rejected";
  overall_score: number;
  dimension_scores: Record<string, number>;
  summary: string;
  strengths: string[];
  concerns: string[];
  recommendation: "strong_fit" | "potential_fit" | "weak_fit" | "pass";
  prompt_used: string;
  tokens_used: number;
  cost: number;
  analyzed_at: string;
  approved_at?: string;
  approved_by?: string;
}

export interface AIProfile {
  company_orgnr: string;
  ai_fit_score: number;
  last_analyzed: string;
  analysis_count: number;
  latest_result?: AIResult;
}

// DTOs for API calls
export interface CreateListDTO {
  name: string;
  scope: "private" | "team";
  stage?: "research" | "ai_analysis" | "prospects";
  companyIds?: string[];
  filters?: Filters;
}

export interface CreateAIRunDTO {
  name: string;
  list_id?: string;
  orgnrs?: string[];
  template_id: string;
  config: AIRun["config"];
}
