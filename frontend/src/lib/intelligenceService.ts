/**
 * Intelligence Service
 * Unified service for all intelligence operations
 */

// API base URL - use environment variable or default based on environment
const getApiBaseUrl = (): string => {
  // If explicitly set, use it
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL
  }
  // In development, use localhost
  if (import.meta.env.DEV) {
    return 'http://localhost:8000'
  }
  // In production, return empty to indicate API is not available
  // The backend API needs to be deployed separately
  return ''
}

// Helper to handle API errors
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error || error.message || `HTTP ${response.status}`)
  }
  return response.json()
}

export interface FilterWeights {
  revenue: number
  ebitMargin: number
  growth: number
  leverage: number
  headcount: number
}

export interface FilterAnalytics {
  percentiles: Record<string, number[]>
  clusters: Array<{ id: string; name: string; count: number }>
  scatter_data: Array<{ x: number; y: number; orgnr: string; name: string }>
  density_data: Array<{ x: number; y: number; value: number }>
}

export interface CompanyIntel {
  orgnr: string
  company_id: string | null
  domain: string | null
  industry: string | null
  tech_stack: string[]
  digital_maturity_score: number | null
  artifacts: IntelArtifact[]
}

export interface IntelArtifact {
  id: string
  source: string
  artifact_type: string
  url: string | null
  content: string
  created_at: string
}

export interface AIReport {
  orgnr: string
  business_model: string | null
  weaknesses: string[]
  uplift_ops: Array<{
    name: string
    impact: string
    effort: 'Low' | 'Medium' | 'High'
  }>
  impact_range: 'Low' | 'Medium' | 'High' | null
  outreach_angle: string | null
}

export interface JobStatus {
  job_id: string
  status: 'queued' | 'started' | 'finished' | 'failed'
  progress: number
  result?: any
  error?: string
}

class IntelligenceService {
  private getApiBaseUrl(): string {
    // If explicitly set, use it (for external API deployment)
    if (import.meta.env.VITE_API_BASE_URL) {
      return import.meta.env.VITE_API_BASE_URL
    }
    // In development, use localhost FastAPI backend
    if (import.meta.env.DEV) {
      return 'http://localhost:8000'
    }
    // In production/Vercel, use relative URLs (serverless functions are on same domain)
    // This will use /api/* routes which are handled by Vercel serverless functions
    return ''
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const baseUrl = this.getApiBaseUrl()
    
    // If no base URL in production, throw a helpful error
    if (!baseUrl && !import.meta.env.DEV) {
      throw new Error(
        'Backend API is not configured. Please set VITE_API_BASE_URL environment variable ' +
        'or deploy the backend API. Financial Filters require the backend API to be running.'
      )
    }
    
    const url = baseUrl ? `${baseUrl}${endpoint}` : endpoint
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })
    return handleResponse<T>(response)
  }

  // Filter Analytics
  async getFilterAnalytics(weights: FilterWeights, usePercentiles: boolean = false): Promise<FilterAnalytics> {
    return this.fetch<FilterAnalytics>(
      `/api/filters/analytics?weights=${encodeURIComponent(JSON.stringify(weights))}&use_percentiles=${usePercentiles}`
    )
  }

  async applyFilters(weights: FilterWeights, percentileCutoffs?: Record<string, { min: number; max: number }>): Promise<{ companies: any[]; total: number }> {
    return this.fetch('/api/filters/apply', {
      method: 'POST',
      body: JSON.stringify({ weights, percentile_cutoffs: percentileCutoffs }),
    })
  }

  // Company Intelligence
  async getCompanyIntel(orgnr: string): Promise<CompanyIntel> {
    return this.fetch<CompanyIntel>(`/api/companies/${orgnr}/intel`)
  }

  async getAIReport(orgnr: string): Promise<AIReport> {
    return this.fetch<AIReport>(`/api/companies/${orgnr}/ai-report`)
  }

  async triggerEnrichment(orgnr: string): Promise<{ job_id: string }> {
    return this.fetch<{ job_id: string }>(`/api/companies/${orgnr}/enrich`, {
      method: 'POST',
    })
  }

  // Background Jobs
  async triggerEnrichmentBatch(orgnrs: string[]): Promise<{ job_id: string }> {
    return this.fetch<{ job_id: string }>('/api/jobs/enrich', {
      method: 'POST',
      body: JSON.stringify({ orgnrs }),
    })
  }

  async getJobStatus(jobId: string): Promise<JobStatus> {
    return this.fetch<JobStatus>(`/api/jobs/${jobId}`)
  }

  // Vector Search
  async vectorSearch(companyId: string, query: string, limit: number = 5): Promise<{ results: Array<{ content: string; similarity: number }> }> {
    return this.fetch(`/api/search/vector?company_id=${companyId}&query=${encodeURIComponent(query)}&limit=${limit}`)
  }

  // AI Reports
  async generateAIReport(orgnr: string, forceRegenerate: boolean = false): Promise<{ status: string; message: string; orgnr: string }> {
    return this.fetch('/api/ai-reports/generate', {
      method: 'POST',
      body: JSON.stringify({ orgnr, force_regenerate: forceRegenerate }),
    })
  }

  async generateAIReportsBatch(orgnrs: string[]): Promise<{ status: string; message: string; count: number }> {
    return this.fetch('/api/ai-reports/generate-batch', {
      method: 'POST',
      body: JSON.stringify(orgnrs),
    })
  }
}

export const intelligenceService = new IntelligenceService()

