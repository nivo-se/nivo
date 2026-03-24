import { companyDataService, type CompanyRecord } from './companyDataService'

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
  revenue?: string
  profit?: string
  employees?: string
  SDI?: number
  DR?: number
  ORS?: number
  Revenue_growth?: number
  EBIT_margin?: number
  NetProfit_margin?: number
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
  averageCAGR4Y: number | null
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

export class AnalyticsService {
  static async getDashboardAnalytics(): Promise<DashboardAnalytics> {
    try {
      const a = await companyDataService.getDashboardAnalytics()
      return {
        totalCompanies: a.totalCompanies,
        totalWithFinancials: a.totalWithFinancials,
        totalWithKPIs: a.totalWithKPIs,
        totalWithDigitalPresence: a.totalWithDigitalPresence,
        averageRevenueGrowth: a.averageRevenueGrowth,
        averageEBITMargin: a.averageEBITMargin,
        averageNetProfitMargin: a.averageNetProfitMargin,
        averageNetProfitGrowth: a.averageNetProfitGrowth,
        averageRevenue: a.averageRevenue,
        averageCAGR4Y: null,
      }
    } catch (e) {
      console.error('Error fetching dashboard analytics:', e)
      return {
        totalCompanies: 0,
        totalWithFinancials: 0,
        totalWithKPIs: 0,
        totalWithDigitalPresence: 0,
        averageRevenueGrowth: 0,
        averageEBITMargin: 0,
        averageNetProfitMargin: 0,
        averageNetProfitGrowth: 0,
        averageRevenue: 0,
        averageCAGR4Y: null,
      }
    }
  }

  static async getCompanies(
    page = 1,
    limit = 50,
    filters?: CompanyFilter
  ): Promise<{ data: MasterAnalyticsCompany[]; total: number }> {
    try {
      const mappedFilters = {
        name: filters?.name,
        industry: filters?.segment,
        city: filters?.city,
        minRevenue: filters?.minRevenue,
        maxRevenue: filters?.maxRevenue,
        profitability: filters?.profitability,
        size: filters?.companySize,
        growth: filters?.growth,
      }
      const { companies, total } = await companyDataService.getCompanies(page, limit, mappedFilters)
      return {
        data: companies.map(this.mapCompanyRecord),
        total,
      }
    } catch (error) {
      console.error('Error fetching companies:', error)
      return { data: [], total: 0 }
    }
  }

  static async getHighGrowthCompanies(_limit = 20): Promise<MasterAnalyticsCompany[]> {
    return []
  }

  static async getHighProfitabilityCompanies(_limit = 20): Promise<MasterAnalyticsCompany[]> {
    return []
  }

  static async getCompaniesBySize(_size: string, _limit = 20): Promise<MasterAnalyticsCompany[]> {
    return []
  }

  static async getDigitalCompanies(_limit = 20): Promise<MasterAnalyticsCompany[]> {
    return []
  }

  static async getSegmentAnalysis(): Promise<
    { segment: string; count: number; avgGrowth: number; avgProfitability: number }[]
  > {
    return []
  }

  static async getGrowthDistribution(): Promise<{ category: string; count: number }[]> {
    return []
  }

  static async getProfitabilityDistribution(): Promise<{ category: string; count: number }[]> {
    return []
  }

  static async getUniqueSegments(): Promise<string[]> {
    return []
  }

  static async getUniqueCities(): Promise<string[]> {
    return []
  }

  static async getRevenueDistribution(): Promise<{ range: string; count: number }[]> {
    return []
  }

  static async getAnalyticsInsights(): Promise<AnalyticsInsight[]> {
    try {
      const analytics = await this.getDashboardAnalytics()
      const insights: AnalyticsInsight[] = []
      const digitalPercentage =
        analytics.totalCompanies > 0
          ? (analytics.totalWithDigitalPresence / analytics.totalCompanies) * 100
          : 0
      insights.push({
        id: 'digital-presence',
        title: 'Digital Presence',
        description: `${digitalPercentage.toFixed(1)}% of companies have digital presence`,
        metric: 'Percentage',
        value: digitalPercentage,
        trend: digitalPercentage > 50 ? 'up' : 'stable',
        category: 'digital',
      })
      return insights
    } catch (error) {
      console.error('Error fetching analytics insights:', error)
      return []
    }
  }

  private static mapCompanyRecord(company: CompanyRecord): MasterAnalyticsCompany {
    const segmentName = Array.isArray(company.segment_name)
      ? company.segment_name[0]
      : company.segment_name

    const city =
      typeof company.address === 'object'
        ? (company.address as { postPlace?: string }).postPlace ||
          (company.address as { visitorAddress?: { postPlace?: string } }).visitorAddress?.postPlace ||
          company.city
        : company.city

    return {
      OrgNr: company.OrgNr,
      name: company.name,
      address: typeof company.address === 'string' ? company.address : undefined,
      city: city || undefined,
      email: company.email,
      homepage: company.homepage,
      segment: segmentName || company.segment,
      segment_name: segmentName || company.segment_name,
      industry_name: company.industry_name,
      revenue: company.revenue,
      profit: company.profit,
      employees: company.employees,
      SDI: company.SDI,
      DR: company.DR,
      ORS: company.ORS,
      Revenue_growth: company.Revenue_growth,
      EBIT_margin: company.EBIT_margin,
      NetProfit_margin: company.NetProfit_margin,
      company_size_category: company.company_size_category,
      employee_size_category: company.employee_size_category,
      profitability_category: company.profitability_category,
      growth_category: company.growth_category,
      digital_presence: company.digital_presence,
    }
  }
}
