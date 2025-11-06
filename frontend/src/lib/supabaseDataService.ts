// Supabase Data Service - Direct connection to Supabase database
import { supabase, supabaseConfig } from './supabase'
import { localCompanies } from './sampleData'

export interface SupabaseCompany {
  OrgNr: string  // Keep for backward compatibility, maps to orgnr
  name: string   // Maps to company_name
  address?: string
  city?: string
  incorporation_date?: string
  email?: string
  homepage?: string
  segment?: string
  segment_name?: string  // From segment_names JSONB array
  industry_name?: string
  
  // Financial Data (Raw)
  revenue?: string
  profit?: string
  employees?: string
  
  // Calculated KPIs (mapped from new schema)
  SDI?: number        // Maps to latest_revenue_sek from company_metrics
  DR?: number         // Maps to latest_profit_sek from company_metrics
  ORS?: number        // Maps to latest_ebitda_sek from company_metrics
  Revenue_growth?: number  // Maps to revenue_cagr_3y from company_metrics
  EBIT_margin?: number     // Maps to avg_ebitda_margin from company_metrics
  NetProfit_margin?: number // Maps to avg_net_margin from company_metrics
  
  // Financial Year - from company_financials
  year?: number
  
  // Historical Data for Charts (from company_financials)
  historicalData?: Array<{
    year: number
    SDI: number      // revenue_sek
    RG: number       // account_codes->'RG' or ebitda_sek
    DR: number       // profit_sek
  }>
  
  // Objective Categories (from company_metrics)
  company_size_category?: string  // company_size_bucket
  employee_size_category?: string
  profitability_category?: string  // profitability_bucket
  growth_category?: string         // growth_bucket
  digital_presence?: boolean
  company_id?: string  // Allabolag company ID for linking
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
  averageNetProfitMargin: number
  averageNetProfitGrowth: number
  averageRevenue: number
}

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const computeAverage = (values: Array<number | null>): number => {
  const numeric = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (!numeric.length) {
    return 0
  }
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length
}

const buildDashboardAnalytics = (
  rows: Array<Partial<SupabaseCompany> & { homepage?: string | null; digital_presence?: boolean | number }>,
  totalCount?: number
): DashboardAnalytics => {
  const inferredDigitalPresence = rows.map((row) => {
    if (typeof row.digital_presence === 'boolean') {
      return row.digital_presence
    }
    if (typeof row.digital_presence === 'number') {
      return row.digital_presence === 1
    }
    if (typeof row.homepage === 'string') {
      return row.homepage.trim().length > 0
    }
    return false
  })

  const revenueValues = rows.map((row) => toNumber(row.SDI ?? row.revenue))
  const revenueGrowthValues = rows.map((row) => toNumber((row as any).Revenue_growth))
  const ebitMarginValues = rows.map((row) => toNumber((row as any).EBIT_margin))
  const netMarginValues = rows.map((row) => toNumber((row as any).NetProfit_margin))
  const netGrowthValues = rows.map((row) => toNumber((row as any).NetProfit_growth ?? (row as any).Revenue_growth))

  const totalCompanies = totalCount ?? rows.length
  const totalWithFinancials = revenueValues.filter((value) => value !== null).length
  const totalWithKPIs = rows.filter((_, index) => (
    revenueGrowthValues[index] !== null ||
    ebitMarginValues[index] !== null ||
    netMarginValues[index] !== null
  )).length
  const totalWithDigitalPresence = inferredDigitalPresence.filter(Boolean).length

  return {
    totalCompanies,
    totalWithFinancials,
    totalWithKPIs,
    totalWithDigitalPresence,
    averageRevenueGrowth: computeAverage(revenueGrowthValues),
    averageEBITMargin: computeAverage(ebitMarginValues),
    averageNetProfitMargin: computeAverage(netMarginValues),
    averageNetProfitGrowth: computeAverage(netGrowthValues),
    averageRevenue: computeAverage(revenueValues)
  }
}

class SupabaseDataService {
  // Get all companies with pagination and filtering - using new schema (companies + company_metrics + company_financials)
  async getCompanies(
    page: number = 1,
    limit: number = 20,
    filters: CompanyFilter = {}
  ): Promise<SearchResults> {
    try {
      // Query companies - get all matching first, then filter by metrics, then paginate
      // Note: We need to filter by metrics before pagination to get accurate counts
      let companiesQuery = supabase
        .from('companies')
        .select('orgnr, company_id, company_name, address, homepage, email, phone, segment_names, foundation_year, employees_latest', { count: 'exact' })

      // Apply filters on companies table
      if (filters.name) {
        companiesQuery = companiesQuery.ilike('company_name', `%${filters.name}%`)
      }
      if (filters.minEmployees) {
        companiesQuery = companiesQuery.gte('employees_latest', filters.minEmployees)
      }
      if (filters.maxEmployees) {
        companiesQuery = companiesQuery.lte('employees_latest', filters.maxEmployees)
      }

      // Get all matching companies (before pagination) if we need to filter by metrics
      const needsMetricsFilter = !!(filters.minRevenue || filters.maxRevenue || filters.minProfit || filters.maxProfit || 
                                    filters.minRevenueGrowth || filters.maxRevenueGrowth)
      
      const { data: allCompaniesData, error: companiesError, count: totalCount } = needsMetricsFilter
        ? await companiesQuery
        : await companiesQuery.range((page - 1) * limit, page * limit - 1)

      if (companiesError) {
        console.error('Error fetching companies:', companiesError)
        throw companiesError
      }

      if (!allCompaniesData || allCompaniesData.length === 0) {
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

      // Get metrics for all companies
      const orgnrs = allCompaniesData.map(c => c.orgnr)
      const { data: metricsData } = await supabase
        .from('company_metrics')
        .select('orgnr, latest_year, latest_revenue_sek, latest_profit_sek, latest_ebitda_sek, revenue_cagr_3y, avg_ebitda_margin, avg_net_margin, company_size_bucket, growth_bucket, profitability_bucket, digital_presence')
        .in('orgnr', orgnrs)

      // Create metrics lookup
      const metricsMap = new Map((metricsData || []).map(m => [m.orgnr, m]))

      // Apply revenue/profit/growth filters using metrics
      let filteredCompaniesData = allCompaniesData
      if (needsMetricsFilter) {
        filteredCompaniesData = allCompaniesData.filter(company => {
          const metrics = metricsMap.get(company.orgnr)
          if (!metrics) return false
          
          if (filters.minRevenue && (metrics.latest_revenue_sek || 0) < filters.minRevenue) return false
          if (filters.maxRevenue && (metrics.latest_revenue_sek || 0) > filters.maxRevenue) return false
          if (filters.minProfit && (metrics.latest_profit_sek || 0) < filters.minProfit) return false
          if (filters.maxProfit && (metrics.latest_profit_sek || 0) > filters.maxProfit) return false
          if (filters.minRevenueGrowth && (metrics.revenue_cagr_3y || 0) < filters.minRevenueGrowth) return false
          if (filters.maxRevenueGrowth && (metrics.revenue_cagr_3y || 0) > filters.maxRevenueGrowth) return false
          return true
        })
      }

      // Apply pagination after filtering
      const from = (page - 1) * limit
      const to = from + limit
      const paginatedCompaniesData = filteredCompaniesData.slice(from, to)
      const finalCount = needsMetricsFilter ? filteredCompaniesData.length : (totalCount || 0)

      // Transform data to match SupabaseCompany interface
      const companies = await Promise.all(paginatedCompaniesData.map(async (company) => {
        const metrics = metricsMap.get(company.orgnr)
        
        // Get historical financial data from company_financials
        let latestYear = metrics?.latest_year || 2023
        let historicalData: Array<{year: number, SDI: number, RG: number, DR: number}> = []
        
        try {
          const { data: financialsData } = await supabase
            .from('company_financials')
            .select('year, revenue_sek, profit_sek, ebitda_sek, account_codes')
            .eq('orgnr', company.orgnr)
            .eq('period', '12')  // Only annual reports
            .order('year', { ascending: false })
            .limit(4) // Get last 4 years
          
          if (financialsData && Array.isArray(financialsData) && financialsData.length > 0) {
            latestYear = financialsData[0].year || latestYear
            
            historicalData = financialsData
              .filter(item => item && typeof item === 'object')
              .map(item => {
                // Extract RG (EBIT) from account_codes JSONB if available
                const rg = item.account_codes && typeof item.account_codes === 'object' 
                  ? (item.account_codes as any).RG || item.ebitda_sek || 0
                  : item.ebitda_sek || 0
                
                return {
                  year: item.year || 2023,
                  SDI: Number(item.revenue_sek) || 0,
                  RG: Number(rg) || 0,
                  DR: Number(item.profit_sek) || 0
                }
              })
              .filter(item => item.SDI > 0 || item.RG > 0 || item.DR > 0)
          }
        } catch (error) {
          console.log('Could not fetch financial data for company:', company.orgnr, error)
        }

        // Extract segment_name from JSONB array
        const segmentNames = Array.isArray(company.segment_names) 
          ? company.segment_names 
          : (company.segment_names ? [company.segment_names] : [])
        const segmentName = segmentNames.length > 0 ? segmentNames[0] : null

        // Extract address from JSONB if needed
        let addressStr: string | undefined
        let cityStr: string | undefined
        if (company.address) {
          if (typeof company.address === 'string') {
            addressStr = company.address
          } else if (typeof company.address === 'object') {
            addressStr = (company.address as any).addressLine || (company.address as any).visitorAddress?.addressLine
            cityStr = (company.address as any).postPlace || (company.address as any).visitorAddress?.postPlace
          }
        }

        return {
          OrgNr: company.orgnr,  // Keep OrgNr for backward compatibility
          name: company.company_name || 'Unknown Company',
          address: addressStr,
          city: cityStr,
          incorporation_date: company.foundation_year ? `${company.foundation_year}-01-01` : undefined,
          email: company.email || undefined,
          homepage: company.homepage || undefined,
          segment: segmentName || undefined,
          segment_name: segmentName || undefined,
          industry_name: segmentName || undefined,
          revenue: metrics?.latest_revenue_sek ? metrics.latest_revenue_sek.toString() : undefined,
          profit: metrics?.latest_profit_sek ? metrics.latest_profit_sek.toString() : undefined,
          employees: company.employees_latest?.toString() || undefined,
          SDI: metrics?.latest_revenue_sek || undefined,
          DR: metrics?.latest_profit_sek || undefined,
          ORS: metrics?.latest_ebitda_sek || undefined,
          Revenue_growth: metrics?.revenue_cagr_3y || undefined,
          EBIT_margin: metrics?.avg_ebitda_margin || undefined,
          NetProfit_margin: metrics?.avg_net_margin || undefined,
          year: latestYear,
          historicalData: Array.isArray(historicalData) ? historicalData : [],
          company_size_category: metrics?.company_size_bucket || undefined,
          profitability_category: metrics?.profitability_bucket || undefined,
          growth_category: metrics?.growth_bucket || undefined,
          digital_presence: metrics?.digital_presence || !!(company.homepage),
          company_id: company.company_id || undefined
        }
      }))

      // Get summary statistics
      const summary = await this.getSummaryStats()

      return {
        companies,
        total: finalCount,
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

  // Get company by OrgNr using new schema
  async getCompany(orgNr: string): Promise<SupabaseCompany | null> {
    try {
      // Get company data
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('orgnr, company_id, company_name, address, homepage, email, phone, segment_names, foundation_year, employees_latest')
        .eq('orgnr', orgNr)
        .single()

      if (companyError || !companyData) {
        console.error('Error fetching company:', companyError)
        return null
      }

      // Get metrics
      const { data: metricsData } = await supabase
        .from('company_metrics')
        .select('orgnr, latest_year, latest_revenue_sek, latest_profit_sek, latest_ebitda_sek, revenue_cagr_3y, avg_ebitda_margin, avg_net_margin, company_size_bucket, growth_bucket, profitability_bucket, digital_presence')
        .eq('orgnr', orgNr)
        .single()

      // Get historical financial data
      let latestYear = metricsData?.latest_year || 2023
      let historicalData: Array<{year: number, SDI: number, RG: number, DR: number}> = []
      
      try {
        const { data: financialsData } = await supabase
          .from('company_financials')
          .select('year, revenue_sek, profit_sek, ebitda_sek, account_codes')
          .eq('orgnr', orgNr)
          .eq('period', '12')
          .order('year', { ascending: false })
          .limit(4)
        
        if (financialsData && financialsData.length > 0) {
          latestYear = financialsData[0].year || latestYear
          historicalData = financialsData
            .filter(item => item && typeof item === 'object')
            .map(item => {
              const rg = item.account_codes && typeof item.account_codes === 'object' 
                ? (item.account_codes as any).RG || item.ebitda_sek || 0
                : item.ebitda_sek || 0
              return {
                year: item.year || 2023,
                SDI: Number(item.revenue_sek) || 0,
                RG: Number(rg) || 0,
                DR: Number(item.profit_sek) || 0
              }
            })
            .filter(item => item.SDI > 0 || item.RG > 0 || item.DR > 0)
        }
      } catch (error) {
        console.log('Could not fetch financial data:', error)
      }

      // Extract segment_name from JSONB
      const segmentNames = Array.isArray(companyData.segment_names) 
        ? companyData.segment_names 
        : (companyData.segment_names ? [companyData.segment_names] : [])
      const segmentName = segmentNames.length > 0 ? segmentNames[0] : null

      // Extract address from JSONB
      let addressStr: string | undefined
      let cityStr: string | undefined
      if (companyData.address) {
        if (typeof companyData.address === 'string') {
          addressStr = companyData.address
        } else if (typeof companyData.address === 'object') {
          addressStr = (companyData.address as any).addressLine || (companyData.address as any).visitorAddress?.addressLine
          cityStr = (companyData.address as any).postPlace || (companyData.address as any).visitorAddress?.postPlace
        }
      }

      return {
        OrgNr: companyData.orgnr,
        name: companyData.company_name || 'Unknown Company',
        address: addressStr,
        city: cityStr,
        incorporation_date: companyData.foundation_year ? `${companyData.foundation_year}-01-01` : undefined,
        email: companyData.email || undefined,
        homepage: companyData.homepage || undefined,
        segment: segmentName || undefined,
        segment_name: segmentName || undefined,
        industry_name: segmentName || undefined,
        revenue: metricsData?.latest_revenue_sek ? metricsData.latest_revenue_sek.toString() : undefined,
        profit: metricsData?.latest_profit_sek ? metricsData.latest_profit_sek.toString() : undefined,
        employees: companyData.employees_latest?.toString() || undefined,
        SDI: metricsData?.latest_revenue_sek || undefined,
        DR: metricsData?.latest_profit_sek || undefined,
        ORS: metricsData?.latest_ebitda_sek || undefined,
        Revenue_growth: metricsData?.revenue_cagr_3y || undefined,
        EBIT_margin: metricsData?.avg_ebitda_margin || undefined,
        NetProfit_margin: metricsData?.avg_net_margin || undefined,
        year: latestYear,
        historicalData: Array.isArray(historicalData) ? historicalData : [],
        company_size_category: metricsData?.company_size_bucket || undefined,
        profitability_category: metricsData?.profitability_bucket || undefined,
        growth_category: metricsData?.growth_bucket || undefined,
        digital_presence: metricsData?.digital_presence || !!(companyData.homepage),
        company_id: companyData.company_id || undefined
      }
    } catch (error) {
      console.error('Error fetching company:', error)
      return null
    }
  }

  // Get dashboard analytics using new schema
  async getDashboardAnalytics(): Promise<DashboardAnalytics> {
    if (!supabaseConfig.isConfigured) {
      return buildDashboardAnalytics(localCompanies, localCompanies.length)
    }

    try {
      // Get total companies count (no limit needed for count)
      const { count: totalCompanies, error: countError } = await supabase
        .from('companies')
        .select('orgnr', { count: 'exact', head: true })

      if (countError) {
        throw countError
      }

      // Get counts for companies with financials and KPIs
      // All companies have financials (verified: 13,609/13,609), so use totalCompanies
      let totalWithFinancials = totalCompanies || 0
      let totalWithKPIs = totalCompanies || 0
      let totalWithDigitalPresence = 0

      // Verify financials count (but use totalCompanies as fallback since all have financials)
      try {
        const { count: financialsCount } = await supabase
          .from('company_metrics')
          .select('orgnr', { count: 'exact', head: true })
          .not('latest_revenue_sek', 'is', null)
        
        // Use count if reasonable, otherwise use totalCompanies (all have financials)
        if (financialsCount && financialsCount >= (totalCompanies || 0) * 0.9) {
          totalWithFinancials = financialsCount
        }
      } catch (error) {
        console.log('Financials count query failed, using totalCompanies:', error)
      }

      // Verify KPIs count
      try {
        const { count: kpisCount } = await supabase
          .from('company_metrics')
          .select('orgnr', { count: 'exact', head: true })
          .not('revenue_cagr_3y', 'is', null)
        
        if (kpisCount && kpisCount >= (totalCompanies || 0) * 0.9) {
          totalWithKPIs = kpisCount
        }
      } catch (error) {
        console.log('KPIs count query failed, using totalCompanies:', error)
      }

      // Get digital presence count
      try {
        const { count: digitalCount } = await supabase
          .from('company_metrics')
          .select('orgnr', { count: 'exact', head: true })
          .eq('digital_presence', true)
        
        totalWithDigitalPresence = digitalCount || 0
      } catch (error) {
        // Fallback: check homepage in companies table
        try {
          const { count: homepageCount } = await supabase
            .from('companies')
            .select('orgnr', { count: 'exact', head: true })
            .not('homepage', 'is', null)
            .neq('homepage', '')
          totalWithDigitalPresence = homepageCount || 0
        } catch (fallbackError) {
          console.log('Digital presence query failed:', fallbackError)
        }
      }

      // Get sample data for averages (limit to 1000 for performance)
      let sampleForAverages: any[] = []
      try {
        const { data: metricsSample } = await supabase
          .from('company_metrics')
          .select('latest_revenue_sek, revenue_cagr_3y, avg_ebitda_margin, avg_net_margin')
          .limit(1000)
        sampleForAverages = metricsSample || []
      } catch (error) {
        console.log('Sample data query failed:', error)
      }

      // Build analytics data structure for averages calculation
      const analyticsData = sampleForAverages.map(metrics => ({
        OrgNr: '',
        SDI: metrics.latest_revenue_sek || null,
        revenue: metrics.latest_revenue_sek?.toString() || null,
        Revenue_growth: metrics.revenue_cagr_3y || null,
        EBIT_margin: metrics.avg_ebitda_margin || null,
        NetProfit_margin: metrics.avg_net_margin || null,
        NetProfit_growth: metrics.revenue_cagr_3y || null,
        homepage: null,
        digital_presence: false
      }))

      // Build analytics with actual database counts (not sample-based counts)
      const analytics = buildDashboardAnalytics(analyticsData as any, totalCompanies || 0)
      
      // Override with actual database counts
      return {
        ...analytics,
        totalCompanies: totalCompanies || 0,
        totalWithFinancials: totalWithFinancials,
        totalWithKPIs: totalWithKPIs,
        totalWithDigitalPresence: totalWithDigitalPresence
      }
    } catch (error) {
      console.error('Error fetching dashboard analytics:', error)
      return buildDashboardAnalytics(localCompanies, localCompanies.length)
    }
  }

  // Search companies by name using new schema
  async searchCompanies(query: string, limit: number = 20): Promise<SupabaseCompany[]> {
    try {
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('orgnr, company_id, company_name, address, homepage, email, segment_names, foundation_year, employees_latest')
        .ilike('company_name', `%${query}%`)
        .limit(limit)

      if (companiesError || !companiesData) {
        console.error('Error searching companies:', companiesError)
        return []
      }

      // Get metrics for found companies
      const orgnrs = companiesData.map(c => c.orgnr)
      const { data: metricsData } = await supabase
        .from('company_metrics')
        .select('orgnr, latest_year, latest_revenue_sek, latest_profit_sek, latest_ebitda_sek, revenue_cagr_3y, avg_ebitda_margin, avg_net_margin, company_size_bucket, growth_bucket, profitability_bucket, digital_presence')
        .in('orgnr', orgnrs)

      const metricsMap = new Map((metricsData || []).map(m => [m.orgnr, m]))

      // Transform to SupabaseCompany format
      return companiesData.map(company => {
        const metrics = metricsMap.get(company.orgnr)
        const segmentNames = Array.isArray(company.segment_names) ? company.segment_names : (company.segment_names ? [company.segment_names] : [])
        const segmentName = segmentNames.length > 0 ? segmentNames[0] : null

        return {
          OrgNr: company.orgnr,
          name: company.company_name || 'Unknown Company',
          homepage: company.homepage || undefined,
          email: company.email || undefined,
          segment_name: segmentName || undefined,
          employees: company.employees_latest?.toString() || undefined,
          SDI: metrics?.latest_revenue_sek || undefined,
          DR: metrics?.latest_profit_sek || undefined,
          ORS: metrics?.latest_ebitda_sek || undefined,
          Revenue_growth: metrics?.revenue_cagr_3y || undefined,
          EBIT_margin: metrics?.avg_ebitda_margin || undefined,
          NetProfit_margin: metrics?.avg_net_margin || undefined,
          company_size_category: metrics?.company_size_bucket || undefined,
          profitability_category: metrics?.profitability_bucket || undefined,
          growth_category: metrics?.growth_bucket || undefined,
          digital_presence: metrics?.digital_presence || !!(company.homepage),
          company_id: company.company_id || undefined
        }
      })
    } catch (error) {
      console.error('Error searching companies:', error)
      return []
    }
  }

  // Get industry statistics using new schema
  async getIndustryStats() {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('segment_names')

      if (error) {
        console.error('Error fetching industry stats:', error)
        return []
      }

      // Count industries from JSONB array
      const industryCounts: { [key: string]: number } = {}
      data?.forEach(company => {
        const segments = Array.isArray(company.segment_names) 
          ? company.segment_names 
          : (company.segment_names ? [company.segment_names] : [])
        segments.forEach(segment => {
          if (segment) {
            industryCounts[segment] = (industryCounts[segment] || 0) + 1
          }
        })
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

  // Get city statistics using new schema
  async getCityStats() {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('address')

      if (error) {
        console.error('Error fetching city stats:', error)
        return []
      }

      // Extract cities from address JSONB
      const cityCounts: { [key: string]: number } = {}
      data?.forEach(company => {
        let city: string | null = null
        if (company.address) {
          if (typeof company.address === 'object') {
            city = (company.address as any).postPlace || (company.address as any).visitorAddress?.postPlace || null
          }
        }
        if (city) {
          cityCounts[city] = (cityCounts[city] || 0) + 1
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

  // Get companies by OrgNrs array using new schema
  async getCompaniesByOrgNrs(orgNrs: string[]): Promise<SupabaseCompany[]> {
    if (orgNrs.length === 0) return []
    
    try {
      // Get companies
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('orgnr, company_id, company_name, address, homepage, email, segment_names, foundation_year, employees_latest')
        .in('orgnr', orgNrs)

      if (companiesError || !companiesData) {
        console.error('Error fetching companies by OrgNrs:', companiesError)
        return []
      }

      // Get metrics
      const { data: metricsData } = await supabase
        .from('company_metrics')
        .select('orgnr, latest_year, latest_revenue_sek, latest_profit_sek, latest_ebitda_sek, revenue_cagr_3y, avg_ebitda_margin, avg_net_margin, company_size_bucket, growth_bucket, profitability_bucket, digital_presence')
        .in('orgnr', orgNrs)

      const metricsMap = new Map((metricsData || []).map(m => [m.orgnr, m]))

      // Transform data
      return companiesData.map(company => {
        const metrics = metricsMap.get(company.orgnr)
        const segmentNames = Array.isArray(company.segment_names) ? company.segment_names : (company.segment_names ? [company.segment_names] : [])
        const segmentName = segmentNames.length > 0 ? segmentNames[0] : null
        
        let addressStr: string | undefined
        let cityStr: string | undefined
        if (company.address) {
          if (typeof company.address === 'string') {
            addressStr = company.address
          } else if (typeof company.address === 'object') {
            addressStr = (company.address as any).addressLine || (company.address as any).visitorAddress?.addressLine
            cityStr = (company.address as any).postPlace || (company.address as any).visitorAddress?.postPlace
          }
        }

        return {
          OrgNr: company.orgnr,
          name: company.company_name || 'Unknown Company',
          address: addressStr,
          city: cityStr,
          incorporation_date: company.foundation_year ? `${company.foundation_year}-01-01` : undefined,
          email: company.email || undefined,
          homepage: company.homepage || undefined,
          segment: segmentName || undefined,
          segment_name: segmentName || undefined,
          industry_name: segmentName || undefined,
          revenue: metrics?.latest_revenue_sek ? metrics.latest_revenue_sek.toString() : undefined,
          profit: metrics?.latest_profit_sek ? metrics.latest_profit_sek.toString() : undefined,
          employees: company.employees_latest?.toString() || undefined,
          SDI: metrics?.latest_revenue_sek || undefined,
          DR: metrics?.latest_profit_sek || undefined,
          ORS: metrics?.latest_ebitda_sek || undefined,
          Revenue_growth: metrics?.revenue_cagr_3y || undefined,
          EBIT_margin: metrics?.avg_ebitda_margin || undefined,
          NetProfit_margin: metrics?.avg_net_margin || undefined,
          year: metrics?.latest_year || undefined,
          company_size_category: metrics?.company_size_bucket || undefined,
          profitability_category: metrics?.profitability_bucket || undefined,
          growth_category: metrics?.growth_bucket || undefined,
          digital_presence: metrics?.digital_presence || !!(company.homepage),
          company_id: company.company_id || undefined
        }
      })
    } catch (error) {
      console.error('Error fetching companies by OrgNrs:', error)
      return []
    }
  }

  // Get all company OrgNrs matching the current filters (for Select All functionality) using new schema
  async getAllMatchingCompanyOrgNrs(filters: CompanyFilter = {}): Promise<string[]> {
    try {
      // Start with companies query
      let companiesQuery = supabase
        .from('companies')
        .select('orgnr')

      // Apply filters on companies table
      if (filters.name) {
        companiesQuery = companiesQuery.ilike('company_name', `%${filters.name}%`)
      }
      if (filters.minEmployees) {
        companiesQuery = companiesQuery.gte('employees_latest', filters.minEmployees)
      }
      if (filters.maxEmployees) {
        companiesQuery = companiesQuery.lte('employees_latest', filters.maxEmployees)
      }

      const { data: companiesData, error: companiesError } = await companiesQuery

      if (companiesError || !companiesData) {
        console.error('Error fetching companies:', companiesError)
        return []
      }

      let orgnrs = companiesData.map(c => c.orgnr)

      // Apply revenue/profit/growth filters using metrics if needed
      if (filters.minRevenue || filters.maxRevenue || filters.minProfit || filters.maxProfit || 
          filters.minRevenueGrowth || filters.maxRevenueGrowth) {
        const { data: metricsData } = await supabase
          .from('company_metrics')
          .select('orgnr, latest_revenue_sek, latest_profit_sek, revenue_cagr_3y')
          .in('orgnr', orgnrs)

        orgnrs = orgnrs.filter(orgnr => {
          const metrics = metricsData?.find(m => m.orgnr === orgnr)
          if (!metrics) return false
          
          if (filters.minRevenue && (metrics.latest_revenue_sek || 0) < filters.minRevenue) return false
          if (filters.maxRevenue && (metrics.latest_revenue_sek || 0) > filters.maxRevenue) return false
          if (filters.minProfit && (metrics.latest_profit_sek || 0) < filters.minProfit) return false
          if (filters.maxProfit && (metrics.latest_profit_sek || 0) > filters.maxProfit) return false
          if (filters.minRevenueGrowth && (metrics.revenue_cagr_3y || 0) < filters.minRevenueGrowth) return false
          if (filters.maxRevenueGrowth && (metrics.revenue_cagr_3y || 0) > filters.maxRevenueGrowth) return false
          return true
        })
      }

      return orgnrs
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
