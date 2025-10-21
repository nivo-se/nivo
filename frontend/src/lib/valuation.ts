import { format } from 'date-fns'

export interface FinancialYearRecord {
  year: number
  revenue?: number | null
  ebit?: number | null
  ebitda?: number | null
  netIncome?: number | null
  equity?: number | null
  totalAssets?: number | null
  cash?: number | null
  shortTermDebt?: number | null
  longTermDebt?: number | null
  marketCap?: number | null
  totalDebt?: number | null
}

export interface ValuationMetrics {
  enterpriseValue: number | null
  marketCap: number | null
  netDebt: number | null
  evToEbit: number | null
  evToEbitda: number | null
  peRatio: number | null
  pbRatio: number | null
  psRatio: number | null
  equityRatio: number | null
  revenueCagr3Y: number | null
  revenueLatest: number | null
  ebitLatest: number | null
  ebitdaLatest: number | null
  netIncomeLatest: number | null
}

export interface ValuationComputationOptions {
  fallbackRevenueMultiple?: number
  fallbackEbitdaMultiple?: number
  fallbackPeMultiple?: number
  fallbackPsMultiple?: number
  yearsForCagr?: number
}

export interface NormalizedFinancialHistory {
  records: FinancialYearRecord[]
  latest?: FinancialYearRecord
}

export interface ValuationComputationResult {
  metrics: ValuationMetrics
  history: NormalizedFinancialHistory
}

const DEFAULT_OPTIONS: Required<ValuationComputationOptions> = {
  fallbackRevenueMultiple: 1.5,
  fallbackEbitdaMultiple: 6,
  fallbackPeMultiple: 12,
  fallbackPsMultiple: 1.2,
  yearsForCagr: 3,
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : value
  return isFiniteNumber(parsed) ? parsed : null
}

const safeDivide = (numerator: number | null, denominator: number | null): number | null => {
  if (!isFiniteNumber(numerator) || !isFiniteNumber(denominator) || denominator === 0) {
    return null
  }
  const result = numerator / denominator
  return Number.isFinite(result) ? result : null
}

const sumNumbers = (...values: Array<number | null | undefined>): number =>
  values.reduce((acc, value) => (isFiniteNumber(value) ? acc + Number(value) : acc), 0)

export function normalizeFinancialRecords(records: Array<Partial<FinancialYearRecord> & Record<string, any>>): NormalizedFinancialHistory {
  const normalized = records
    .map((record) => {
      const year = toNumberOrNull(record.year)
      if (!isFiniteNumber(year)) return null

      const revenue = toNumberOrNull(record.revenue ?? record.SDI)
      const ebit = toNumberOrNull(record.ebit ?? record.RG ?? record.EBIT)
      const ebitda = toNumberOrNull(
        record.ebitda ?? record.EBITDA ?? record.resultat_e_avskrivningar ?? record.ORS
      )
      const netIncome = toNumberOrNull(record.netIncome ?? record.DR ?? record.profit)
      const equity = toNumberOrNull(record.equity ?? record.EK ?? record.SFA ?? record.SEK)
      const totalAssets = toNumberOrNull(record.totalAssets ?? record.SV ?? record.SED)
      const cash = toNumberOrNull(record.cash ?? record.SEK)
      const shortTermDebt = toNumberOrNull(record.shortTermDebt ?? record.KB ?? record.shortTermLiabilities)
      const longTermDebt = toNumberOrNull(record.longTermDebt ?? record.LG ?? record.longTermLiabilities)
      const totalDebt = toNumberOrNull(
        record.totalDebt ?? record.totalLiabilities ?? sumNumbers(shortTermDebt, longTermDebt)
      )
      const marketCap = toNumberOrNull(record.marketCap ?? record.market_cap ?? record.marketCapitalization)

      return {
        year: Number(year),
        revenue,
        ebit,
        ebitda,
        netIncome,
        equity,
        totalAssets,
        cash,
        shortTermDebt,
        longTermDebt,
        totalDebt: isFiniteNumber(totalDebt) ? totalDebt : sumNumbers(shortTermDebt, longTermDebt),
        marketCap,
      } satisfies FinancialYearRecord
    })
    .filter((record): record is FinancialYearRecord => Boolean(record))
    .sort((a, b) => b.year - a.year)

  return {
    records: normalized,
    latest: normalized[0],
  }
}

function resolveEnterpriseValue(
  latest: FinancialYearRecord | undefined,
  history: FinancialYearRecord[],
  options: Required<ValuationComputationOptions>
): { enterpriseValue: number | null; marketCap: number | null; netDebt: number | null } {
  if (!latest) {
    return { enterpriseValue: null, marketCap: null, netDebt: null }
  }

  const cash = toNumberOrNull(latest.cash)
  const netDebt = toNumberOrNull(latest.totalDebt ?? sumNumbers(latest.shortTermDebt, latest.longTermDebt))
  const normalizedNetDebt = isFiniteNumber(netDebt) ? netDebt : null

  const normalizedCash = isFiniteNumber(cash) ? cash : 0
  const fallbackRevenueMultiple = options.fallbackRevenueMultiple
  const fallbackEbitdaMultiple = options.fallbackEbitdaMultiple
  const fallbackPeMultiple = options.fallbackPeMultiple
  const fallbackPsMultiple = options.fallbackPsMultiple

  const revenue = toNumberOrNull(latest.revenue)
  const ebitda = toNumberOrNull(latest.ebitda)
  const netIncome = toNumberOrNull(latest.netIncome)

  let marketCap = toNumberOrNull(latest.marketCap)

  if (!isFiniteNumber(marketCap)) {
    if (isFiniteNumber(netIncome) && netIncome > 0) {
      marketCap = netIncome * fallbackPeMultiple
    } else if (isFiniteNumber(ebitda) && ebitda > 0) {
      marketCap = ebitda * fallbackEbitdaMultiple
    } else if (isFiniteNumber(revenue) && revenue > 0) {
      marketCap = revenue * fallbackPsMultiple
    } else {
      // Try to use historical averages if current data is missing
      const avgRevenue = average(history.map((record) => record.revenue).filter(isFiniteNumber))
      marketCap = avgRevenue ? avgRevenue * fallbackRevenueMultiple : null
    }
  }

  const enterpriseValue = isFiniteNumber(marketCap)
    ? marketCap + (normalizedNetDebt ?? 0) - normalizedCash
    : null

  return {
    enterpriseValue,
    marketCap: isFiniteNumber(marketCap) ? marketCap : null,
    netDebt: normalizedNetDebt ?? (isFiniteNumber(marketCap) ? marketCap * 0.25 : null),
  }
}

const average = (values: number[]): number | null => {
  if (!values.length) return null
  const sum = values.reduce((acc, value) => acc + value, 0)
  const mean = sum / values.length
  return Number.isFinite(mean) ? mean : null
}

function calculateCagr(records: FinancialYearRecord[], years: number): number | null {
  if (records.length < 2) return null
  const sorted = [...records].sort((a, b) => b.year - a.year)
  const latest = sorted[0]
  const targetIndex = sorted.findIndex((record) => record.year <= latest.year - years)
  const oldest = targetIndex >= 0 ? sorted[targetIndex] : sorted[sorted.length - 1]

  if (!oldest || !isFiniteNumber(latest.revenue) || !isFiniteNumber(oldest.revenue) || oldest.revenue <= 0) {
    return null
  }

  const span = Math.max(1, latest.year - oldest.year)
  const ratio = latest.revenue / oldest.revenue
  const cagr = Math.pow(ratio, 1 / span) - 1
  return Number.isFinite(cagr) ? cagr : null
}

function pickEquityRatio(latest: FinancialYearRecord | undefined): number | null {
  if (!latest) return null
  const equity = toNumberOrNull(latest.equity)
  const totalAssets = toNumberOrNull(latest.totalAssets)
  if (!isFiniteNumber(equity) || !isFiniteNumber(totalAssets) || totalAssets === 0) {
    return null
  }
  const ratio = equity / totalAssets
  return Number.isFinite(ratio) ? ratio : null
}

export function computeValuationMetrics(
  records: Array<Partial<FinancialYearRecord> & Record<string, any>>,
  options?: ValuationComputationOptions
): ValuationComputationResult {
  const normalized = normalizeFinancialRecords(records)
  const config = { ...DEFAULT_OPTIONS, ...options }
  const { latest, records: history } = normalized

  const { enterpriseValue, marketCap, netDebt } = resolveEnterpriseValue(latest, history, config)

  const revenueLatest = toNumberOrNull(latest?.revenue)
  const ebitLatest = toNumberOrNull(latest?.ebit)
  const ebitdaLatest = toNumberOrNull(latest?.ebitda)
  const netIncomeLatest = toNumberOrNull(latest?.netIncome)
  const equityLatest = toNumberOrNull(latest?.equity)

  const metrics: ValuationMetrics = {
    enterpriseValue,
    marketCap,
    netDebt,
    evToEbit: safeDivide(enterpriseValue, ebitLatest),
    evToEbitda: safeDivide(enterpriseValue, ebitdaLatest),
    peRatio: safeDivide(marketCap, netIncomeLatest),
    pbRatio: safeDivide(marketCap, equityLatest),
    psRatio: safeDivide(marketCap, revenueLatest),
    equityRatio: pickEquityRatio(latest),
    revenueCagr3Y: calculateCagr(history, config.yearsForCagr),
    revenueLatest,
    ebitLatest,
    ebitdaLatest,
    netIncomeLatest,
  }

  return {
    metrics,
    history: normalized,
  }
}

export interface ValuationExportRow {
  orgnr: string
  company: string
  industry?: string | null
  year: number
  enterpriseValue?: number | null
  marketCap?: number | null
  netDebt?: number | null
  evToEbit?: number | null
  evToEbitda?: number | null
  peRatio?: number | null
  pbRatio?: number | null
  psRatio?: number | null
  equityRatio?: number | null
  revenue?: number | null
  ebit?: number | null
  ebitda?: number | null
  netIncome?: number | null
}

export interface ValuationDatasetForExport {
  rows: ValuationExportRow[]
  generatedAt: string
}

export function buildValuationExportDataset(
  companies: Array<{
    orgnr: string
    name: string
    industry?: string | null
    history: NormalizedFinancialHistory
    metrics: ValuationMetrics
  }>
): ValuationDatasetForExport {
  const rows: ValuationExportRow[] = []

  companies.forEach((company) => {
    const latestYear = company.history.latest?.year
    const baseRow: ValuationExportRow = {
      orgnr: company.orgnr,
      company: company.name,
      industry: company.industry ?? null,
      year: latestYear ?? new Date().getFullYear(),
      enterpriseValue: company.metrics.enterpriseValue,
      marketCap: company.metrics.marketCap,
      netDebt: company.metrics.netDebt,
      evToEbit: company.metrics.evToEbit,
      evToEbitda: company.metrics.evToEbitda,
      peRatio: company.metrics.peRatio,
      pbRatio: company.metrics.pbRatio,
      psRatio: company.metrics.psRatio,
      equityRatio: company.metrics.equityRatio,
      revenue: company.metrics.revenueLatest,
      ebit: company.metrics.ebitLatest,
      ebitda: company.metrics.ebitdaLatest,
      netIncome: company.metrics.netIncomeLatest,
    }
    rows.push(baseRow)
  })

  return {
    rows,
    generatedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm:ssxxx"),
  }
}

export function toCsv(dataset: ValuationDatasetForExport): string {
  const header = [
    'OrgNr',
    'Company',
    'Industry',
    'Year',
    'Enterprise Value',
    'Market Cap',
    'Net Debt',
    'EV/EBIT',
    'EV/EBITDA',
    'P/E',
    'P/B',
    'P/S',
    'Equity Ratio',
    'Revenue',
    'EBIT',
    'EBITDA',
    'Net Income',
  ]

  const lines = [header.join(',')]

  dataset.rows.forEach((row) => {
    const values = [
      row.orgnr,
      row.company,
      row.industry ?? '',
      row.year.toString(),
      formatNumber(row.enterpriseValue),
      formatNumber(row.marketCap),
      formatNumber(row.netDebt),
      formatNumber(row.evToEbit),
      formatNumber(row.evToEbitda),
      formatNumber(row.peRatio),
      formatNumber(row.pbRatio),
      formatNumber(row.psRatio),
      formatPercentage(row.equityRatio),
      formatNumber(row.revenue),
      formatNumber(row.ebit),
      formatNumber(row.ebitda),
      formatNumber(row.netIncome),
    ]
    lines.push(values.join(','))
  })

  return lines.join('\n')
}

const formatNumber = (value: number | null | undefined): string => {
  if (!isFiniteNumber(value)) return ''
  return Number(value).toFixed(2)
}

const formatPercentage = (value: number | null | undefined): string => {
  if (!isFiniteNumber(value)) return ''
  return (Number(value) * 100).toFixed(2)
}
