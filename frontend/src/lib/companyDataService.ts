/**
 * Company list / dashboard analytics via local API (localDataService → FastAPI / proxy).
 */

import { localDataService, type LocalCompany } from './localDataService'
import type { CompanyRecord, CompanyFilter, SearchResults, DashboardAnalytics } from './companyTypes'

function mapLocal(c: LocalCompany): CompanyRecord {
  return {
    OrgNr: c.OrgNr,
    name: c.name,
    address: c.address,
    city: c.city,
    incorporation_date: c.incorporation_date,
    email: c.email,
    homepage: c.homepage,
    segment: c.segment,
    segment_name: c.segment_name ?? c.industry_name,
    industry_name: c.industry_name,
    revenue: c.revenue,
    profit: c.profit,
    employees: c.employees,
    SDI: c.SDI,
    DR: c.DR,
    ORS: c.ORS,
    Revenue_growth: c.Revenue_growth,
    EBIT_margin: c.EBIT_margin,
    NetProfit_margin: c.NetProfit_margin,
    company_size_category: c.company_size_category,
    employee_size_category: c.employee_size_category,
    profitability_category: c.profitability_category,
    growth_category: c.growth_category,
    digital_presence: c.digital_presence,
  }
}

class CompanyDataService {
  async getCompanies(page = 1, limit = 20, filters: CompanyFilter = {}): Promise<SearchResults> {
    const r = await localDataService.getCompanies(page, limit, filters)
    return {
      companies: r.companies.map(mapLocal),
      total: r.total,
      summary: r.summary,
    }
  }

  async getCompany(orgNr: string): Promise<CompanyRecord | null> {
    const c = await localDataService.getCompany(orgNr)
    return c ? mapLocal(c) : null
  }

  async getDashboardAnalytics(): Promise<DashboardAnalytics> {
    const a = await localDataService.getDashboardAnalytics()
    return {
      totalCompanies: a.totalCompanies ?? 0,
      totalWithFinancials: a.totalWithFinancials ?? 0,
      totalWithKPIs: a.totalWithKPIs ?? 0,
      totalWithDigitalPresence: a.totalWithDigitalPresence ?? 0,
      averageRevenueGrowth: a.averageRevenueGrowth ?? 0,
      averageEBITMargin: a.averageEBITMargin ?? 0,
      averageNetProfitMargin: (a as { averageNetProfitMargin?: number }).averageNetProfitMargin ?? 0,
      averageNetProfitGrowth: (a as { averageNetProfitGrowth?: number }).averageNetProfitGrowth ?? 0,
      averageRevenue: (a as { averageRevenue?: number }).averageRevenue ?? 0,
    }
  }

  async searchCompanies(query: string, limit = 20): Promise<CompanyRecord[]> {
    const rows = await localDataService.searchCompanies(query, limit)
    return rows.map(mapLocal)
  }

  async getIndustryStats() {
    return localDataService.getIndustryStats()
  }

  async getCityStats() {
    return localDataService.getCityStats()
  }

  async getCompaniesByOrgNrs(orgNrs: string[], _includeHistorical = false): Promise<CompanyRecord[]> {
    if (orgNrs.length === 0) return []
    const rows = await Promise.all(orgNrs.map((o) => localDataService.getCompany(o)))
    return rows.filter((c): c is LocalCompany => c != null).map(mapLocal)
  }

  async getAllMatchingCompanyOrgNrs(filters: CompanyFilter = {}): Promise<string[]> {
    const r = await localDataService.getCompanies(1, 10000, filters)
    return r.companies.map((c) => c.OrgNr)
  }
}

export const companyDataService = new CompanyDataService()

export type { CompanyRecord, CompanyFilter, SearchResults, DashboardAnalytics }
