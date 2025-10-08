// Supabase Data Service - Direct connection to Supabase database
import { supabase } from './supabase'

export interface SupabaseCompany {
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
  
  // Financial Year - from company_accounts_by_id
  year?: number
  
  // Historical Data for Charts
  historicalData?: Array<{
    year: number
    SDI: number
    RG: number
    DR: number
  }>
  
  // Objective Categories
  company_size_category?: string
  employee_size_category?: string
  profitability_category?: string
  growth_category?: string
  digital_presence?: boolean
}

export interface SearchResults {
  companies: SupabaseCompany[]
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

export interface DashboardAnalytics {
  totalCompanies: number
  totalWithFinancials: number
  totalWithKPIs: number
  totalWithDigitalPresence: number
  averageRevenueGrowth: number
  averageEBITMargin: number
  averageRevenue: number
}

class SupabaseDataService {
  // Get all companies with pagination and filtering - combine master_analytics with company_accounts_by_id
  async getCompanies(
    page: number = 1,
    limit: number = 20,
    filters: CompanyFilter = {}
  ): Promise<SearchResults> {
    try {
      // First get companies from master_analytics (has company names and details)
      // Note: Only query columns that actually exist in the Supabase table
      let query = supabase
        .from('master_analytics')
        .select('OrgNr, name, address, city, incorporation_date, email, homepage, segment, segment_name, employees, SDI, DR, ORS, Revenue_growth, EBIT_margin, NetProfit_margin', { count: 'exact' })

      // Apply filters
      if (filters.name) {
        query = query.ilike('name', `%${filters.name}%`)
      }
      if (filters.city) {
        query = query.ilike('city', `%${filters.city}%`)
      }
      if (filters.industry) {
        query = query.ilike('segment_name', `%${filters.industry}%`)
      }
      if (filters.minRevenue) {
        query = query.gte('SDI', filters.minRevenue)
      }
      if (filters.maxRevenue) {
        query = query.lte('SDI', filters.maxRevenue)
      }
      if (filters.minProfit) {
        query = query.gte('DR', filters.minProfit)
      }
      if (filters.maxProfit) {
        query = query.lte('DR', filters.maxProfit)
      }
      if (filters.minRevenueGrowth) {
        query = query.gte('Revenue_growth', filters.minRevenueGrowth)
      }
      if (filters.maxRevenueGrowth) {
        query = query.lte('Revenue_growth', filters.maxRevenueGrowth)
      }
      if (filters.minEmployees) {
        query = query.gte('employees', filters.minEmployees.toString())
      }
      if (filters.maxEmployees) {
        query = query.lte('employees', filters.maxEmployees.toString())
      }

      // Apply pagination
      const from = (page - 1) * limit
      const to = from + limit - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) {
        console.error('Error fetching companies:', error)
        throw error
      }

      // Transform data to match SupabaseCompany interface
      const companies = await Promise.all((data || []).map(async (company) => {
        // Get the latest year data and historical data from company_accounts_by_id
        let latestYear = company.analysis_year || 2023 // Default fallback
        let historicalData: Array<{year: number, SDI: number, RG: number, DR: number}> = []
        
        try {
          const { data: yearData } = await supabase
            .from('company_accounts_by_id')
            .select('year, SDI, RG, DR')
            .eq('organisationNumber', company.OrgNr)
            .order('year', { ascending: false })
            .limit(4) // Get last 4 years
          
          console.log(`Fetching data for ${company.OrgNr}:`, yearData) // Debug log
          
          if (yearData && Array.isArray(yearData) && yearData.length > 0) {
            // Convert year from string to number since it's stored as TEXT in database
            const firstYear = parseInt(yearData[0].year) || 2023
            latestYear = firstYear
            
            // Ensure all financial data is properly handled with strict type checking
            historicalData = yearData
              .filter(item => item && typeof item === 'object') // Filter out null/undefined items
              .map(item => ({
                year: parseInt(item.year) || 2023, // Convert string year to number
                SDI: parseFloat(item.SDI) || 0, // Convert string to number
                RG: parseFloat(item.RG) || 0, // Convert string to number
                DR: parseFloat(item.DR) || 0 // Convert string to number
              }))
              .filter(item => item.SDI > 0 || item.RG > 0 || item.DR > 0) // Only include records with actual data
          }
        } catch (error) {
          console.log('Could not fetch year data for company:', company.OrgNr)
        }

        return {
          OrgNr: company.OrgNr,
          name: company.name || 'Unknown Company',
          address: company.address,
          city: company.city,
          incorporation_date: company.incorporation_date,
          email: company.email,
          homepage: company.homepage,
          segment: company.segment,
          segment_name: company.segment_name,
          industry_name: company.segment_name,
          revenue: company.SDI ? company.SDI.toString() : undefined,
          profit: company.DR ? company.DR.toString() : undefined,
          employees: company.employees,
          SDI: company.SDI,
          DR: company.DR,
          ORS: company.ORS,
          Revenue_growth: company.Revenue_growth,
          EBIT_margin: company.EBIT_margin,
          NetProfit_margin: company.NetProfit_margin,
          year: latestYear, // Use latest year from company_accounts_by_id
          historicalData: Array.isArray(historicalData) ? historicalData : [], // Ensure historicalData is always an array
          company_size_category: null, // Not in Supabase table
          employee_size_category: null,
          profitability_category: null,
          growth_category: null,
          digital_presence: !!(company.homepage)
        }
      }))

      // Get summary statistics
      const summary = await this.getSummaryStats()

      return {
        companies,
        total: count || 0,
        summary
      }
    } catch (error) {
      console.error('Error fetching companies:', error)
      return {
        companies: [],
        total: 0,
        summary: {
          avgRevenue: 0,
          avgGrowth: 0,
          avgMargin: 0,
          topIndustries: [],
          topCities: []
        }
      }
    }
  }

  // Get company by OrgNr from master_analytics
  async getCompany(orgNr: string): Promise<SupabaseCompany | null> {
    try {
      const { data, error } = await supabase
        .from('master_analytics')
        .select('OrgNr, name, address, city, incorporation_date, email, homepage, segment, segment_name, employees, SDI, DR, ORS, Revenue_growth, EBIT_margin, NetProfit_margin')
        .eq('OrgNr', orgNr)
        .single()

      if (error) {
        console.error('Error fetching company:', error)
        return null
      }

      // Transform data to match SupabaseCompany interface
      return {
        OrgNr: data.OrgNr,
        name: data.name || 'Unknown Company',
        address: data.address,
        city: data.city,
        incorporation_date: data.incorporation_date,
        email: data.email,
        homepage: data.homepage,
        segment: data.segment,
        segment_name: data.segment_name,
        industry_name: data.segment_name,
        revenue: data.SDI ? data.SDI.toString() : undefined,
        profit: data.DR ? data.DR.toString() : undefined,
        employees: data.employees,
        SDI: data.SDI,
        DR: data.DR,
        ORS: data.ORS,
        Revenue_growth: data.Revenue_growth,
        EBIT_margin: data.EBIT_margin,
        NetProfit_margin: data.NetProfit_margin,
        year: null, // analysis_year not in Supabase table
        company_size_category: null,
        employee_size_category: null,
        profitability_category: null,
        growth_category: null,
        digital_presence: !!(data.homepage)
      }
    } catch (error) {
      console.error('Error fetching company:', error)
      return null
    }
  }

  // Get dashboard analytics
  async getDashboardAnalytics(): Promise<DashboardAnalytics> {
    try {
      // Get total companies
      const { count: totalCompanies } = await supabase
        .from('master_analytics')
        .select('*', { count: 'exact', head: true })

      // Get companies with financial data
      const { count: totalWithFinancials } = await supabase
        .from('master_analytics')
        .select('*', { count: 'exact', head: true })
        .not('SDI', 'is', null)

      // Get companies with KPIs
      const { count: totalWithKPIs } = await supabase
        .from('master_analytics')
        .select('*', { count: 'exact', head: true })
        .not('SDI', 'is', null)

      // Get companies with digital presence
      const { count: totalWithDigitalPresence } = await supabase
        .from('master_analytics')
        .select('*', { count: 'exact', head: true })
        .not('homepage', 'is', null)

      // Get average revenue growth
      const { data: growthData } = await supabase
        .from('master_analytics')
        .select('Revenue_growth')
        .not('Revenue_growth', 'is', null)

      const averageRevenueGrowth = growthData?.length 
        ? growthData.reduce((sum, item) => sum + (item.Revenue_growth || 0), 0) / growthData.length
        : 0

      // Get average EBIT margin
      const { data: marginData } = await supabase
        .from('master_analytics')
        .select('EBIT_margin')
        .not('EBIT_margin', 'is', null)

      const averageEBITMargin = marginData?.length
        ? marginData.reduce((sum, item) => sum + (item.EBIT_margin || 0), 0) / marginData.length
        : 0

      // Get average revenue (SDI field)
      const { data: revenueData } = await supabase
        .from('master_analytics')
        .select('SDI')
        .not('SDI', 'is', null)

      const averageRevenue = revenueData?.length
        ? revenueData.reduce((sum, item) => sum + (item.SDI || 0), 0) / revenueData.length
        : 0

      return {
        totalCompanies: totalCompanies || 0,
        totalWithFinancials: totalWithFinancials || 0,
        totalWithKPIs: totalWithKPIs || 0,
        totalWithDigitalPresence: totalWithDigitalPresence || 0,
        averageRevenueGrowth,
        averageEBITMargin,
        averageRevenue
      }
    } catch (error) {
      console.error('Error fetching dashboard analytics:', error)
      return {
        totalCompanies: 0,
        totalWithFinancials: 0,
        totalWithKPIs: 0,
        totalWithDigitalPresence: 0,
        averageRevenueGrowth: 0,
        averageEBITMargin: 0,
        averageRevenue: 0
      }
    }
  }

  // Search companies by name
  async searchCompanies(query: string, limit: number = 20): Promise<SupabaseCompany[]> {
    try {
      const { data, error } = await supabase
        .from('master_analytics')
        .select('*')
        .ilike('name', `%${query}%`)
        .limit(limit)

      if (error) {
        console.error('Error searching companies:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error searching companies:', error)
      return []
    }
  }

  // Get industry statistics
  async getIndustryStats() {
    try {
      const { data, error } = await supabase
        .from('master_analytics')
        .select('segment_name')
        .not('segment_name', 'is', null)

      if (error) {
        console.error('Error fetching industry stats:', error)
        return []
      }

      // Count industries
      const industryCounts: { [key: string]: number } = {}
      data?.forEach(company => {
        if (company.segment_name) {
          industryCounts[company.segment_name] = (industryCounts[company.segment_name] || 0) + 1
        }
      })

      return Object.entries(industryCounts)
        .map(([industry, count]) => ({ industry, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    } catch (error) {
      console.error('Error fetching industry stats:', error)
      return []
    }
  }

  // Get city statistics
  async getCityStats() {
    try {
      const { data, error } = await supabase
        .from('master_analytics')
        .select('city')
        .not('city', 'is', null)

      if (error) {
        console.error('Error fetching city stats:', error)
        return []
      }

      // Count cities
      const cityCounts: { [key: string]: number } = {}
      data?.forEach(company => {
        if (company.city) {
          cityCounts[company.city] = (cityCounts[company.city] || 0) + 1
        }
      })

      return Object.entries(cityCounts)
        .map(([city, count]) => ({ city, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    } catch (error) {
      console.error('Error fetching city stats:', error)
      return []
    }
  }

  // Get companies by OrgNrs array
  async getCompaniesByOrgNrs(orgNrs: string[]): Promise<SupabaseCompany[]> {
    if (orgNrs.length === 0) return []
    
    try {
      const { data, error } = await supabase
        .from('master_analytics')
        .select('OrgNr, name, address, city, incorporation_date, email, homepage, segment, segment_name, employees, SDI, DR, ORS, Revenue_growth, EBIT_margin, NetProfit_margin')
        .in('OrgNr', orgNrs)

      if (error) {
        console.error('Error fetching companies by OrgNrs:', error)
        return []
      }

      // Transform data to match SupabaseCompany interface
      return (data || []).map(company => ({
        OrgNr: company.OrgNr,
        name: company.name || 'Unknown Company',
        address: company.address,
        city: company.city,
        incorporation_date: company.incorporation_date,
        email: company.email,
        homepage: company.homepage,
        segment: company.segment,
        segment_name: company.segment_name,
        industry_name: company.segment_name,
        revenue: company.SDI ? company.SDI.toString() : undefined,
        profit: company.DR ? company.DR.toString() : undefined,
        employees: company.employees,
        SDI: company.SDI,
        DR: company.DR,
        ORS: company.ORS,
        Revenue_growth: company.Revenue_growth,
        EBIT_margin: company.EBIT_margin,
        NetProfit_margin: company.NetProfit_margin,
        year: null, // analysis_year not in table
        company_size_category: null,
        employee_size_category: null,
        profitability_category: null,
        growth_category: null,
        digital_presence: !!(company.homepage)
      }))
    } catch (error) {
      console.error('Error fetching companies by OrgNrs:', error)
      return []
    }
  }

  // Get all company OrgNrs matching the current filters (for Select All functionality)
  async getAllMatchingCompanyOrgNrs(filters: CompanyFilter = {}): Promise<string[]> {
    try {
      let query = supabase
        .from('master_analytics')
        .select('OrgNr')

      // Apply the same filters as in getCompanies
      if (filters.name) {
        query = query.ilike('name', `%${filters.name}%`)
      }
      if (filters.city) {
        query = query.ilike('city', `%${filters.city}%`)
      }
      if (filters.industry) {
        query = query.ilike('segment_name', `%${filters.industry}%`)
      }
      if (filters.minRevenue) {
        query = query.gte('SDI', filters.minRevenue)
      }
      if (filters.maxRevenue) {
        query = query.lte('SDI', filters.maxRevenue)
      }
      if (filters.minProfit) {
        query = query.gte('DR', filters.minProfit)
      }
      if (filters.maxProfit) {
        query = query.lte('DR', filters.maxProfit)
      }
      if (filters.minRevenueGrowth) {
        query = query.gte('Revenue_growth', filters.minRevenueGrowth)
      }
      if (filters.maxRevenueGrowth) {
        query = query.lte('Revenue_growth', filters.maxRevenueGrowth)
      }
      if (filters.minEmployees) {
        query = query.gte('employees', filters.minEmployees.toString())
      }
      if (filters.maxEmployees) {
        query = query.lte('employees', filters.maxEmployees.toString())
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching all matching company OrgNrs:', error)
        return []
      }

      return data?.map(company => company.OrgNr) || []
    } catch (error) {
      console.error('Error fetching all matching company OrgNrs:', error)
      return []
    }
  }

  // Get summary statistics
  private async getSummaryStats() {
    try {
      const [industryStats, cityStats] = await Promise.all([
        this.getIndustryStats(),
        this.getCityStats()
      ])

      return {
        avgRevenue: 0, // Would need to calculate from revenue data
        avgGrowth: 0, // Would need to calculate from growth data
        avgMargin: 0, // Would need to calculate from margin data
        topIndustries: industryStats.slice(0, 5),
        topCities: cityStats.slice(0, 5)
      }
    } catch (error) {
      console.error('Error fetching summary stats:', error)
      return {
        avgRevenue: 0,
        avgGrowth: 0,
        avgMargin: 0,
        topIndustries: [],
        topCities: []
      }
    }
  }
}

// Create singleton instance
export const supabaseDataService = new SupabaseDataService()

// Export types for compatibility
export type MasterAnalyticsCompany = SupabaseCompany
