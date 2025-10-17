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
      .from('master_analytics')
      .select('EBIT_margin, Revenue_growth, debt_to_equity, SDI, employees, segment_name')
      .eq('segment_name', segment)
      .not('EBIT_margin', 'is', null)
      .not('Revenue_growth', 'is', null)
      .limit(100) // Sample size for benchmarking
    
    if (error) {
      console.warn(`Failed to fetch benchmarks for segment ${segment}:`, error)
      return getDefaultBenchmarks()
    }
    
    if (!data || data.length === 0) {
      console.warn(`No data found for segment ${segment}`)
      return getDefaultBenchmarks()
    }
    
    // Filter out invalid data
    const validData = data.filter(d => 
      d.EBIT_margin !== null && 
      d.Revenue_growth !== null && 
      d.SDI > 0 && 
      d.employees > 0
    )
    
    if (validData.length === 0) {
      return getDefaultBenchmarks()
    }
    
    return {
      avgEbitMargin: validData.reduce((sum, d) => sum + (d.EBIT_margin * 100), 0) / validData.length,
      avgGrowthRate: validData.reduce((sum, d) => sum + (d.Revenue_growth * 100), 0) / validData.length,
      avgDebtToEquity: validData.reduce((sum, d) => sum + (d.debt_to_equity || 0), 0) / validData.length,
      avgEmployeeProductivity: validData.reduce((sum, d) => sum + (d.SDI / d.employees), 0) / validData.length,
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
  const ebitMargin = (companyData.EBIT_margin || 0) * 100
  const growthRate = (companyData.Revenue_growth || 0) * 100
  const debtToEquity = companyData.debt_to_equity || 0
  const employeeProductivity = companyData.SDI / (companyData.employees || 1)
  
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
