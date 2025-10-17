/**
 * Data Quality Tracking System
 * Inspired by Codex's QualityIssue pattern from backend agentic pipeline
 */

export interface QualityIssue {
  level: 'critical' | 'warning' | 'info'
  message: string
  context?: Record<string, any>
}

export interface DataLoadResult<T = any> {
  data: T | null
  issues: QualityIssue[]
  success: boolean
}

export interface ComprehensiveCompanyData {
  masterData: any
  historicalData: any[]
  kpiData: any[]
  trends: FinancialTrends
  benchmarks: IndustryBenchmarks
}

export interface FinancialTrends {
  revenueCagr: number
  ebitTrend: 'improving' | 'stable' | 'declining'
  marginTrend: 'improving' | 'stable' | 'declining'
  consistencyScore: number
  volatilityIndex: number
}

export interface IndustryBenchmarks {
  avgEbitMargin: number
  avgGrowthRate: number
  avgDebtToEquity: number
  avgEmployeeProductivity: number
  sampleSize: number
}

/**
 * Validates that required tables exist in the database
 */
export async function validateTablesExist(
  supabase: any,
  requiredTables: string[]
): Promise<string[]> {
  const missingTables: string[] = []
  
  for (const table of requiredTables) {
    try {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(1)
      
      if (error) {
        missingTables.push(table)
      }
    } catch (err) {
      missingTables.push(table)
    }
  }
  
  return missingTables
}

/**
 * Creates a quality issue with standardized format
 */
export function createQualityIssue(
  level: QualityIssue['level'],
  message: string,
  context?: Record<string, any>
): QualityIssue {
  return { level, message, context }
}

/**
 * Calculates financial trends from historical data
 */
export function calculateFinancialTrends(historicalData: any[]): FinancialTrends {
  if (historicalData.length < 2) {
    return {
      revenueCagr: 0,
      ebitTrend: 'stable',
      marginTrend: 'stable',
      consistencyScore: 50,
      volatilityIndex: 0
    }
  }
  
  // Sort by year descending (most recent first)
  const sorted = historicalData.sort((a, b) => b.year - a.year)
  
  const revenues = sorted.map(d => d.SDI || d.revenue || 0).filter(r => r > 0)
  const ebits = sorted.map(d => d.EBIT || d.ebit || 0).filter(e => e !== null && e !== undefined)
  const margins = sorted.map(d => d.EBIT_margin || d.ebit_margin || 0).filter(m => m !== null && m !== undefined)
  
  return {
    revenueCagr: calculateCAGR(revenues),
    ebitTrend: calculateTrend(ebits),
    marginTrend: calculateTrend(margins),
    consistencyScore: calculateConsistency(sorted),
    volatilityIndex: calculateVolatility(revenues)
  }
}

/**
 * Calculate Compound Annual Growth Rate
 */
function calculateCAGR(values: number[]): number {
  if (values.length < 2) return 0
  
  const first = values[values.length - 1] // Oldest
  const last = values[0] // Newest
  const years = values.length - 1
  
  if (first <= 0) return 0
  
  return Math.pow(last / first, 1 / years) - 1
}

/**
 * Determine trend direction from time series
 */
function calculateTrend(values: number[]): 'improving' | 'stable' | 'declining' {
  if (values.length < 2) return 'stable'
  
  const first = values[values.length - 1] // Oldest
  const last = values[0] // Newest
  
  const change = (last - first) / Math.abs(first)
  
  if (change > 0.1) return 'improving'
  if (change < -0.1) return 'declining'
  return 'stable'
}

/**
 * Calculate consistency score (0-100)
 */
function calculateConsistency(data: any[]): number {
  if (data.length < 2) return 50
  
  const revenues = data.map(d => d.SDI || d.revenue || 0)
  const avgRevenue = revenues.reduce((sum, r) => sum + r, 0) / revenues.length
  
  if (avgRevenue === 0) return 50
  
  const variance = revenues.reduce((sum, r) => sum + Math.pow(r - avgRevenue, 2), 0) / revenues.length
  const coefficient = Math.sqrt(variance) / avgRevenue
  
  // Lower coefficient = more consistent
  return Math.max(0, Math.min(100, 100 - (coefficient * 100)))
}

/**
 * Calculate volatility index (0-100)
 */
function calculateVolatility(values: number[]): number {
  if (values.length < 2) return 0
  
  const returns = []
  for (let i = 1; i < values.length; i++) {
    if (values[i-1] > 0) {
      returns.push((values[i] - values[i-1]) / values[i-1])
    }
  }
  
  if (returns.length === 0) return 0
  
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
  
  return Math.sqrt(variance) * 100
}
