/**
 * Intelligence Service
 * Unified service for all intelligence operations
 */
import { fetchWithAuth } from './backendFetch'
import { API_BASE } from './apiClient'

// API base URL from centralized config.
const getApiBaseUrl = (): string => {
  return API_BASE
}

// Helper to handle API errors
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    // Check if response is HTML (error page) instead of JSON
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('text/html')) {
      const text = await response.text()
      // If it's an HTML error page, provide a helpful error message
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        throw new Error(
          `Backend API returned HTML instead of JSON. This usually means:\n` +
          `1. The API endpoint doesn't exist (404)\n` +
          `2. The API base URL is incorrect\n` +
          `3. The backend server is not running\n` +
          `URL: ${response.url}\n` +
          `Status: ${response.status} ${response.statusText}`
        )
      }
      throw new Error(`Unexpected response format: ${response.statusText}`)
    }
    // Try to parse as JSON
    try {
      const error = await response.json()
      throw new Error(error.error || error.message || error.detail || `HTTP ${response.status}`)
    } catch (parseError) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
  }
  
  // Check content type before parsing
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    const text = await response.text()
    if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      throw new Error(
        `Backend API returned HTML instead of JSON. Check that:\n` +
        `1. VITE_API_BASE_URL is set correctly\n` +
        `2. The backend server is running\n` +
        `3. The endpoint exists\n` +
        `URL: ${response.url}`
      )
    }
    throw new Error(`Expected JSON but got ${contentType}`)
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
    return API_BASE
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const baseUrl = this.getApiBaseUrl()
    
    // If no base URL in production, throw a helpful error
    if (!baseUrl && !import.meta.env.DEV) {
      throw new Error(
        'Backend API is not configured. Please set VITE_API_BASE_URL environment variable ' +
        'in Vercel settings. Financial Filters require the backend API to be running.\n' +
        'Railway backend URL: https://vitereactshadcnts-production-fad5.up.railway.app'
      )
    }
    
    const url = baseUrl ? `${baseUrl}${endpoint}` : endpoint
    
    // Log the URL in development for debugging
    if (import.meta.env.DEV) {
      console.log(`[IntelligenceService] Fetching: ${url}`)
    }
    
    try {
      const response = await fetchWithAuth(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      })
      return handleResponse<T>(response)
    } catch (error) {
      // Enhance error with URL information
      if (error instanceof Error) {
        console.error(`[IntelligenceService] Error fetching ${url}:`, error.message)
        // Don't modify the error, just log it
      }
      throw error
    }
  }

  // Filter Analytics
  async getFilterAnalytics(weights: FilterWeights, usePercentiles: boolean = false): Promise<FilterAnalytics> {
    return this.fetch<FilterAnalytics>(
      `/api/filters/analytics?weights=${encodeURIComponent(JSON.stringify(weights))}&use_percentiles=${usePercentiles}`
    )
  }

  async applyFilters(
    weights: FilterWeights, 
    stageOneSize: number = 180,
    usePercentiles: boolean = false,
    percentileCutoffs?: Record<string, { min: number; max: number }>
  ): Promise<{ companies: any[]; total: number }> {
    return this.fetch('/api/filters/apply', {
      method: 'POST',
      body: JSON.stringify({ 
        weights, 
        stage_one_size: stageOneSize,
        use_percentiles: usePercentiles,
        percentile_cutoffs: percentileCutoffs 
      }),
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

  // AI Reports - returns full report when available (cache-first or freshly generated)
  async generateAIReport(
    orgnr: string,
    forceRegenerate: boolean = false
  ): Promise<AIReport & { cached?: boolean }> {
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
