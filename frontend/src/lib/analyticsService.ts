import { supabase } from './supabase'

// =====================================================
// INTERFACES FOR MASTER_ANALYTICS TABLE
// =====================================================

export interface MasterAnalyticsCompany {
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

export interface CompanyFilter {
  name?: string
  segment?: string
  companySize?: string
  employeeSize?: string
  profitability?: string
  growth?: string
  digitalPresence?: boolean
  minRevenue?: number
  maxRevenue?: number
  city?: string
}

export interface AnalyticsInsight {
  id: string
  title: string
  description: string
  metric: string
  value: number
  trend: 'up' | 'down' | 'stable'
  category: 'growth' | 'profitability' | 'digital' | 'size'
}

// =====================================================
// ANALYTICS SERVICE CLASS
// =====================================================

export class AnalyticsService {
  // Get comprehensive dashboard analytics
  static async getDashboardAnalytics(): Promise<DashboardAnalytics> {
    try {
      console.log('Fetching dashboard analytics...')

      // Get total count
      const { count: totalCompanies, error: countError } = await supabase
        .from('master_analytics')
        .select('*', { count: 'exact', head: true })

      if (countError) {
        console.error('Error getting total count:', countError)
        throw countError
      }

      console.log('Total companies:', totalCompanies)

      // Initialize counters
      let totalWithFinancials = 0
      let totalWithKPIs = 0
      let totalWithDigitalPresence = 0
      let sampleForAverages: any[] = []

      // Get financial data count - now using actual revenue column (100% coverage since Oct 2025)
      try {
        const { count, error } = await supabase
          .from('master_analytics')
          .select('*', { count: 'exact', head: true })
          .not('revenue', 'is', null)
        totalWithFinancials = count || 0
        console.log('Companies with financial data (revenue column):', totalWithFinancials)
      } catch (error) {
        console.log('Financial data query failed:', error)
      }

      // Try to get KPI data count
      try {
        const { count, error } = await supabase
          .from('master_analytics')
          .select('*', { count: 'exact', head: true })
          .not('Revenue_growth', 'is', null)
        totalWithKPIs = count || 0
        console.log('Companies with KPI data:', totalWithKPIs)
      } catch (error) {
        console.log('KPI data query failed:', error)
      }

      // Try to get digital presence count
      try {
        const { count, error } = await supabase
          .from('master_analytics')
          .select('*', { count: 'exact', head: true })
          .eq('digital_presence', true)
        totalWithDigitalPresence = count || 0
        console.log('Companies with digital presence:', totalWithDigitalPresence)
      } catch (error) {
        console.log('Digital presence query failed:', error)
        // Fallback: check for homepage
        try {
          const { count, error } = await supabase
            .from('master_analytics')
            .select('*', { count: 'exact', head: true })
            .not('homepage', 'is', null)
            .neq('homepage', '')
          totalWithDigitalPresence = count || 0
          console.log('Companies with homepage (digital presence fallback):', totalWithDigitalPresence)
        } catch (fallbackError) {
          console.log('Homepage fallback also failed:', fallbackError)
        }
      }

      // Try to get sample data for averages
      try {
        const { data, error } = await supabase
          .from('master_analytics')
          .select('Revenue_growth, EBIT_margin, NetProfit_margin, SDI')
          .limit(1000)
        sampleForAverages = data || []
        console.log('Sample data for averages:', sampleForAverages.length, 'records')
      } catch (error) {
        console.log('Sample data query failed:', error)
      }

      const result = {
        totalCompanies: totalCompanies || 0,
        totalWithFinancials,
        totalWithKPIs,
        totalWithDigitalPresence,
        averageRevenueGrowth: this.calculateAverage(sampleForAverages?.map(c => c.Revenue_growth) || []),
        averageEBITMargin: this.calculateAverage(sampleForAverages?.map(c => c.EBIT_margin) || []),
        averageNetProfitMargin: this.calculateAverage(sampleForAverages?.map(c => c.NetProfit_margin) || []),
        averageNetProfitGrowth: this.calculateAverage(sampleForAverages?.map(c => c.Revenue_growth) || []), // Using revenue growth as proxy for now
        averageRevenue: this.calculateAverage(sampleForAverages?.map(c => c.SDI) || [])
      }

      console.log('Final analytics result:', result)
      return result

    } catch (error) {
      console.error('Error fetching dashboard analytics:', error)
      return {
        totalCompanies: 0,
        totalWithFinancials: 0,
        totalWithKPIs: 0,
        totalWithDigitalPresence: 0,
        averageRevenueGrowth: 0,
        averageEBITMargin: 0,
        averageNetProfitMargin: 0,
        averageNetProfitGrowth: 0,
        averageRevenue: 0
      }
    }
  }

  // Get companies with advanced filtering
  static async getCompanies(
    page: number = 1,
    limit: number = 50,
    filters?: CompanyFilter
  ): Promise<{ data: MasterAnalyticsCompany[], total: number }> {
    try {
      console.log('Fetching companies with filters:', { page, limit, filters })

      let query = supabase
        .from('master_analytics')
        .select('*', { count: 'exact' })

      // Apply filters (with error handling for each filter)
      if (filters?.segment) {
        try {
          query = query.eq('segment', filters.segment)
        } catch (error) {
          console.log('Segment filter failed:', error)
        }
      }
      
      // Add name search filter if provided
      if (filters?.name) {
        try {
          query = query.ilike('name', `%${filters.name}%`)
        } catch (error) {
          console.log('Name search filter failed:', error)
        }
      }
      if (filters?.companySize) {
        try {
          query = query.eq('company_size_category', filters.companySize)
        } catch (error) {
          console.log('Company size filter failed:', error)
        }
      }
      if (filters?.employeeSize) {
        try {
          query = query.eq('employee_size_category', filters.employeeSize)
        } catch (error) {
          console.log('Employee size filter failed:', error)
        }
      }
      if (filters?.profitability) {
        try {
          query = query.eq('profitability_category', filters.profitability)
        } catch (error) {
          console.log('Profitability filter failed:', error)
        }
      }
      if (filters?.growth) {
        try {
          query = query.eq('growth_category', filters.growth)
        } catch (error) {
          console.log('Growth filter failed:', error)
        }
      }
      if (filters?.digitalPresence !== undefined) {
        try {
          query = query.eq('digital_presence', filters.digitalPresence)
        } catch (error) {
          console.log('Digital presence filter failed, trying homepage fallback:', error)
          // Fallback to homepage
          if (filters.digitalPresence) {
            query = query.not('homepage', 'is', null).neq('homepage', '')
          }
        }
      }
      if (filters?.city) {
        try {
          query = query.ilike('city', `%${filters.city}%`)
        } catch (error) {
          console.log('City filter failed:', error)
        }
      }
      if (filters?.minRevenue) {
        try {
          query = query.gte('revenue', filters.minRevenue.toString())
        } catch (error) {
          console.log('Min revenue filter failed:', error)
        }
      }
      if (filters?.maxRevenue) {
        try {
          query = query.lte('revenue', filters.maxRevenue.toString())
        } catch (error) {
          console.log('Max revenue filter failed:', error)
        }
      }

      // Apply pagination
      const from = (page - 1) * limit
      const to = from + limit - 1
      query = query.range(from, to)

      console.log('Executing query...')
      const { data, count, error } = await query

      if (error) {
        console.error('Supabase query error:', error)
        // Try a simpler query as fallback
        const { data: fallbackData, count: fallbackCount } = await supabase
          .from('master_analytics')
          .select('*', { count: 'exact' })
          .range(from, to)
        
        console.log('Fallback query result:', { dataCount: fallbackData?.length, totalCount: fallbackCount })
        return {
          data: fallbackData || [],
          total: fallbackCount || 0
        }
      }

      console.log('Query result:', { dataCount: data?.length, totalCount: count })

      return {
        data: data || [],
        total: count || 0
      }
    } catch (error) {
      console.error('Error fetching companies:', error)
      return { data: [], total: 0 }
    }
  }

  // Get high-growth companies
  static async getHighGrowthCompanies(limit: number = 20): Promise<MasterAnalyticsCompany[]> {
    try {
      const { data, error } = await supabase
        .from('master_analytics')
        .select('*')
        .eq('growth_category', 'High Growth')
        .not('Revenue_growth', 'is', null)
        .order('Revenue_growth', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching high-growth companies:', error)
      return []
    }
  }

  // Get high-profitability companies
  static async getHighProfitabilityCompanies(limit: number = 20): Promise<MasterAnalyticsCompany[]> {
    try {
      const { data, error } = await supabase
        .from('master_analytics')
        .select('*')
        .eq('profitability_category', 'High Profitability')
        .not('EBIT_margin', 'is', null)
        .order('EBIT_margin', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching high-profitability companies:', error)
      return []
    }
  }

  // Get companies by size category
  static async getCompaniesBySize(size: string, limit: number = 20): Promise<MasterAnalyticsCompany[]> {
    try {
      const { data, error } = await supabase
        .from('master_analytics')
        .select('*')
        .eq('company_size_category', size)
        .not('revenue', 'is', null)
        .order('revenue', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching companies by size:', error)
      return []
    }
  }

  // Get companies with digital presence
  static async getDigitalCompanies(limit: number = 20): Promise<MasterAnalyticsCompany[]> {
    try {
      const { data, error } = await supabase
        .from('master_analytics')
        .select('*')
        .eq('digital_presence', true)
        .not('revenue', 'is', null)
        .order('revenue', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching digital companies:', error)
      return []
    }
  }

  // Get segment analysis
  static async getSegmentAnalysis(): Promise<{ segment: string, count: number, avgGrowth: number, avgProfitability: number }[]> {
    try {
      const { data, error } = await supabase
        .from('master_analytics')
        .select('segment, Revenue_growth, EBIT_margin')
        .not('segment', 'is', null)

      if (error) throw error

      // Group by segment
      const segmentMap = new Map<string, { count: number, growth: number[], profitability: number[] }>()
      
      data?.forEach(company => {
        const segment = company.segment || 'Unknown'
        if (!segmentMap.has(segment)) {
          segmentMap.set(segment, { count: 0, growth: [], profitability: [] })
        }
        
        const segmentData = segmentMap.get(segment)!
        segmentData.count++
        
        if (company.Revenue_growth !== null) {
          segmentData.growth.push(company.Revenue_growth)
        }
        if (company.EBIT_margin !== null) {
          segmentData.profitability.push(company.EBIT_margin)
        }
      })

      return Array.from(segmentMap.entries()).map(([segment, data]) => ({
        segment,
        count: data.count,
        avgGrowth: this.calculateAverage(data.growth),
        avgProfitability: this.calculateAverage(data.profitability)
      })).sort((a, b) => b.count - a.count)
    } catch (error) {
      console.error('Error fetching segment analysis:', error)
      return []
    }
  }

  // Get growth distribution
  static async getGrowthDistribution(): Promise<{ category: string, count: number }[]> {
    try {
      const { data, error } = await supabase
        .from('master_analytics')
        .select('growth_category')
        .not('growth_category', 'is', null)

      if (error) throw error

      const distribution = data?.reduce((acc, company) => {
        const category = company.growth_category || 'Unknown'
        acc[category] = (acc[category] || 0) + 1
        return acc
      }, {} as Record<string, number>) || {}

      return Object.entries(distribution).map(([category, count]) => ({
        category,
        count
      })).sort((a, b) => b.count - a.count)
    } catch (error) {
      console.error('Error fetching growth distribution:', error)
      return []
    }
  }

  // Get profitability distribution
  static async getProfitabilityDistribution(): Promise<{ category: string, count: number }[]> {
    try {
      const { data, error } = await supabase
        .from('master_analytics')
        .select('profitability_category')
        .not('profitability_category', 'is', null)

      if (error) throw error

      const distribution = data?.reduce((acc, company) => {
        const category = company.profitability_category || 'Unknown'
        acc[category] = (acc[category] || 0) + 1
        return acc
      }, {} as Record<string, number>) || {}

      return Object.entries(distribution).map(([category, count]) => ({
        category,
        count
      })).sort((a, b) => b.count - a.count)
    } catch (error) {
      console.error('Error fetching profitability distribution:', error)
      return []
    }
  }

  // Get unique industry categories for filtering (using our new classification)
  static async getUniqueSegments(): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('industry_classification')
        .select('industry_category')
        .not('industry_category', 'is', null)

      if (error) throw error

      const segments = new Set(data?.map(item => item.industry_category) || [])
      return Array.from(segments).sort()
    } catch (error) {
      console.error('Error fetching industry categories:', error)
      return []
    }
  }

  // Get unique cities for filtering
  static async getUniqueCities(): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('master_analytics')
        .select('city')
        .not('city', 'is', null)

      if (error) throw error

      const cities = new Set(data?.map(item => item.city) || [])
      return Array.from(cities).sort()
    } catch (error) {
      console.error('Error fetching cities:', error)
      return []
    }
  }

  // Get revenue distribution
  static async getRevenueDistribution(): Promise<{ range: string, count: number }[]> {
    try {
      const { data, error } = await supabase
        .from('master_analytics')
        .select('company_size_category')
        .not('company_size_category', 'is', null)

      if (error) throw error

      const distribution = data?.reduce((acc, company) => {
        const category = company.company_size_category || 'Unknown'
        acc[category] = (acc[category] || 0) + 1
        return acc
      }, {} as Record<string, number>) || {}

      return Object.entries(distribution).map(([range, count]) => ({
        range,
        count
      }))
    } catch (error) {
      console.error('Error fetching revenue distribution:', error)
      return []
    }
  }

  // Get analytics insights
  static async getAnalyticsInsights(): Promise<AnalyticsInsight[]> {
    try {
      const analytics = await this.getDashboardAnalytics()
      const growthDist = await this.getGrowthDistribution()
      const profitDist = await this.getProfitabilityDistribution()
      
      const insights: AnalyticsInsight[] = []

      // High growth companies insight
      const highGrowthCount = growthDist.find(g => g.category === 'High Growth')?.count || 0
      if (highGrowthCount > 0) {
        insights.push({
          id: 'high-growth',
          title: 'High Growth Companies',
          description: `${highGrowthCount} companies showing high growth potential`,
          metric: 'Companies',
          value: highGrowthCount,
          trend: 'up',
          category: 'growth'
        })
      }

      // High profitability insight
      const highProfitCount = profitDist.find(p => p.category === 'High Profitability')?.count || 0
      if (highProfitCount > 0) {
        insights.push({
          id: 'high-profitability',
          title: 'High Profitability',
          description: `${highProfitCount} companies with strong profitability`,
          metric: 'Companies',
          value: highProfitCount,
          trend: 'up',
          category: 'profitability'
        })
      }

      // Digital presence insight
      const digitalPercentage = (analytics.totalWithDigitalPresence / analytics.totalCompanies) * 100
      insights.push({
        id: 'digital-presence',
        title: 'Digital Presence',
        description: `${digitalPercentage.toFixed(1)}% of companies have digital presence`,
        metric: 'Percentage',
        value: digitalPercentage,
        trend: digitalPercentage > 50 ? 'up' : 'stable',
        category: 'digital'
      })

      return insights
    } catch (error) {
      console.error('Error fetching analytics insights:', error)
      return []
    }
  }

  // Helper function to calculate average
  private static calculateAverage(numbers: (number | null | undefined)[]): number {
    const validNumbers = numbers.filter(n => n !== null && n !== undefined) as number[]
    if (validNumbers.length === 0) return 0
    return validNumbers.reduce((sum, num) => sum + num, 0) / validNumbers.length
  }
}
