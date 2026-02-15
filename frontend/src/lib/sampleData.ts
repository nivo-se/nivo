import type { CompanyFilter, SupabaseCompany } from './supabaseDataService'

export interface LocalCompany extends SupabaseCompany {
  industryCategory: string
  industryCode: string
}

export interface LocalIndustrySummary {
  code: string
  name: string
  category: string
  companyCount: number
}

const createHistorical = (
  entries: Array<Pick<NonNullable<SupabaseCompany['historicalData']>[number], 'year' | 'Revenue_growth' | 'EBIT_margin' | 'NetProfit_margin'> & {
    SDI?: number | null
  }>
) => entries.map(entry => ({
  year: entry.year,
  Revenue_growth: entry.Revenue_growth ?? null,
  EBIT_margin: entry.EBIT_margin ?? null,
  NetProfit_margin: entry.NetProfit_margin ?? null,
  SDI: entry.SDI ?? null
}))

export const localCompanies: LocalCompany[] = [
  {
    OrgNr: '5590001111',
    name: 'Nordic Solar Solutions AB',
    address: 'Sveavägen 45',
    city: 'Stockholm',
    segment: 'renewable_energy',
    segment_name: 'Renewable Energy',
    industry_name: 'Clean Tech',
    revenue: 48200000,
    profit: 3200000,
    employees: 34,
    SDI: 0.76,
    DR: 0.61,
    ORS: 0.72,
    Revenue_growth: 0.18,
    EBIT_margin: 0.12,
    NetProfit_margin: 0.09,
    analysis_year: 2024,
    digital_maturity: 'High',
    company_size_category: 'Medium',
    employee_size_category: '20-49',
    profitability_category: 'Profitable',
    growth_category: 'High Growth',
    fit_score_reason: 'Strong energy transition traction with repeatable project backlog.',
    historicalData: createHistorical([
      { year: 2021, Revenue_growth: 0.12, EBIT_margin: 0.08, NetProfit_margin: 0.06, SDI: 0.58 },
      { year: 2022, Revenue_growth: 0.15, EBIT_margin: 0.1, NetProfit_margin: 0.07, SDI: 0.65 },
      { year: 2023, Revenue_growth: 0.17, EBIT_margin: 0.11, NetProfit_margin: 0.08, SDI: 0.7 }
    ]),
    industryCategory: 'Energy & Cleantech',
    industryCode: 'renewable_energy'
  },
  {
    OrgNr: '5590001112',
    name: 'Scandi Robotics Systems AB',
    address: 'Fabriksgatan 12',
    city: 'Göteborg',
    segment: 'advanced_manufacturing',
    segment_name: 'Advanced Manufacturing',
    industry_name: 'Industrial Automation',
    revenue: 38800000,
    profit: 4100000,
    employees: 42,
    SDI: 0.69,
    DR: 0.55,
    ORS: 0.74,
    Revenue_growth: 0.21,
    EBIT_margin: 0.15,
    NetProfit_margin: 0.11,
    analysis_year: 2024,
    digital_maturity: 'High',
    company_size_category: 'Medium',
    employee_size_category: '20-49',
    profitability_category: 'Profitable',
    growth_category: 'High Growth',
    fit_score_reason: 'Recurring robotics-as-a-service contracts and strong EBIT profile.',
    historicalData: createHistorical([
      { year: 2021, Revenue_growth: 0.09, EBIT_margin: 0.07, NetProfit_margin: 0.05 },
      { year: 2022, Revenue_growth: 0.14, EBIT_margin: 0.09, NetProfit_margin: 0.07 },
      { year: 2023, Revenue_growth: 0.18, EBIT_margin: 0.12, NetProfit_margin: 0.09 }
    ]),
    industryCategory: 'Industrial & Robotics',
    industryCode: 'advanced_manufacturing'
  },
  {
    OrgNr: '5590001113',
    name: 'Baltic BioTherapies AB',
    address: 'Scheelevägen 19',
    city: 'Lund',
    segment: 'biotech_health',
    segment_name: 'Biotech & Health',
    industry_name: 'Life Sciences',
    revenue: 25400000,
    profit: 2100000,
    employees: 27,
    SDI: 0.64,
    DR: 0.52,
    ORS: 0.66,
    Revenue_growth: 0.24,
    EBIT_margin: 0.16,
    NetProfit_margin: 0.1,
    analysis_year: 2024,
    digital_maturity: 'Medium',
    company_size_category: 'Medium',
    employee_size_category: '20-49',
    profitability_category: 'Profitable',
    growth_category: 'High Growth',
    fit_score_reason: 'Clinical pipeline with licensed IP and strong gross margins.',
    historicalData: createHistorical([
      { year: 2021, Revenue_growth: 0.11, EBIT_margin: 0.08, NetProfit_margin: 0.05 },
      { year: 2022, Revenue_growth: 0.17, EBIT_margin: 0.11, NetProfit_margin: 0.07 },
      { year: 2023, Revenue_growth: 0.2, EBIT_margin: 0.13, NetProfit_margin: 0.09 }
    ]),
    industryCategory: 'Health & Life Sciences',
    industryCode: 'biotech_health'
  },
  {
    OrgNr: '5590001114',
    name: 'UrbanFlow Mobility AB',
    address: 'Norra Vallgatan 28',
    city: 'Malmö',
    segment: 'smart_mobility',
    segment_name: 'Smart Mobility',
    industry_name: 'Transportation Tech',
    revenue: 31200000,
    profit: 2600000,
    employees: 31,
    SDI: 0.71,
    DR: 0.57,
    ORS: 0.7,
    Revenue_growth: 0.22,
    EBIT_margin: 0.14,
    NetProfit_margin: 0.1,
    analysis_year: 2024,
    digital_maturity: 'High',
    company_size_category: 'Medium',
    employee_size_category: '20-49',
    profitability_category: 'Profitable',
    growth_category: 'High Growth',
    fit_score_reason: 'Recurring SaaS revenue from municipal mobility analytics platform.',
    historicalData: createHistorical([
      { year: 2021, Revenue_growth: 0.1, EBIT_margin: 0.07, NetProfit_margin: 0.04 },
      { year: 2022, Revenue_growth: 0.16, EBIT_margin: 0.1, NetProfit_margin: 0.06 },
      { year: 2023, Revenue_growth: 0.19, EBIT_margin: 0.12, NetProfit_margin: 0.08 }
    ]),
    industryCategory: 'Mobility & Logistics',
    industryCode: 'smart_mobility'
  },
  {
    OrgNr: '5590001115',
    name: 'Polar Analytics Group AB',
    address: 'Ågatan 3',
    city: 'Uppsala',
    segment: 'data_analytics',
    segment_name: 'Data Analytics',
    industry_name: 'AI & Data Platforms',
    revenue: 19800000,
    profit: 1500000,
    employees: 22,
    SDI: 0.68,
    DR: 0.59,
    ORS: 0.67,
    Revenue_growth: 0.19,
    EBIT_margin: 0.11,
    NetProfit_margin: 0.08,
    analysis_year: 2024,
    digital_maturity: 'High',
    company_size_category: 'Small',
    employee_size_category: '10-19',
    profitability_category: 'Profitable',
    growth_category: 'Growth',
    fit_score_reason: 'Sticky analytics subscriptions with 90% net retention.',
    historicalData: createHistorical([
      { year: 2021, Revenue_growth: 0.08, EBIT_margin: 0.05, NetProfit_margin: 0.03 },
      { year: 2022, Revenue_growth: 0.13, EBIT_margin: 0.08, NetProfit_margin: 0.05 },
      { year: 2023, Revenue_growth: 0.16, EBIT_margin: 0.09, NetProfit_margin: 0.06 }
    ]),
    industryCategory: 'Software & Data',
    industryCode: 'data_analytics'
  },
  {
    OrgNr: '5590001116',
    name: 'Aurora Digital Commerce AB',
    address: 'Kungsgatan 14',
    city: 'Stockholm',
    segment: 'digital_commerce',
    segment_name: 'Digital Commerce',
    industry_name: 'E-commerce Enablement',
    revenue: 27600000,
    profit: 2300000,
    employees: 25,
    SDI: 0.72,
    DR: 0.6,
    ORS: 0.69,
    Revenue_growth: 0.23,
    EBIT_margin: 0.13,
    NetProfit_margin: 0.09,
    analysis_year: 2024,
    digital_maturity: 'High',
    company_size_category: 'Medium',
    employee_size_category: '20-49',
    profitability_category: 'Profitable',
    growth_category: 'High Growth',
    fit_score_reason: 'Marketplace integrations powering omni-channel retailers.',
    historicalData: createHistorical([
      { year: 2021, Revenue_growth: 0.09, EBIT_margin: 0.06, NetProfit_margin: 0.04 },
      { year: 2022, Revenue_growth: 0.14, EBIT_margin: 0.09, NetProfit_margin: 0.06 },
      { year: 2023, Revenue_growth: 0.18, EBIT_margin: 0.11, NetProfit_margin: 0.07 }
    ]),
    industryCategory: 'Software & Data',
    industryCode: 'digital_commerce'
  },
  {
    OrgNr: '5590001117',
    name: 'GreenCycle Materials AB',
    address: 'Industrigatan 7',
    city: 'Västerås',
    segment: 'circular_manufacturing',
    segment_name: 'Circular Manufacturing',
    industry_name: 'Sustainable Materials',
    revenue: 35800000,
    profit: 2800000,
    employees: 37,
    SDI: 0.7,
    DR: 0.58,
    ORS: 0.71,
    Revenue_growth: 0.2,
    EBIT_margin: 0.12,
    NetProfit_margin: 0.09,
    analysis_year: 2024,
    digital_maturity: 'Medium',
    company_size_category: 'Medium',
    employee_size_category: '20-49',
    profitability_category: 'Profitable',
    growth_category: 'Growth',
    fit_score_reason: 'Closed-loop recycling with long-term OEM supply contracts.',
    historicalData: createHistorical([
      { year: 2021, Revenue_growth: 0.1, EBIT_margin: 0.07, NetProfit_margin: 0.05 },
      { year: 2022, Revenue_growth: 0.15, EBIT_margin: 0.09, NetProfit_margin: 0.07 },
      { year: 2023, Revenue_growth: 0.17, EBIT_margin: 0.1, NetProfit_margin: 0.08 }
    ]),
    industryCategory: 'Energy & Cleantech',
    industryCode: 'circular_manufacturing'
  },
  {
    OrgNr: '5590001118',
    name: 'BlueWave Marine Technologies AB',
    address: 'Dockgatan 4',
    city: 'Göteborg',
    segment: 'maritime_technology',
    segment_name: 'Maritime Technology',
    industry_name: 'Marine Engineering',
    revenue: 29800000,
    profit: 2400000,
    employees: 29,
    SDI: 0.62,
    DR: 0.5,
    ORS: 0.65,
    Revenue_growth: 0.17,
    EBIT_margin: 0.11,
    NetProfit_margin: 0.08,
    analysis_year: 2024,
    digital_maturity: 'Medium',
    company_size_category: 'Medium',
    employee_size_category: '20-49',
    profitability_category: 'Profitable',
    growth_category: 'Growth',
    fit_score_reason: 'Hybrid propulsion retrofits with EU grant co-financing.',
    historicalData: createHistorical([
      { year: 2021, Revenue_growth: 0.07, EBIT_margin: 0.05, NetProfit_margin: 0.03 },
      { year: 2022, Revenue_growth: 0.12, EBIT_margin: 0.08, NetProfit_margin: 0.05 },
      { year: 2023, Revenue_growth: 0.15, EBIT_margin: 0.09, NetProfit_margin: 0.06 }
    ]),
    industryCategory: 'Mobility & Logistics',
    industryCode: 'maritime_technology'
  },
  {
    OrgNr: '5590001119',
    name: 'FutureFoods Lab AB',
    address: 'Forskargatan 8',
    city: 'Linköping',
    segment: 'foodtech_innovation',
    segment_name: 'FoodTech Innovation',
    industry_name: 'Alternative Proteins',
    revenue: 21400000,
    profit: 1600000,
    employees: 24,
    SDI: 0.66,
    DR: 0.54,
    ORS: 0.62,
    Revenue_growth: 0.19,
    EBIT_margin: 0.1,
    NetProfit_margin: 0.07,
    analysis_year: 2024,
    digital_maturity: 'Medium',
    company_size_category: 'Medium',
    employee_size_category: '20-49',
    profitability_category: 'Profitable',
    growth_category: 'Growth',
    fit_score_reason: 'Retail roll-out of plant-based protein SKUs across Nordics.',
    historicalData: createHistorical([
      { year: 2021, Revenue_growth: 0.09, EBIT_margin: 0.06, NetProfit_margin: 0.04 },
      { year: 2022, Revenue_growth: 0.14, EBIT_margin: 0.08, NetProfit_margin: 0.05 },
      { year: 2023, Revenue_growth: 0.16, EBIT_margin: 0.09, NetProfit_margin: 0.06 }
    ]),
    industryCategory: 'Health & Life Sciences',
    industryCode: 'foodtech_innovation'
  },
  {
    OrgNr: '5590001120',
    name: 'Arctic MedTech AB',
    address: 'Röntgengatan 12',
    city: 'Umeå',
    segment: 'medical_devices',
    segment_name: 'Medical Devices',
    industry_name: 'MedTech',
    revenue: 23600000,
    profit: 1800000,
    employees: 26,
    SDI: 0.63,
    DR: 0.51,
    ORS: 0.64,
    Revenue_growth: 0.18,
    EBIT_margin: 0.12,
    NetProfit_margin: 0.08,
    analysis_year: 2024,
    digital_maturity: 'Medium',
    company_size_category: 'Medium',
    employee_size_category: '20-49',
    profitability_category: 'Profitable',
    growth_category: 'Growth',
    fit_score_reason: 'Regulatory approvals secured with strong hospital partnerships.',
    historicalData: createHistorical([
      { year: 2021, Revenue_growth: 0.08, EBIT_margin: 0.06, NetProfit_margin: 0.04 },
      { year: 2022, Revenue_growth: 0.13, EBIT_margin: 0.08, NetProfit_margin: 0.05 },
      { year: 2023, Revenue_growth: 0.15, EBIT_margin: 0.09, NetProfit_margin: 0.06 }
    ]),
    industryCategory: 'Health & Life Sciences',
    industryCode: 'medical_devices'
  },
  {
    OrgNr: '5590001121',
    name: 'Skyline Proptech AB',
    address: 'Hantverkargatan 21',
    city: 'Stockholm',
    segment: 'proptech_platforms',
    segment_name: 'PropTech Platforms',
    industry_name: 'Real Estate Technology',
    revenue: 20500000,
    profit: 1500000,
    employees: 23,
    SDI: 0.67,
    DR: 0.56,
    ORS: 0.63,
    Revenue_growth: 0.2,
    EBIT_margin: 0.11,
    NetProfit_margin: 0.07,
    analysis_year: 2024,
    digital_maturity: 'High',
    company_size_category: 'Small',
    employee_size_category: '20-49',
    profitability_category: 'Profitable',
    growth_category: 'Growth',
    fit_score_reason: 'High-margin SaaS with predictive maintenance analytics.',
    historicalData: createHistorical([
      { year: 2021, Revenue_growth: 0.09, EBIT_margin: 0.06, NetProfit_margin: 0.04 },
      { year: 2022, Revenue_growth: 0.14, EBIT_margin: 0.08, NetProfit_margin: 0.05 },
      { year: 2023, Revenue_growth: 0.17, EBIT_margin: 0.1, NetProfit_margin: 0.06 }
    ]),
    industryCategory: 'Software & Data',
    industryCode: 'proptech_platforms'
  },
  {
    OrgNr: '5590001122',
    name: 'EcoCharge Infrastructure AB',
    address: 'Stationsgatan 6',
    city: 'Örebro',
    segment: 'ev_infrastructure',
    segment_name: 'EV Infrastructure',
    industry_name: 'Energy Distribution',
    revenue: 34200000,
    profit: 2600000,
    employees: 33,
    SDI: 0.74,
    DR: 0.6,
    ORS: 0.73,
    Revenue_growth: 0.25,
    EBIT_margin: 0.13,
    NetProfit_margin: 0.09,
    analysis_year: 2024,
    digital_maturity: 'High',
    company_size_category: 'Medium',
    employee_size_category: '20-49',
    profitability_category: 'Profitable',
    growth_category: 'High Growth',
    fit_score_reason: 'National charging network with subscription energy services.',
    historicalData: createHistorical([
      { year: 2021, Revenue_growth: 0.12, EBIT_margin: 0.08, NetProfit_margin: 0.05 },
      { year: 2022, Revenue_growth: 0.18, EBIT_margin: 0.1, NetProfit_margin: 0.07 },
      { year: 2023, Revenue_growth: 0.21, EBIT_margin: 0.12, NetProfit_margin: 0.08 }
    ]),
    industryCategory: 'Energy & Cleantech',
    industryCode: 'ev_infrastructure'
  }
]

export const filterLocalCompanies = (filters: CompanyFilter = {}): LocalCompany[] => {
  const normalizedIndustries = filters.industries?.map(code => code.toLowerCase())

  return localCompanies.filter(company => {
    if (filters.name) {
      const search = filters.name.toLowerCase()
      const matchesName = company.name.toLowerCase().includes(search)
      const matchesSegment = company.segment_name?.toLowerCase().includes(search)
      if (!matchesName && !matchesSegment) {
        return false
      }
    }

    if (normalizedIndustries && normalizedIndustries.length > 0) {
      const companyIndustry = (company.segment || '').toLowerCase()
      if (!normalizedIndustries.includes(companyIndustry)) {
        return false
      }
    }

    if (filters.city) {
      const searchCity = filters.city.toLowerCase()
      if (!company.city || !company.city.toLowerCase().includes(searchCity)) {
        return false
      }
    }

    if (typeof filters.minRevenue === 'number' && (company.revenue ?? 0) < filters.minRevenue) {
      return false
    }

    if (typeof filters.maxRevenue === 'number' && (company.revenue ?? 0) > filters.maxRevenue) {
      return false
    }

    if (typeof filters.minProfit === 'number' && (company.profit ?? 0) < filters.minProfit) {
      return false
    }

    if (typeof filters.maxProfit === 'number' && (company.profit ?? 0) > filters.maxProfit) {
      return false
    }

    if (
      typeof filters.minRevenueGrowth === 'number' &&
      (company.Revenue_growth ?? -Infinity) < filters.minRevenueGrowth / 100
    ) {
      return false
    }

    if (
      typeof filters.maxRevenueGrowth === 'number' &&
      (company.Revenue_growth ?? Infinity) > filters.maxRevenueGrowth / 100
    ) {
      return false
    }

    if (typeof filters.minEmployees === 'number' && (company.employees ?? 0) < filters.minEmployees) {
      return false
    }

    if (typeof filters.maxEmployees === 'number' && (company.employees ?? 0) > filters.maxEmployees) {
      return false
    }

    return true
  })
}

export const getLocalCompanyByOrgNr = (orgNr: string): SupabaseCompany | null => {
  const match = localCompanies.find(company => company.OrgNr === orgNr || company.OrgNr === orgNr?.replace(/\D/g, ''))
  return match ?? null
}

export const getLocalIndustrySummaries = (): LocalIndustrySummary[] => {
  const industryMap = new Map<string, LocalIndustrySummary>()

  localCompanies.forEach(company => {
    const code = company.industryCode || company.segment || company.segment_name || company.name
    const normalizedCode = code.toLowerCase()
    const category = company.industryCategory || 'Industries'
    const name = company.segment_name || company.industry_name || company.segment || company.name

    if (!industryMap.has(normalizedCode)) {
      industryMap.set(normalizedCode, {
        code: normalizedCode,
        name,
        category,
        companyCount: 0
      })
    }

    const entry = industryMap.get(normalizedCode)
    if (entry) {
      entry.companyCount += 1
    }
  })

  return Array.from(industryMap.values()).sort((a, b) => b.companyCount - a.companyCount)
}
