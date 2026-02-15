// Clean Supabase Company Service - Direct client queries for all reads
// This service replaces the mixed local DB API + Supabase approach

import { supabase, supabaseConfig } from './supabase'

// Database stores values in thousands (as-is from Allabolag)
// No scaling needed - values are already in the correct format
const CURRENCY_SCALE = 1  // Database stores in thousands

const EMPTY_SUMMARY = () => ({
  avgRevenue: 0,
  avgGrowth: 0,
  avgMargin: 0,
  topIndustries: [] as { industry: string; count: number }[],
  topCities: [] as { city: string; count: number }[]
})

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
  SDI?: number        // Latest revenue in thousands
  DR?: number         // Latest profit in thousands
  ORS?: number        // Latest EBITDA in thousands
  RG?: number         // EBIT (same as ORS for now)
  Revenue_growth?: number  // Calculated from historical data
  EBIT_margin?: number     // Calculated: EBIT / Revenue
  NetProfit_margin?: number // Calculated: Profit / Revenue
  
  // Financial Year - from company_metrics
  year?: number
  
  // Historical Data for Charts (from financial_accounts)
  historicalData?: Array<{
    year: number
    SDI: number | null      // revenue (in thousands)
    RG: number | null       // EBIT (in thousands)
    DR: number | null       // profit (in thousands)
  }>
  
  // Objective Categories (from company_metrics)
  company_size_category?: string  // company_size_bucket
  employee_size_category?: string
  profitability_category?: string  // profitability_bucket
  growth_category?: string         // growth_bucket
  digital_presence?: boolean
  company_id?: string  // Allabolag company ID for linking
  
  // Segmentation Scores (from company_metrics)
  fit_score?: number              // Fit score (0-100)
  ops_upside_score?: number       // Ops upside score (0-100)
  nivo_total_score?: number       // Total score (0-200)
  segment_tier?: 'A' | 'B' | null // Segment tier
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

// Helper functions
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

const extractScaledCurrency = (value: unknown): number | undefined => {
  const numeric = toNumber(value)
  return numeric === null ? undefined : numeric  // No scaling - already in thousands
}

// Calculate growth: (current / previous - 1) * 100
export function calculateGrowth(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || 
      !isFinite(current) || !isFinite(previous) || 
      previous <= 0) {
    return null
  }
  return ((current / previous) - 1) * 100
}

// Calculate EBIT margin: (EBIT / Revenue) * 100
export function calculateEBITMargin(ebit: number | null, revenue: number | null): number | null {
  if (ebit == null || revenue == null || 
      !isFinite(ebit) || !isFinite(revenue) || 
      revenue <= 0) {
    return null
  }
  return (ebit / revenue) * 100
}

// Calculate profit margin: (Profit / Revenue) * 100
export function calculateProfitMargin(profit: number | null, revenue: number | null): number | null {
  if (profit == null || revenue == null || 
      !isFinite(profit) || !isFinite(revenue) || 
      revenue <= 0) {
    return null
  }
  return (profit / revenue) * 100
}

// Fetch historical financial data from financial_accounts table
async function getHistoricalFinancialData(orgnr: string): Promise<Array<{
  year: number
  SDI: number | null
  RG: number | null
  DR: number | null
}>> {
  if (!supabase) {
    return []
  }

  try {
    // Query financial_accounts for SDI (Revenue), RG (EBIT), DR (Profit)
    const { data: accountsData, error } = await supabase
      .from('financial_accounts')
      .select('year, account_code, amount_sek')
      .eq('orgnr', orgnr)
      .eq('period', '12')  // Annual data only
      .in('account_code', ['SDI', 'RG', 'DR'])
      .order('year', { ascending: false })
      .limit(12) // 3 codes * 4 years = 12 rows max

    if (error) {
      console.error('Error fetching historical financial data:', error)
      return []
    }

    if (!accountsData || accountsData.length === 0) {
      return []
    }

    // Group by year and pivot account codes
    const financialsByYear = new Map<number, {SDI: number | null, RG: number | null, DR: number | null}>()
    
    for (const row of accountsData) {
      const year = row.year
      if (!financialsByYear.has(year)) {
        financialsByYear.set(year, { SDI: null, RG: null, DR: null })
      }
      const yearData = financialsByYear.get(year)!
      const amount = extractScaledCurrency(row.amount_sek)
      if (row.account_code === 'SDI') yearData.SDI = amount ?? null
      else if (row.account_code === 'RG') yearData.RG = amount ?? null
      else if (row.account_code === 'DR') yearData.DR = amount ?? null
    }
    
    // Convert to array, sorted by year descending
    const sortedYears = Array.from(financialsByYear.entries())
      .sort((a, b) => b[0] - a[0])
      .slice(0, 4)  // Latest 4 years
    
    return sortedYears.map(([year, data]) => ({
      year: year || 2023,
      SDI: data.SDI,
      RG: data.RG,
      DR: data.DR
    })).filter(item => item.SDI !== null || item.RG !== null || item.DR !== null)
  } catch (error) {
    console.error('Error fetching historical financial data:', error)
    return []
  }
}

// Extract address and city from JSONB address field
function extractAddressFromJsonb(address: any): { addressStr?: string; cityStr?: string } {
  if (!address) {
    return {}
  }

  let addressStr: string | undefined
  let cityStr: string | undefined

  if (typeof address === 'string') {
    addressStr = address
    // Try to extract city from string address (e.g., "Street 123, 12345 City")
    const cityMatch = address.match(/\d{5}\s+([^,]+)$/)
    if (cityMatch) {
      cityStr = cityMatch[1].trim()
    }
  } else if (typeof address === 'object') {
    // Try to get address from visitorAddress, mainOffice, or location
    const addr = address.visitorAddress || address.mainOffice || address.location || address.domicile || address
    
    // Extract city
    cityStr = addr.postPlace || addr.city || address.postPlace || address.city
    
    // Build full address string
    const parts: string[] = []
    if (addr.addressLine || address.addressLine) {
      parts.push(addr.addressLine || address.addressLine)
    }
    if (addr.postCode || address.postCode) {
      parts.push(addr.postCode || address.postCode)
    }
    if (cityStr) {
      parts.push(cityStr)
    }
    
    if (parts.length > 0) {
      addressStr = parts.join(', ')
    } else if (addr.addressLine || address.addressLine) {
      addressStr = addr.addressLine || address.addressLine
    }
  }

  return { addressStr, cityStr }
}

// Extract segment name from JSONB array
function extractSegmentName(segmentNames: any): string | undefined {
  if (!segmentNames) {
    return undefined
  }
  
  if (Array.isArray(segmentNames) && segmentNames.length > 0) {
    return segmentNames[0]
  }
  
  if (typeof segmentNames === 'string') {
    try {
      const parsed = JSON.parse(segmentNames)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed[0]
      }
    } catch {
      return segmentNames
    }
  }
  
  return undefined
}

class SupabaseCompanyService {
  private isSupabaseReady() {
    return !!(supabase && supabaseConfig.isConfigured)
  }

  private buildLocalQueryParams(page: number, limit: number, filters: CompanyFilter = {}) {
    const params = new URLSearchParams()
    const normalizedLimit = Math.max(1, Math.min(limit, 200))
    params.set('limit', normalizedLimit.toString())
    params.set('offset', Math.max(0, (page - 1) * normalizedLimit).toString())

    if (filters.name) params.set('search', filters.name.trim())
    if (filters.industry) params.set('industry', filters.industry.trim())
    if (filters.city) params.set('city', filters.city.trim())

    const setNumberParam = (key: string, value?: number) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        params.set(key, value.toString())
      }
    }

    setNumberParam('minRevenue', filters.minRevenue)
    setNumberParam('maxRevenue', filters.maxRevenue)
    setNumberParam('minProfit', filters.minProfit)
    setNumberParam('maxProfit', filters.maxProfit)
    setNumberParam('minRevenueGrowth', filters.minRevenueGrowth)
    setNumberParam('maxRevenueGrowth', filters.maxRevenueGrowth)
    setNumberParam('minEBITAmount', filters.minEBITAmount)
    setNumberParam('maxEBITAmount', filters.maxEBITAmount)
    setNumberParam('minEmployees', filters.minEmployees)
    setNumberParam('maxEmployees', filters.maxEmployees)

    if (filters.profitability) params.set('profitability', filters.profitability)
    if (filters.size) params.set('size', filters.size)
    if (filters.growth) params.set('growth', filters.growth)

    return params
  }

  private async fetchLocalCompanies(
    page: number,
    limit: number,
    filters: CompanyFilter = {}
  ): Promise<SearchResults> {
    try {
      const params = this.buildLocalQueryParams(page, limit, filters)
      const response = await fetch(`/api/companies?${params.toString()}`)
      if (!response.ok) {
        throw new Error(`Local API error ${response.status}`)
      }
      const data = await response.json()
      const companies: SupabaseCompany[] = data.companies || []
      const total = data.pagination?.total ?? companies.length
      return {
        companies,
        total,
        summary: this.buildLocalSummary(companies)
      }
    } catch (error) {
      console.error('Error fetching companies from local API:', error)
      return {
        companies: [],
        total: 0,
        summary: EMPTY_SUMMARY()
      }
    }
  }

  private async fetchLocalCompany(orgNr: string): Promise<SupabaseCompany | null> {
    try {
      const response = await fetch(`/api/companies?orgnr=${encodeURIComponent(orgNr)}`)
      if (!response.ok) {
        return null
      }
      const data = await response.json()
      return data.company || null
    } catch (error) {
      console.error('Error fetching local company:', error)
      return null
    }
  }

  private async fetchLocalOrgNumbers(filters: CompanyFilter = {}): Promise<string[]> {
    try {
      const params = this.buildLocalQueryParams(1, 1, filters)
      params.delete('limit')
      params.delete('offset')
      const response = await fetch(`/api/companies/orgnrs?${params.toString()}`)
      if (!response.ok) {
        throw new Error(`Local orgnr API error ${response.status}`)
      }
      const data = await response.json()
      return data.orgnrs || []
    } catch (error) {
      console.error('Error fetching local org numbers:', error)
      return []
    }
  }

  private buildLocalSummary(companies: SupabaseCompany[]): SearchResults['summary'] {
    if (!companies.length) {
      return EMPTY_SUMMARY()
    }

    const revenues = companies
      .map((company) => company.SDI ?? toNumber(company.revenue ?? null))
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

    const growths = companies
      .map((company) => (typeof company.Revenue_growth === 'number' ? company.Revenue_growth : null))
      .filter((value): value is number => value !== null && Number.isFinite(value))

    const margins = companies
      .map((company) => (typeof company.EBIT_margin === 'number' ? company.EBIT_margin : null))
      .filter((value): value is number => value !== null && Number.isFinite(value))

    const industryCounts: Record<string, number> = {}
    const cityCounts: Record<string, number> = {}

    companies.forEach((company) => {
      const segment = extractSegmentName(company.segment_name)
      if (segment) {
        industryCounts[segment] = (industryCounts[segment] || 0) + 1
      }
      if (company.city) {
        cityCounts[company.city] = (cityCounts[company.city] || 0) + 1
      }
    })

    const average = (values: number[]) => {
      if (!values.length) return 0
      const sum = values.reduce((acc, value) => acc + value, 0)
      return sum / values.length
    }

    return {
      avgRevenue: average(revenues),
      avgGrowth: average(growths),
      avgMargin: average(margins),
      topIndustries: Object.entries(industryCounts)
        .map(([industry, count]) => ({ industry, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      topCities: Object.entries(cityCounts)
        .map(([city, count]) => ({ city, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    }
  }
  // Get all companies with pagination and filtering
  async getCompanies(
    page: number = 1,
    limit: number = 20,
    filters: CompanyFilter = {}
  ): Promise<SearchResults> {
    if (!this.isSupabaseReady()) {
      return this.fetchLocalCompanies(page, limit, filters)
    }

    try {
      // Start with companies query
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
        
        // Get historical financial data
        const historicalData = await getHistoricalFinancialData(company.orgnr)
        
        // Use database-calculated 3-year CAGR for growth (more reliable than calculating from 2 years)
        // revenue_cagr_3y is stored as a decimal (e.g., 0.15 = 15%), frontend will multiply by 100 for display
        const growth = metrics?.revenue_cagr_3y ?? null

        // Extract address and city
        const { addressStr, cityStr } = extractAddressFromJsonb(company.address)
        
        // Extract segment name
        const segmentName = extractSegmentName(company.segment_names)

        // Calculate margins from latest year data
        const revenue = extractScaledCurrency(metrics?.latest_revenue_sek)
        const ebit = extractScaledCurrency(metrics?.latest_ebitda_sek)
        const profit = extractScaledCurrency(metrics?.latest_profit_sek)
        
        // Use database-calculated margins (stored as decimals, e.g., 0.05 = 5%)
        // Don't calculate on the fly as it can cause unit mismatches
        const ebitMargin = metrics?.avg_ebitda_margin ?? undefined
        const profitMargin = metrics?.avg_net_margin ?? undefined

        return {
          OrgNr: company.orgnr,
          name: company.company_name || 'Unknown Company',
          address: addressStr,
          city: cityStr,
          incorporation_date: company.foundation_year ? `${company.foundation_year}-01-01` : undefined,
          email: company.email || undefined,
          homepage: company.homepage || undefined,
          segment: segmentName,
          segment_name: segmentName,
          industry_name: segmentName,
          revenue: revenue !== undefined ? revenue.toString() : undefined,
          profit: profit !== undefined ? profit.toString() : undefined,
          employees: company.employees_latest?.toString() || undefined,
          SDI: revenue,
          DR: profit,
          ORS: ebit,
          RG: ebit,  // EBIT same as EBITDA for now
          Revenue_growth: growth ?? undefined,
          EBIT_margin: ebitMargin ?? undefined,
          NetProfit_margin: profitMargin ?? undefined,
          year: metrics?.latest_year || undefined,
          historicalData: historicalData,
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

  // Get company by OrgNr
  async getCompany(orgNr: string): Promise<SupabaseCompany | null> {
    if (!this.isSupabaseReady()) {
      return this.fetchLocalCompany(orgNr)
    }

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
      const historicalData = await getHistoricalFinancialData(orgNr)

      // Calculate growth from historical data
      let growth: number | null = null
      if (historicalData.length >= 2) {
        const current = historicalData[0]?.SDI
        const previous = historicalData[1]?.SDI
        growth = calculateGrowth(current ?? null, previous ?? null)
      }

      // Extract address and city
      const { addressStr, cityStr } = extractAddressFromJsonb(companyData.address)
      
      // Extract segment name
      const segmentName = extractSegmentName(companyData.segment_names)

      // Calculate margins from latest year data
      const revenue = extractScaledCurrency(metricsData?.latest_revenue_sek)
      const ebit = extractScaledCurrency(metricsData?.latest_ebitda_sek)
      const profit = extractScaledCurrency(metricsData?.latest_profit_sek)
      
      const ebitMargin = calculateEBITMargin(ebit ?? null, revenue ?? null)
      const profitMargin = calculateProfitMargin(profit ?? null, revenue ?? null)

      return {
        OrgNr: companyData.orgnr,
        name: companyData.company_name || 'Unknown Company',
        address: addressStr,
        city: cityStr,
        incorporation_date: companyData.foundation_year ? `${companyData.foundation_year}-01-01` : undefined,
        email: companyData.email || undefined,
        homepage: companyData.homepage || undefined,
        segment: segmentName,
        segment_name: segmentName,
        industry_name: segmentName,
        revenue: revenue !== undefined ? revenue.toString() : undefined,
        profit: profit !== undefined ? profit.toString() : undefined,
        employees: companyData.employees_latest?.toString() || undefined,
        SDI: revenue,
        DR: profit,
        ORS: ebit,
        RG: ebit,  // EBIT same as EBITDA for now
        Revenue_growth: growth ?? undefined,
        EBIT_margin: ebitMargin ?? undefined,
        NetProfit_margin: profitMargin ?? undefined,
        year: metricsData?.latest_year || undefined,
        historicalData: historicalData,
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

  // Get summary statistics
  private async getSummaryStats() {
    try {
      // Get industry stats
      const industryStats = await this.getIndustryStats()
      const cityStats = await this.getCityStats()

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

  // Get industry statistics
  private async getIndustryStats() {
    if (!this.isSupabaseReady() || !supabase) {
      return []
    }

    try {
      const industryCounts: { [key: string]: number } = {}
      let from = 0
      const batchSize = 2000

      while (true) {
        const { data, error } = await supabase
          .from('companies')
          .select('segment_names')
          .range(from, from + batchSize - 1)

        if (error) {
          console.error('Error fetching industry stats:', error)
          return []
        }

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

        if (!data || data.length < batchSize) {
          break
        }

        from += batchSize
      }

      return Object.entries(industryCounts)
        .map(([industry, count]) => ({ industry, count }))
        .sort((a, b) => b.count - a.count)
    } catch (error) {
      console.error('Error fetching industry stats:', error)
      return []
    }
  }

  // Get city statistics
  private async getCityStats() {
    if (!this.isSupabaseReady() || !supabase) {
      return []
    }

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
        const { cityStr } = extractAddressFromJsonb(company.address)
        if (cityStr) {
          cityCounts[cityStr] = (cityCounts[cityStr] || 0) + 1
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

  // Get companies by OrgNrs array (without historical data to avoid timeouts)
  async getCompaniesByOrgNrs(orgNrs: string[], includeHistorical: boolean = false): Promise<SupabaseCompany[]> {
    if (orgNrs.length === 0) {
      return []
    }
    if (!this.isSupabaseReady()) {
      const companies = await Promise.all(orgNrs.map((orgNr) => this.fetchLocalCompany(orgNr)))
      return companies.filter((company): company is SupabaseCompany => !!company)
    }
    
    try {
      // Get companies
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('orgnr, company_id, company_name, address, homepage, email, phone, segment_names, foundation_year, employees_latest')
        .in('orgnr', orgNrs)

      if (companiesError || !companiesData) {
        console.error('Error fetching companies by OrgNrs:', companiesError)
        return []
      }

      // Get metrics (skip if timeout risk)
      const { data: metricsData } = await supabase
        .from('company_metrics')
        .select('orgnr, latest_year, latest_revenue_sek, latest_profit_sek, latest_ebitda_sek, revenue_cagr_3y, avg_ebitda_margin, avg_net_margin, company_size_bucket, growth_bucket, profitability_bucket, digital_presence')
        .in('orgnr', orgNrs)
        .limit(orgNrs.length) // Add limit to prevent timeout

      const metricsMap = new Map((metricsData || []).map(m => [m.orgnr, m]))

      // Transform data (skip historical data fetch to avoid timeouts)
      const companies = await Promise.all(companiesData.map(async (company) => {
        const metrics = metricsMap.get(company.orgnr)
        
        // Get historical financial data only if requested (skip to avoid timeouts)
        let historicalData: Array<{ year: number; SDI: number | null; RG: number | null; DR: number | null }> | undefined = undefined
        let growth: number | null = null
        
        if (includeHistorical) {
          try {
            historicalData = await getHistoricalFinancialData(company.orgnr)
            // Calculate growth from historical data
            if (historicalData.length >= 2) {
              const current = historicalData[0]?.SDI
              const previous = historicalData[1]?.SDI
              growth = calculateGrowth(current ?? null, previous ?? null)
            }
          } catch (error) {
            console.warn(`Error fetching historical data for ${company.orgnr}:`, error)
            // Continue without historical data
          }
        } else {
          // Use revenue_cagr_3y from metrics if available
          growth = metrics?.revenue_cagr_3y ? metrics.revenue_cagr_3y / 100 : null
        }

        // Extract address and city
        const { addressStr, cityStr } = extractAddressFromJsonb(company.address)
        
        // Extract segment name
        const segmentName = extractSegmentName(company.segment_names)

        // Calculate margins from latest year data
        const revenue = extractScaledCurrency(metrics?.latest_revenue_sek)
        const ebit = extractScaledCurrency(metrics?.latest_ebitda_sek)
        const profit = extractScaledCurrency(metrics?.latest_profit_sek)
        
        // Use database-calculated margins (stored as decimals, e.g., 0.05 = 5%)
        // Don't calculate on the fly as it can cause unit mismatches
        const ebitMargin = metrics?.avg_ebitda_margin ?? undefined
        const profitMargin = metrics?.avg_net_margin ?? undefined

        return {
          OrgNr: company.orgnr,
          name: company.company_name || 'Unknown Company',
          address: addressStr,
          city: cityStr,
          incorporation_date: company.foundation_year ? `${company.foundation_year}-01-01` : undefined,
          email: company.email || undefined,
          homepage: company.homepage || undefined,
          segment: segmentName,
          segment_name: segmentName,
          industry_name: segmentName,
          revenue: revenue !== undefined ? revenue.toString() : undefined,
          profit: profit !== undefined ? profit.toString() : undefined,
          employees: company.employees_latest?.toString() || undefined,
          SDI: revenue,
          DR: profit,
          ORS: ebit,
          RG: ebit,  // EBIT same as EBITDA for now
          Revenue_growth: growth ?? undefined,
          EBIT_margin: ebitMargin ?? undefined,
          NetProfit_margin: profitMargin ?? undefined,
          year: metrics?.latest_year || undefined,
          historicalData: historicalData,
          company_size_category: metrics?.company_size_bucket || undefined,
          profitability_category: metrics?.profitability_bucket || undefined,
          growth_category: metrics?.growth_bucket || undefined,
          digital_presence: metrics?.digital_presence || !!(company.homepage),
          company_id: company.company_id || undefined
        }
      }))

      return companies
    } catch (error) {
      console.error('Error fetching companies by OrgNrs:', error)
      return []
    }
  }

  // Get all company OrgNrs matching the current filters (for Select All functionality)
  async getAllMatchingCompanyOrgNrs(filters: CompanyFilter = {}): Promise<string[]> {
    if (!this.isSupabaseReady()) {
      return this.fetchLocalOrgNumbers(filters)
    }

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
}

// Create singleton instance
export const supabaseCompanyService = new SupabaseCompanyService()
