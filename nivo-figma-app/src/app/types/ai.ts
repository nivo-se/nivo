// AI Analysis Types

export type AIRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  prompt: string;
  variables: string[]; // e.g., ['company_name', 'revenue_latest', 'industry_label']
  scoringDimensions: ScoringDimension[];
  created_at: string;
  created_by: string;
}

export interface ScoringDimension {
  id: string;
  name: string;
  description: string;
  weight: number; // 0-1, should sum to 1.0 across all dimensions
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
  
  // Progress tracking
  total_companies: number;
  processed_companies: number;
  failed_companies: number;
  
  // Cost tracking
  estimated_cost: number;
  actual_cost: number;
  
  // Configuration
  config: {
    auto_approve: boolean; // Auto-approve results or require manual review
    overwrite_existing: boolean; // Overwrite existing AI profiles
  };
}

export interface AIResult {
  id: string;
  run_id: string;
  company_orgnr: string;
  status: 'pending' | 'approved' | 'rejected';
  
  // Overall score
  overall_score: number; // 0-100
  
  // Dimension scores
  dimension_scores: {
    [dimensionId: string]: number; // 0-100 for each dimension
  };
  
  // Qualitative analysis
  summary: string; // 2-3 paragraph analysis
  strengths: string[]; // Bullet points
  concerns: string[]; // Bullet points (red flags)
  recommendation: 'strong_fit' | 'potential_fit' | 'weak_fit' | 'pass';
  
  // Metadata
  prompt_used: string;
  tokens_used: number;
  cost: number;
  analyzed_at: string;
  approved_at?: string;
  approved_by?: string;
}

export interface AIProfile {
  company_orgnr: string;
  ai_fit_score: number; // 0-100, from most recent approved analysis
  last_analyzed: string;
  analysis_count: number;
  latest_result?: AIResult;
}
