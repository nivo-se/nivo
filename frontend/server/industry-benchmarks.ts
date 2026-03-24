/**
 * Industry benchmark context for AI analysis — Postgres via pg Pool.
 */

import type { Pool } from 'pg'
import { IndustryBenchmarks } from './data-quality.js'

export async function getIndustryBenchmarks(pool: Pool, segment: string): Promise<IndustryBenchmarks> {
  try {
    const { rows: data } = await pool.query(
      `SELECT m.avg_ebitda_margin, m.revenue_cagr_3y, m.latest_revenue_sek,
              c.employees_latest, c.segment_names
       FROM company_metrics m
       JOIN companies c ON c.orgnr = m.orgnr
       LIMIT 500`
    )

    const filtered = (data || []).filter((row) => {
      const segments = Array.isArray(row.segment_names)
        ? row.segment_names
        : row.segment_names
          ? [row.segment_names]
          : []
      return segments.includes(segment)
    })

    if (!filtered || filtered.length === 0) {
      return getDefaultBenchmarks()
    }

    const validData = filtered.filter(
      (d) =>
        d.avg_ebitda_margin !== null &&
        d.revenue_cagr_3y !== null &&
        d.latest_revenue_sek > 0 &&
        (d.employees_latest || 0) > 0
    )

    if (validData.length === 0) {
      return getDefaultBenchmarks()
    }

    return {
      avgEbitMargin:
        validData.reduce((sum, d) => sum + (d.avg_ebitda_margin * 100), 0) / validData.length,
      avgGrowthRate:
        validData.reduce((sum, d) => sum + (d.revenue_cagr_3y * 100), 0) / validData.length,
      avgDebtToEquity: 0.5,
      avgEmployeeProductivity:
        validData.reduce(
          (sum, d) => sum + d.latest_revenue_sek / (d.employees_latest || 1),
          0
        ) / validData.length,
      sampleSize: validData.length,
    }
  } catch (error) {
    console.error('Error calculating industry benchmarks:', error)
    return getDefaultBenchmarks()
  }
}

function getDefaultBenchmarks(): IndustryBenchmarks {
  return {
    avgEbitMargin: 8.0,
    avgGrowthRate: 5.0,
    avgDebtToEquity: 0.5,
    avgEmployeeProductivity: 1000,
    sampleSize: 0,
  }
}

export function getCompanyContext(companyData: any, benchmarks: IndustryBenchmarks): string {
  const ebitMargin = (companyData.avg_ebitda_margin || companyData.EBIT_margin || 0) * 100
  const growthRate = (companyData.revenue_cagr_3y || companyData.Revenue_growth || 0) * 100
  const debtToEquity = 0.5
  const employeeProductivity =
    (companyData.latest_revenue_sek || companyData.SDI || 0) / (companyData.employees || 1)

  const context: string[] = []

  if (ebitMargin > benchmarks.avgEbitMargin * 1.2) {
    context.push(
      `EBIT-marginal på ${ebitMargin.toFixed(1)}% är betydligt över branschsnittet (${benchmarks.avgEbitMargin.toFixed(1)}%)`
    )
  } else if (ebitMargin < benchmarks.avgEbitMargin * 0.8) {
    context.push(
      `EBIT-marginal på ${ebitMargin.toFixed(1)}% är under branschsnittet (${benchmarks.avgEbitMargin.toFixed(1)}%)`
    )
  } else {
    context.push(
      `EBIT-marginal på ${ebitMargin.toFixed(1)}% är i linje med branschsnittet (${benchmarks.avgEbitMargin.toFixed(1)}%)`
    )
  }

  if (growthRate > benchmarks.avgGrowthRate * 1.5) {
    context.push(
      `Tillväxt på ${growthRate.toFixed(1)}% är mycket stark jämfört med branschsnittet (${benchmarks.avgGrowthRate.toFixed(1)}%)`
    )
  } else if (growthRate < 0) {
    context.push(
      `Negativ tillväxt på ${growthRate.toFixed(1)}% kontra branschsnittet (${benchmarks.avgGrowthRate.toFixed(1)}%)`
    )
  }

  if (debtToEquity > benchmarks.avgDebtToEquity * 1.5) {
    context.push(
      `Hög skuldsättningsgrad (${debtToEquity.toFixed(2)}) jämfört med branschsnittet (${benchmarks.avgDebtToEquity.toFixed(2)})`
    )
  } else if (debtToEquity < benchmarks.avgDebtToEquity * 0.5) {
    context.push(
      `Låg skuldsättningsgrad (${debtToEquity.toFixed(2)}) jämfört med branschsnittet (${benchmarks.avgDebtToEquity.toFixed(2)})`
    )
  }

  if (employeeProductivity > benchmarks.avgEmployeeProductivity * 1.3) {
    context.push(
      `Hög produktivitet per anställd (${(employeeProductivity / 1000).toFixed(0)} TSEK) jämfört med branschsnittet (${(benchmarks.avgEmployeeProductivity / 1000).toFixed(0)} TSEK)`
    )
  }

  return context.join('. ') + '.'
}
