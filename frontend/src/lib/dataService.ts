import { companyDataService } from './companyDataService'

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
  static async getDashboardStats(): Promise<DashboardStats> {
    try {
      const a = await companyDataService.getDashboardAnalytics()
      return {
        totalCompanies: a.totalCompanies,
        totalFinancialRecords: a.totalWithFinancials,
        activeSegments: 0,
        aiInsights: 0,
      }
    } catch {
      return {
        totalCompanies: 0,
        totalFinancialRecords: 0,
        activeSegments: 0,
        aiInsights: 0,
      }
    }
  }

  static async getCompanies(
    page = 1,
    limit = 50,
    filters?: {
      segment?: string
      minRevenue?: number
      maxRevenue?: number
      city?: string
    }
  ): Promise<{ data: Company[]; total: number }> {
    const { companies, total } = await companyDataService.getCompanies(page, limit, {
      industry: filters?.segment,
      minRevenue: filters?.minRevenue,
      maxRevenue: filters?.maxRevenue,
      city: filters?.city,
    })
    return {
      data: companies.map((c) => ({
        OrgNr: c.OrgNr,
        name: c.name,
        address: c.address,
        city: c.city,
        incorporation_date: c.incorporation_date,
        revenue: typeof c.SDI === 'number' ? c.SDI : undefined,
        profit: typeof c.DR === 'number' ? c.DR : undefined,
        email: c.email,
        homepage: c.homepage,
        employees: c.employees ? Number(c.employees) : undefined,
        segment: c.segment,
        segment_name: c.segment_name,
      })),
      total,
    }
  }

  static async getCompanyKPIs(_orgNr?: string): Promise<CompanyKPI[]> {
    return []
  }

  static getSegmentationOptions(): SegmentationOption[] {
    return [
      {
        id: 'all_companies_raw',
        name: 'All Companies (Raw)',
        description: 'Complete dataset of all Swedish companies',
        tableName: 'all_companies_raw',
      },
      {
        id: 'filtered_companies',
        name: 'Filtered Companies',
        description: 'Companies that meet basic filtering criteria',
        tableName: 'filtered_companies_basic_filters_20250618_104425',
      },
      {
        id: 'high_potential',
        name: 'High Potential Candidates',
        description: 'Companies identified as high-potential targets',
        tableName: 'high_potential_candidates',
      },
      {
        id: 'ecommerce',
        name: 'E-commerce Companies',
        description: 'Companies in e-commerce and digital product sectors',
        tableName: 'digitizable_ecommerce_and_product_companies',
      },
      {
        id: 'segmented',
        name: 'Segmented Companies',
        description: 'Companies with enhanced segmentation analysis',
        tableName: 'enhanced_segmentation',
      },
      {
        id: 'ai_analyzed',
        name: 'AI Analyzed Companies',
        description: 'Companies with AI-powered analysis and insights',
        tableName: 'ai_company_analysis',
      },
    ]
  }

  static async getDataBySegmentation(
    _segmentationId: string,
    page = 1,
    limit = 50
  ): Promise<{ data: unknown[]; total: number }> {
    const { companies, total } = await companyDataService.getCompanies(page, limit, {})
    return { data: companies, total }
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
}
