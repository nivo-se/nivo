import { supabase } from './supabase'

export interface Company {
  OrgNr: string
  name: string
  address?: string
  city?: string
  incorporation_date?: string
  revenue?: number
  profit?: number
  email?: string
  homepage?: string
  employees?: number
  segment?: string
  segment_name?: string
}

export interface CompanyKPI {
  OrgNr: string
  year: number
  ebit_margin?: number
  net_margin?: number
  pbt_margin?: number
  revenue_growth?: number
  ebit_growth?: number
  profit_growth?: number
  equity_ratio?: number
  return_on_equity?: number
}

export interface DashboardStats {
  totalCompanies: number
  totalFinancialRecords: number
  activeSegments: number
  aiInsights: number
}

export interface SegmentationOption {
  id: string
  name: string
  description: string
  tableName: string
}

export class DataService {
  // Get dashboard statistics
  static async getDashboardStats(): Promise<DashboardStats> {
    try {
      // Get total companies from the main raw data table
      const { count: totalCompanies } = await supabase
        .from('all_companies_raw')
        .select('*', { count: 'exact', head: true })

      // Get total financial records
      const { count: totalFinancialRecords } = await supabase
        .from('company_accounts_by_id')
        .select('*', { count: 'exact', head: true })

      // Get unique segments
      const { data: segments } = await supabase
        .from('all_companies_raw')
        .select('segment')
        .not('segment', 'is', null)

      const uniqueSegments = new Set(segments?.map(s => s.segment) || []).size

      // Get AI insights count
      const { count: aiInsights } = await supabase
        .from('ai_company_analysis')
        .select('*', { count: 'exact', head: true })

      return {
        totalCompanies: totalCompanies || 0,
        totalFinancialRecords: totalFinancialRecords || 0,
        activeSegments: uniqueSegments,
        aiInsights: aiInsights || 0
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
      return {
        totalCompanies: 0,
        totalFinancialRecords: 0,
        activeSegments: 0,
        aiInsights: 0
      }
    }
  }

  // Get companies with pagination and filtering
  static async getCompanies(
    page: number = 1,
    limit: number = 50,
    filters?: {
      segment?: string
      minRevenue?: number
      maxRevenue?: number
      city?: string
    }
  ): Promise<{ data: Company[], total: number }> {
    try {
      let query = supabase
        .from('all_companies_raw')
        .select('*', { count: 'exact' })

      // Apply filters
      if (filters?.segment) {
        query = query.eq('segment', filters.segment)
      }
      if (filters?.city) {
        query = query.ilike('city', `%${filters.city}%`)
      }
      if (filters?.minRevenue) {
        query = query.gte('revenue', filters.minRevenue.toString())
      }
      if (filters?.maxRevenue) {
        query = query.lte('revenue', filters.maxRevenue.toString())
      }

      // Apply pagination
      const from = (page - 1) * limit
      const to = from + limit - 1
      query = query.range(from, to)

      const { data, count, error } = await query

      if (error) throw error

      return {
        data: data || [],
        total: count || 0
      }
    } catch (error) {
      console.error('Error fetching companies:', error)
      return { data: [], total: 0 }
    }
  }

  // Get company KPIs
  static async getCompanyKPIs(orgNr?: string): Promise<CompanyKPI[]> {
    try {
      let query = supabase
        .from('company_kpis_by_id')
        .select('*')
        .order('year', { ascending: false })

      if (orgNr) {
        query = query.eq('organisationNumber', orgNr)
      }

      const { data, error } = await query

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error fetching company KPIs:', error)
      return []
    }
  }

  // Get segmentation options
  static getSegmentationOptions(): SegmentationOption[] {
    return [
      {
        id: 'all_companies_raw',
        name: 'All Companies (Raw)',
        description: 'Complete dataset of all Swedish companies',
        tableName: 'all_companies_raw'
      },
      {
        id: 'filtered_companies',
        name: 'Filtered Companies',
        description: 'Companies that meet basic filtering criteria',
        tableName: 'filtered_companies_basic_filters_20250618_104425'
      },
      {
        id: 'high_potential',
        name: 'High Potential Candidates',
        description: 'Companies identified as high-potential targets',
        tableName: 'high_potential_candidates'
      },
      {
        id: 'ecommerce',
        name: 'E-commerce Companies',
        description: 'Companies in e-commerce and digital product sectors',
        tableName: 'digitizable_ecommerce_and_product_companies'
      },
      {
        id: 'segmented',
        name: 'Segmented Companies',
        description: 'Companies with enhanced segmentation analysis',
        tableName: 'enhanced_segmentation'
      },
      {
        id: 'ai_analyzed',
        name: 'AI Analyzed Companies',
        description: 'Companies with AI-powered analysis and insights',
        tableName: 'ai_company_analysis'
      }
    ]
  }

  // Get data by segmentation
  static async getDataBySegmentation(
    segmentationId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ data: any[], total: number }> {
    try {
      const options = this.getSegmentationOptions()
      const option = options.find(opt => opt.id === segmentationId)
      
      if (!option) {
        throw new Error(`Segmentation option ${segmentationId} not found`)
      }

      const from = (page - 1) * limit
      const to = from + limit - 1

      const { data, count, error } = await supabase
        .from(option.tableName)
        .select('*', { count: 'exact' })
        .range(from, to)

      if (error) throw error

      return {
        data: data || [],
        total: count || 0
      }
    } catch (error) {
      console.error('Error fetching segmented data:', error)
      return { data: [], total: 0 }
    }
  }

  // Get unique segments for filtering
  static async getUniqueSegments(): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('all_companies_raw')
        .select('segment')
        .not('segment', 'is', null)

      if (error) throw error

      const segments = new Set(data?.map(item => item.segment) || [])
      return Array.from(segments).sort()
    } catch (error) {
      console.error('Error fetching segments:', error)
      return []
    }
  }

  // Get unique cities for filtering
  static async getUniqueCities(): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('all_companies_raw')
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

  // Get revenue distribution for charts
  static async getRevenueDistribution(): Promise<{ range: string, count: number }[]> {
    try {
      const { data, error } = await supabase
        .from('all_companies_raw')
        .select('revenue')
        .not('revenue', 'is', null)

      if (error) throw error

      // Group by revenue ranges
      const ranges = [
        { min: 0, max: 1000000, label: '0-1M SEK' },
        { min: 1000000, max: 10000000, label: '1-10M SEK' },
        { min: 10000000, max: 100000000, label: '10-100M SEK' },
        { min: 100000000, max: 1000000000, label: '100M-1B SEK' },
        { min: 1000000000, max: Infinity, label: '1B+ SEK' }
      ]

      const distribution = ranges.map(range => {
        const count = data?.filter(item => {
          const revenue = parseFloat(item.revenue || '0')
          return revenue >= range.min && revenue < range.max
        }).length || 0

        return {
          range: range.label,
          count
        }
      })

      return distribution
    } catch (error) {
      console.error('Error fetching revenue distribution:', error)
      return []
    }
  }
}
