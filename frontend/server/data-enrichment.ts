/**
 * Data enrichment for AI analysis — uses Postgres via pg Pool.
 */

import type { Pool } from 'pg'
import {
  DataLoadResult,
  QualityIssue,
  ComprehensiveCompanyData,
  createQualityIssue,
  calculateFinancialTrends,
} from './data-quality.js'
import { getIndustryBenchmarks } from './industry-benchmarks.js'

export async function fetchComprehensiveCompanyData(
  pool: Pool,
  orgnr: string
): Promise<DataLoadResult<ComprehensiveCompanyData>> {
  const issues: QualityIssue[] = []

  try {
    const probe = await pool.query('SELECT orgnr FROM companies LIMIT 1')
    if (!probe.rows?.length) {
      issues.push(createQualityIssue('critical', 'Cannot access companies table', {}))
      return { data: null, issues, success: false }
    }

    const masterResult = await fetchCompanySnapshot(pool, orgnr)
    issues.push(...masterResult.issues)

    if (!masterResult.data) {
      issues.push(createQualityIssue('critical', 'No master analytics data found', { orgnr }))
      return { data: null, issues, success: false }
    }

    const historicalResult = await fetchHistoricalAccounts(pool, orgnr)
    const kpiResult = await fetchDetailedKPIs(pool, orgnr)

    if (historicalResult.issues.length > 0) {
      issues.push(
        ...historicalResult.issues.map((issue) => ({
          ...issue,
          level: 'warning' as const,
        }))
      )
    }

    if (kpiResult.issues.length > 0) {
      issues.push(
        ...kpiResult.issues.map((issue) => ({
          ...issue,
          level: 'warning' as const,
        }))
      )
    }

    const trends = calculateFinancialTrends(historicalResult.data || [])
    const benchmarks = await getIndustryBenchmarks(pool, masterResult.data.segment_name)

    const comprehensiveData: ComprehensiveCompanyData = {
      masterData: masterResult.data,
      historicalData: historicalResult.data || [],
      kpiData: kpiResult.data || [],
      trends,
      benchmarks,
    }

    return { data: comprehensiveData, issues, success: true }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    issues.push(createQualityIssue('critical', `Data enrichment failed: ${msg}`, { orgnr, error: msg }))
    return { data: null, issues, success: false }
  }
}

async function fetchCompanySnapshot(pool: Pool, orgnr: string): Promise<DataLoadResult<any>> {
  const issues: QualityIssue[] = []

  try {
    const { rows } = await pool.query(
      `SELECT c.orgnr, c.company_id, c.company_name, c.address, c.homepage, c.email,
              c.segment_names, c.foundation_year, c.employees_latest,
              m.latest_revenue_sek, m.latest_profit_sek, m.latest_ebitda_sek, m.revenue_cagr_3y,
              m.avg_ebitda_margin, m.avg_net_margin, m.company_size_bucket, m.profitability_bucket,
              m.growth_bucket, m.digital_presence
       FROM companies c
       LEFT JOIN company_metrics m ON m.orgnr = c.orgnr
       WHERE c.orgnr = $1
       LIMIT 1`,
      [orgnr]
    )

    const data = rows[0]
    if (!data) {
      issues.push(createQualityIssue('critical', 'No company data found', { orgnr }))
      return { data: null, issues, success: false }
    }

    const missingFields: string[] = []
    if (!data.latest_revenue_sek) missingFields.push('latest_revenue_sek (revenue)')
    if (!data.latest_profit_sek) missingFields.push('latest_profit_sek (net profit)')
    if (!data.avg_ebitda_margin) missingFields.push('avg_ebitda_margin')

    if (missingFields.length > 0) {
      issues.push(
        createQualityIssue('warning', `Missing key financial fields: ${missingFields.join(', ')}`, {
          orgnr,
          missingFields,
        })
      )
    }

    const mapped = {
      OrgNr: data.orgnr,
      company_id: data.company_id,
      name: data.company_name,
      address: data.address,
      homepage: data.homepage,
      email: data.email,
      segment_name: Array.isArray(data.segment_names) ? data.segment_names[0] : data.segment_names,
      foundation_year: data.foundation_year,
      employees: data.employees_latest,
      SDI: data.latest_revenue_sek,
      DR: data.latest_profit_sek,
      ORS: data.latest_ebitda_sek,
      Revenue_growth: data.revenue_cagr_3y,
      EBIT_margin: data.avg_ebitda_margin,
      NetProfit_margin: data.avg_net_margin,
      company_size_category: data.company_size_bucket,
      profitability_category: data.profitability_bucket,
      growth_category: data.growth_bucket,
      digital_presence: data.digital_presence,
    }

    return { data: mapped, issues, success: true }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    issues.push(
      createQualityIssue('critical', `Company snapshot fetch error: ${msg}`, { orgnr, error: msg })
    )
    return { data: null, issues, success: false }
  }
}

async function fetchHistoricalAccounts(pool: Pool, orgnr: string): Promise<DataLoadResult<any[]>> {
  const issues: QualityIssue[] = []

  try {
    const { rows: data } = await pool.query(
      `SELECT year, revenue_sek, profit_sek, ebitda_sek, employees
       FROM company_financials
       WHERE orgnr = $1
       ORDER BY year DESC
       LIMIT 4`,
      [orgnr]
    )

    if (!data || data.length === 0) {
      issues.push(createQualityIssue('warning', 'No historical accounts data found', { orgnr }))
      return { data: [], issues, success: false }
    }

    const validYears = data.filter((d) => d.year && (d.revenue_sek || 0) > 0)
    if (validYears.length < 2) {
      issues.push(
        createQualityIssue(
          'warning',
          `Limited valid historical data: ${validYears.length} years`,
          { orgnr, totalYears: data.length, validYears: validYears.length }
        )
      )
    }

    return { data: validYears, issues, success: true }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    issues.push(
      createQualityIssue('warning', `Historical accounts fetch error: ${msg}`, { orgnr, error: msg })
    )
    return { data: [], issues, success: false }
  }
}

async function fetchDetailedKPIs(pool: Pool, orgnr: string): Promise<DataLoadResult<any[]>> {
  const issues: QualityIssue[] = []

  try {
    const { rows } = await pool.query(
      `SELECT revenue_cagr_3y, avg_ebitda_margin, avg_net_margin, equity_ratio_latest, debt_to_equity_latest
       FROM company_metrics
       WHERE orgnr = $1
       LIMIT 1`,
      [orgnr]
    )

    const data = rows[0]
    return { data: data ? [data] : [], issues, success: true }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    issues.push(createQualityIssue('info', `KPI data fetch error: ${msg}`, { orgnr, error: msg }))
    return { data: [], issues, success: false }
  }
}
