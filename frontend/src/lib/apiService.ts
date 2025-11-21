/**
 * Centralized API Service
 * Handles all API calls to Railway backend
 */

const getApiBaseUrl = (): string => {
  // If explicitly set, use it (for external API deployment like Railway)
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL
  }
  // In development, use localhost FastAPI backend
  if (import.meta.env.DEV) {
    return 'http://localhost:8000'
  }
  // In production, if VITE_API_BASE_URL is not set, return empty
  console.warn('VITE_API_BASE_URL not set. Backend API needs to be deployed separately.')
  return ''
}

export class ApiService {
  private getBaseUrl(): string {
    return getApiBaseUrl()
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const baseUrl = this.getBaseUrl()
    
    if (!baseUrl && !import.meta.env.DEV) {
      throw new Error(
        'Backend API is not configured. Please set VITE_API_BASE_URL environment variable.'
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
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(error.error || error.message || `HTTP ${response.status}`)
    }
    
    return response.json()
  }

  // Health check
  async healthCheck(): Promise<{ status: string; service: string }> {
    return this.fetch('/health')
  }

  // Status check
  async getStatus(): Promise<any> {
    return this.fetch('/api/status')
  }

  async aiFilter(prompt: string, limit = 20, offset = 0): Promise<AIFilterResponse> {
    return this.fetch('/api/ai-filter/', {
      method: 'POST',
      body: JSON.stringify({ prompt, limit, offset })
    })
  }

  async getCompaniesBatch(orgNumbers: string[]): Promise<{ companies: CompanyRow[]; count: number }> {
    return this.fetch('/api/companies/batch', {
      method: 'POST',
      body: JSON.stringify({ orgnrs: orgNumbers })
    })
  }

  async getCompanyFinancials(orgnr: string): Promise<{ financials: Array<{
    year: number
    revenue_sek: number | null
    profit_sek: number | null
    ebit_sek: number | null
    ebitda_sek: number | null
    net_margin: number | null
    ebit_margin: number | null
    ebitda_margin: number | null
  }>; count: number }> {
    return this.fetch(`/api/companies/${orgnr}/financials`)
  }

  async exportToCopper(orgNumbers: string[], apiToken?: string): Promise<CopperExportResponse> {
    return this.fetch('/api/export/copper', {
      method: 'POST',
      body: JSON.stringify({ org_numbers: orgNumbers, copper_api_token: apiToken })
    })
  }

  async startEnrichment(orgNumbers: string[], forceRefresh = false): Promise<EnrichmentJobResponse> {
    return this.fetch('/api/enrichment/start', {
      method: 'POST',
      body: JSON.stringify({ org_numbers: orgNumbers, force_refresh: forceRefresh })
    })
  }
}

export const apiService = new ApiService()

export interface AIFilterResponse {
  sql: string
  parsed_where_clause: string
  org_numbers: string[]
  count: number
  result_count: number
  total: number
  metadata: AIFilterMetadata
}

export interface AIFilterMetadata {
  where_clause: string
  limit: number
  offset: number
  prompt: string
  used_llm: boolean
  total_matches: number
  result_count: number
  duration_ms?: number
  executor?: 'openai' | 'heuristic'
  sql?: string
}

export interface CopperExportResponse {
  success: boolean
  exported: number
  message?: string
}

export interface EnrichmentJobResponse {
  job_id: string | null
  status: string
  count: number
  skipped?: number
  queued_org_numbers?: string[]
  metadata?: {
    force_refresh?: boolean
    queued_at?: string
    reason?: string
  }
}

export interface CompanyRow {
  orgnr: string
  company_name?: string
  homepage?: string
  employees_latest?: number
  latest_revenue_sek?: number
  latest_profit_sek?: number
  latest_ebitda_sek?: number
  avg_ebitda_margin?: number
  avg_net_margin?: number
  revenue_cagr_3y?: number
  revenue_growth_yoy?: number
  company_size_bucket?: string
  growth_bucket?: string
  profitability_bucket?: string
  ai_strategic_score?: number
  ai_defensibility_score?: number
  ai_product_description?: string
  ai_end_market?: string
  ai_customer_types?: string
  ai_value_chain_position?: string
  ai_notes?: string
  ai_profile_last_updated?: string
  ai_profile_website?: string
}

