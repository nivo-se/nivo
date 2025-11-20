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
}

export const apiService = new ApiService()

