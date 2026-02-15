/**
 * Industry Benchmark Context Service
 * Provides industry-specific benchmarks for AI analysis context
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { IndustryBenchmarks } from './data-quality.js'

/**
 * Get industry benchmarks for a specific segment
 */
export async function getIndustryBenchmarks(
  supabase: SupabaseClient,
  segment: string
): Promise<IndustryBenchmarks> {
  try {
    const { data, error } = await supabase
      .from('company_metrics')
      .select('avg_ebitda_margin, revenue_cagr_3y, latest_revenue_sek, companies (employees_latest, segment_names)')
      .limit(500)

    if (error) {
      console.warn(`Failed to fetch benchmarks for segment ${segment}:`, error)
      return getDefaultBenchmarks()
    }

    const filtered = (data || []).filter(row => {
      const segments = Array.isArray(row.companies?.segment_names)
        ? row.companies?.segment_names
        : (row.companies?.segment_names ? [row.companies.segment_names] : [])
      return segments.includes(segment)
    })

    if (!filtered || filtered.length === 0) {
      console.warn(`No data found for segment ${segment}`)
      return getDefaultBenchmarks()
    }

    // Filter out invalid data
    const validData = filtered.filter(d =>
      d.avg_ebitda_margin !== null &&
      d.revenue_cagr_3y !== null &&
      d.latest_revenue_sek > 0 &&
      (d.companies?.employees_latest || 0) > 0
    )

    if (validData.length === 0) {
      return getDefaultBenchmarks()
    }

    return {
      avgEbitMargin: validData.reduce((sum, d) => sum + (d.avg_ebitda_margin * 100), 0) / validData.length,
      avgGrowthRate: validData.reduce((sum, d) => sum + (d.revenue_cagr_3y * 100), 0) / validData.length,
      avgDebtToEquity: 0.5, // Default assumption since column doesn't exist
      avgEmployeeProductivity: validData.reduce((sum, d) => sum + (d.latest_revenue_sek / (d.companies?.employees_latest || 1)), 0) / validData.length,
      sampleSize: validData.length
    }
    
  } catch (error) {
    console.error('Error calculating industry benchmarks:', error)
    return getDefaultBenchmarks()
  }
}

/**
 * Get default benchmarks when no industry data is available
 */
function getDefaultBenchmarks(): IndustryBenchmarks {
  return {
    avgEbitMargin: 8.0,
    avgGrowthRate: 5.0,
    avgDebtToEquity: 0.5,
    avgEmployeeProductivity: 1000,
    sampleSize: 0
  }
}

/**
 * Get company-specific context relative to industry
 */
export function getCompanyContext(
  companyData: any,
  benchmarks: IndustryBenchmarks
): string {
  const ebitMargin = (companyData.avg_ebitda_margin || companyData.EBIT_margin || 0) * 100
  const growthRate = (companyData.revenue_cagr_3y || companyData.Revenue_growth || 0) * 100
  const debtToEquity = 0.5 // Default assumption since column doesn't exist
  const employeeProductivity = (companyData.latest_revenue_sek || companyData.SDI || 0) / (companyData.employees || 1)
  
  const context = []
  
  // EBIT margin comparison
  if (ebitMargin > benchmarks.avgEbitMargin * 1.2) {
    context.push(`EBIT-marginal på ${ebitMargin.toFixed(1)}% är betydligt över branschsnittet (${benchmarks.avgEbitMargin.toFixed(1)}%)`)
  } else if (ebitMargin < benchmarks.avgEbitMargin * 0.8) {
    context.push(`EBIT-marginal på ${ebitMargin.toFixed(1)}% är under branschsnittet (${benchmarks.avgEbitMargin.toFixed(1)}%)`)
  } else {
    context.push(`EBIT-marginal på ${ebitMargin.toFixed(1)}% är i linje med branschsnittet (${benchmarks.avgEbitMargin.toFixed(1)}%)`)
  }
  
  // Growth rate comparison
  if (growthRate > benchmarks.avgGrowthRate * 1.5) {
    context.push(`Tillväxt på ${growthRate.toFixed(1)}% är mycket stark jämfört med branschsnittet (${benchmarks.avgGrowthRate.toFixed(1)}%)`)
  } else if (growthRate < 0) {
    context.push(`Negativ tillväxt på ${growthRate.toFixed(1)}% kontra branschsnittet (${benchmarks.avgGrowthRate.toFixed(1)}%)`)
  }
  
  // Debt comparison
  if (debtToEquity > benchmarks.avgDebtToEquity * 1.5) {
    context.push(`Hög skuldsättningsgrad (${debtToEquity.toFixed(2)}) jämfört med branschsnittet (${benchmarks.avgDebtToEquity.toFixed(2)})`)
  } else if (debtToEquity < benchmarks.avgDebtToEquity * 0.5) {
    context.push(`Låg skuldsättningsgrad (${debtToEquity.toFixed(2)}) jämfört med branschsnittet (${benchmarks.avgDebtToEquity.toFixed(2)})`)
  }
  
  // Employee productivity
  if (employeeProductivity > benchmarks.avgEmployeeProductivity * 1.3) {
    context.push(`Hög produktivitet per anställd (${(employeeProductivity/1000).toFixed(0)} TSEK) jämfört med branschsnittet (${(benchmarks.avgEmployeeProductivity/1000).toFixed(0)} TSEK)`)
  }
  
  return context.join('. ') + '.'
}
