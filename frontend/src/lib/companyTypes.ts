/**
 * Shared company record shape for dashboard / search / lists (Postgres-backed via API).
 */

export interface CompanyRecord {
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
  revenue?: string
  profit?: string
  employees?: string
  SDI?: number
  DR?: number
  ORS?: number
  Revenue_growth?: number
  EBIT_margin?: number
  NetProfit_margin?: number
  year?: number
  historicalData?: Array<{
    year: number
    SDI: number
    RG: number
    DR: number
  }>
  company_size_category?: string
  employee_size_category?: string
  profitability_category?: string
  growth_category?: string
  digital_presence?: boolean
  company_id?: string
  fit_score?: number
  ops_upside_score?: number
  nivo_total_score?: number
  segment_tier?: 'A' | 'B' | '1' | '2' | '3' | null
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

export interface SearchResults {
  companies: CompanyRecord[]
  total: number
  summary: {
    avgRevenue: number
    avgGrowth: number
    avgMargin: number
    topIndustries: { industry: string; count: number }[]
    topCities: { city: string; count: number }[]
  }
}

export interface DashboardAnalytics {
  totalCompanies: number
  totalWithFinancials: number
  totalWithKPIs: number
  totalWithDigitalPresence: number
  averageRevenueGrowth: number
  averageEBITMargin: number
  averageNetProfitMargin: number
  averageNetProfitGrowth: number
  averageRevenue: number
  topIndustries?: Array<{ name: string; count: number; percentage: number }>
  companySizeDistribution?: Array<{ name: string; count: number; percentage: number }>
}
