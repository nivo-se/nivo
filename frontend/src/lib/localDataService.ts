// Local Data Service for SQLite Database Connection
// This service provides local database access instead of Supabase

export interface LocalCompany {
  OrgNr: string
  name: string
  address?: string
  city?: string
  incorporation_date?: string
  email?: string
  homepage?: string
  segment?: string
  segment_name?: string
  industry_name?: string
  
  // Financial Data (Raw)
  revenue?: string
  profit?: string
  employees?: string
  
  // Calculated KPIs
  SDI?: number
  DR?: number
  ORS?: number
  Revenue_growth?: number
  EBIT_margin?: number
  NetProfit_margin?: number
  
  // Objective Categories
  company_size_category?: string
  employee_size_category?: string
  profitability_category?: string
  growth_category?: string
  digital_presence?: boolean
}

export interface SearchResults {
  companies: LocalCompany[]
  total: number
  summary: {
    avgRevenue: number
    avgGrowth: number
    avgMargin: number
    topIndustries: { industry: string; count: number }[]
    topCities: { city: string; count: number }[]
  }
}

export interface CompanyFilter {
  name?: string
  industry?: string
  city?: string
  minRevenue?: number
  maxRevenue?: number
  minProfit?: number
  maxProfit?: number
  minRevenueGrowth?: number
  maxRevenueGrowth?: number
  minEBITAmount?: number
  maxEBITAmount?: number
  minEmployees?: number
  maxEmployees?: number
  profitability?: string
  size?: string
  growth?: string
}

class LocalDataService {
  // Use Railway API in production, localhost in dev
  private getBaseUrl(): string {
    if (import.meta.env.VITE_API_BASE_URL) {
      return import.meta.env.VITE_API_BASE_URL
    }
    // In development, use localhost
    if (import.meta.env.DEV) {
      return 'http://localhost:8000'
    }
    // In production, return empty (will use Supabase directly)
    return ''
  }

  // Get all companies with pagination and filtering
  async getCompanies(
    page: number = 1,
    limit: number = 20,
    filters: CompanyFilter = {}
  ): Promise<SearchResults> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== undefined)
        )
      })

      const response = await fetch(`${this.getBaseUrl()}/companies?${params}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      return {
        companies: data.companies || [],
        total: data.total || 0,
        summary: {
          avgRevenue: data.summary?.avgRevenue || 0,
          avgGrowth: data.summary?.avgGrowth || 0,
          avgMargin: data.summary?.avgMargin || 0,
          topIndustries: data.summary?.topIndustries || [],
          topCities: data.summary?.topCities || []
        }
      }
    } catch (error) {
      console.error('Error fetching companies:', error)
      // Return mock data when API is not available
      return {
        companies: [
          {
            OrgNr: "5592748551",
            name: "1048 SVERIGE AB",
            address: "Kvarnstigen 43",
            city: "Habo",
            incorporation_date: "05.10.2020",
            email: "info@1048.se",
            homepage: "https://www.1048.se",
            segment: "10003877",
            segment_name: "Konferensarrangörer",
            revenue: "15462",
            profit: "3191",
            employees: "4",
            SDI: 15462.0,
            DR: 3191.0,
            ORS: 4037.0,
            Revenue_growth: -0.011064918452190597,
            EBIT_margin: 0.20637692407191824,
            NetProfit_margin: 0.26109170870521275,
            company_size_category: "Micro",
            employee_size_category: "Small",
            profitability_category: "High Profitability",
            growth_category: "Declining",
            digital_presence: true
          },
          {
            OrgNr: "5567910491",
            name: "157 Logistics AB",
            address: "Ulricehamnsvägen 12",
            city: "Gällstad",
            incorporation_date: "14.10.2009",
            email: null,
            homepage: null,
            segment: "10241668",
            segment_name: "Läder, skor, inredning, reseeffekter och textilier",
            revenue: "20428",
            profit: "9363",
            employees: "0",
            SDI: 20428.0,
            DR: 9363.0,
            ORS: 11792.0,
            Revenue_growth: 0.7421115469895958,
            EBIT_margin: 0.45834149206970826,
            NetProfit_margin: 0.5772469159976503,
            company_size_category: "Micro",
            employee_size_category: "Micro",
            profitability_category: "High Profitability",
            growth_category: "High Growth",
            digital_presence: false
          },
          {
            OrgNr: "5590831094",
            name: "1631 Recordings AB",
            address: "Engelbrektsgatan 31 b",
            city: "Örebro",
            incorporation_date: "01.11.2016",
            email: null,
            homepage: null,
            segment: "10005028",
            segment_name: "Ljudproduktion, musikproduktion",
            revenue: "20864",
            profit: "7305",
            employees: "2",
            SDI: 20864.0,
            DR: 7305.0,
            ORS: 9201.0,
            Revenue_growth: 0.09574076991754632,
            EBIT_margin: 0.3501246165644172,
            NetProfit_margin: 0.44099884969325154,
            company_size_category: "Micro",
            employee_size_category: "Micro",
            profitability_category: "High Profitability",
            growth_category: "Low Growth",
            digital_presence: false
          }
        ],
        total: 8479,
        summary: {
          avgRevenue: 0.04595661646420568,
          avgGrowth: 0.08085113839674168,
          avgMargin: 0.0784499695961497,
          topIndustries: [
            { industry: "Pharmacy goods, medicines - Wholesale", count: 201 },
            { industry: "Printing", count: 82 },
            { industry: "Packaging - Industry", count: 71 },
            { industry: "Iron and explosives", count: 70 },
            { industry: "Sawmills", count: 69 }
          ],
          topCities: [
            { city: "Stockholm", count: 960 },
            { city: "Göteborg", count: 337 },
            { city: "Malmö", count: 247 },
            { city: "Solna", count: 128 },
            { city: "Uppsala", count: 127 }
          ]
        }
      }
    }
  }

  // Get company by OrgNr
  async getCompany(orgNr: string): Promise<LocalCompany | null> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/companies/${orgNr}`)
      
      if (!response.ok) {
        if (response.status === 404) return null
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching company:', error)
      return null
    }
  }

  // Get dashboard analytics
  async getDashboardAnalytics() {
    try {
      const response = await fetch(`${this.getBaseUrl()}/analytics/dashboard`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching dashboard analytics:', error)
      // Return mock data when API is not available
      return {
        totalCompanies: 8479,
        totalWithFinancials: 8479,
        totalWithKPIs: 8479,
        totalWithDigitalPresence: 6877,
        averageRevenueGrowth: 0.08085113839674168,
        averageEBITMargin: 0.0784499695961497
      }
    }
  }

  // Search companies by name
  async searchCompanies(query: string, limit: number = 20): Promise<LocalCompany[]> {
    try {
      const params = new URLSearchParams({
        q: query,
        limit: limit.toString()
      })

      const response = await fetch(`${this.getBaseUrl()}/companies/search?${params}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data.companies || []
    } catch (error) {
      console.error('Error searching companies:', error)
      return []
    }
  }

  // Get industry statistics
  async getIndustryStats() {
    try {
      const response = await fetch(`${this.getBaseUrl()}/analytics/industries`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching industry stats:', error)
      return []
    }
  }

  // Get city statistics
  async getCityStats() {
    try {
      const response = await fetch(`${this.getBaseUrl()}/analytics/cities`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching city stats:', error)
      return []
    }
  }
}

// Create singleton instance
export const localDataService = new LocalDataService()

// Export types for compatibility
export type MasterAnalyticsCompany = LocalCompany
export type DashboardAnalytics = {
  totalCompanies: number
  totalWithFinancials: number
  totalWithKPIs: number
  totalWithDigitalPresence: number
  averageRevenueGrowth: number
  averageEBITMargin: number
}
