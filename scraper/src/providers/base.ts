// Base provider interface for multi-source scraping
export interface SearchFilters {
  revenueFrom: number;
  revenueTo: number;
  profitFrom: number;
  profitTo: number;
  companyType?: string;
  [key: string]: any; // Allow provider-specific filters
}

export interface CompanyBasic {
  orgnr: string;
  companyName: string;
  companyIdHint?: string;
  homepage?: string;
  naceCategories: string[];
  segmentName: string[];
  revenueSek: number | null;
  profitSek: number | null;
  foundationYear: number | null;
  accountsLastYear?: string;
}

export interface FinancialData {
  companyId: string;
  orgnr: string;
  year: number;
  period: string;
  periodStart?: string;
  periodEnd?: string;
  currency: string;
  accounts: Record<string, number | null>; // Account codes (SDI, DR, ORS, etc.)
  rawData: any; // Full JSON response for reference
}

export interface RateLimitConfig {
  concurrent: number;
  delay: number;
  maxRetries: number;
  backoffMultiplier: number;
  maxDelay: number;
  nightMode?: {
    enabled: boolean;
    startHour: number;
    endHour: number;
    concurrent: number;
    delay: number;
  };
}

export interface RequestResult {
  success: boolean;
  status: number;
  timestamp: number;
  duration: number;
  error?: string;
}

export interface ScraperProvider {
  name: string;
  
  // Stage 1: Search/filter companies
  searchCompanies(filters: SearchFilters): AsyncGenerator<CompanyBasic>;
  
  // Stage 2: Get canonical company IDs
  resolveCompanyId(orgnr: string, companyName?: string): Promise<string | null>;
  
  // Stage 3: Fetch financial data
  fetchFinancials(companyId: string): Promise<FinancialData[]>;
  
  // Rate limiting config
  getRateLimitConfig(): RateLimitConfig;
  
  // Provider-specific initialization
  initialize?(): Promise<void>;
  
  // Provider-specific cleanup
  cleanup?(): Promise<void>;
}

export interface JobProgress {
  jobId: string;
  stage: JobStage;
  status: JobStatus;
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  rateLimitStats: {
    requestsPerSecond: number;
    errorRate: number;
    lastError?: string;
  };
  startedAt: string;
  updatedAt: string;
  estimatedCompletion?: string;
}

export type JobStage = 
  | 'stage1_segmentation'
  | 'stage2_id_resolution'
  | 'stage3_financials'
  | 'validation'
  | 'migration';

export type JobStatus = 
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'error';

export interface Checkpoint {
  jobId: string;
  stage: JobStage;
  lastProcessedPage?: number;
  lastProcessedCompany?: string;
  processedCount: number;
  errorCount: number;
  lastError?: string;
  timestamp: string;
}

// Validation types
export interface ValidationResult {
  status: 'valid' | 'warning' | 'invalid';
  errors: string[];
  warnings: string[];
}

export interface ValidationRule {
  name: string;
  validate: (data: any) => ValidationResult;
}

// Staging table types
export interface StagingCompany {
  orgnr: string;
  company_name: string;
  company_id?: string;
  company_id_hint?: string;
  homepage?: string;
  nace_categories: string[];
  segment_name: string[];
  revenue_sek: number | null;
  profit_sek: number | null;
  foundation_year: number | null;
  company_accounts_last_year?: string;
  scraped_at: string;
  job_id: string;
  status: 'pending' | 'id_resolved' | 'financials_fetched' | 'error';
  updated_at: string;
}

export interface StagingFinancial {
  id: string;
  company_id: string;
  orgnr: string;
  year: number;
  period: string;
  period_start?: string;
  period_end?: string;
  currency: string;
  sdi: number | null;  // Revenue
  dr: number | null;   // Net profit
  ors: number | null;  // EBITDA
  ek: number | null;   // Equity
  raw_data: any;
  validation_status: 'pending' | 'valid' | 'warning' | 'invalid';
  validation_errors?: any;
  scraped_at: string;
  job_id: string;
}
