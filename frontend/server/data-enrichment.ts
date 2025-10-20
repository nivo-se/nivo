/**
 * Comprehensive Data Enrichment Service
 * Fetches and aggregates multi-source company data for AI analysis
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { 
  DataLoadResult, 
  QualityIssue, 
  ComprehensiveCompanyData, 
  createQualityIssue,
  calculateFinancialTrends 
} from './data-quality.js'
import { getIndustryBenchmarks } from './industry-benchmarks.js'

/**
 * Fetch comprehensive company data from available sources
 * Note: Historical tables are currently empty, so we focus on master_analytics
 */
export async function fetchComprehensiveCompanyData(
  supabase: SupabaseClient,
  orgnr: string
): Promise<DataLoadResult<ComprehensiveCompanyData>> {
  const issues: QualityIssue[] = []
  
  try {
    // 1. Validate that master_analytics table exists and is accessible
    const { error: tableError } = await supabase
      .from('master_analytics')
      .select('*')
      .limit(1)
    
    if (tableError) {
      issues.push(createQualityIssue(
        'critical',
        `Cannot access master_analytics table: ${tableError.message}`,
        { error: tableError.message }
      ))
      return { data: null, issues, success: false }
    }
    
    // 2. Fetch master analytics data (primary source)
    const masterResult = await fetchMasterAnalytics(supabase, orgnr)
    issues.push(...masterResult.issues)
    
    // 3. Check for critical data availability
    if (!masterResult.data) {
      issues.push(createQualityIssue(
        'critical',
        'No master analytics data found',
        { orgnr }
      ))
      return { data: null, issues, success: false }
    }
    
    // 4. Try to fetch historical data (may be empty)
    const historicalResult = await fetchHistoricalAccounts(supabase, orgnr)
    const kpiResult = await fetchDetailedKPIs(supabase, orgnr)
    
    // Add historical data issues as warnings (not critical)
    if (historicalResult.issues.length > 0) {
      issues.push(...historicalResult.issues.map(issue => ({
        ...issue,
        level: 'warning' as const // Downgrade to warning since historical data is optional
      })))
    }
    
    if (kpiResult.issues.length > 0) {
      issues.push(...kpiResult.issues.map(issue => ({
        ...issue,
        level: 'warning' as const // Downgrade to warning since KPI data is optional
      })))
    }
    
    // 5. Calculate trends and benchmarks
    const trends = calculateFinancialTrends(historicalResult.data || [])
    const benchmarks = await getIndustryBenchmarks(supabase, masterResult.data.segment_name)
    
    // 6. Assemble comprehensive data
    const comprehensiveData: ComprehensiveCompanyData = {
      masterData: masterResult.data,
      historicalData: historicalResult.data || [],
      kpiData: kpiResult.data || [],
      trends,
      benchmarks
    }
    
    return { data: comprehensiveData, issues, success: true }
    
  } catch (error) {
    issues.push(createQualityIssue(
      'critical',
      `Data enrichment failed: ${error.message}`,
      { orgnr, error: error.message }
    ))
    return { data: null, issues, success: false }
  }
}

/**
 * Fetch master analytics data (current year snapshot)
 */
async function fetchMasterAnalytics(
  supabase: SupabaseClient,
  orgnr: string
): Promise<DataLoadResult<any>> {
  const issues: QualityIssue[] = []
  
  try {
    const { data, error } = await supabase
      .from('master_analytics')
      .select('*')
      .eq('OrgNr', orgnr)
      .single()
    
    if (error) {
      issues.push(createQualityIssue(
        'critical',
        `Failed to fetch master analytics: ${error.message}`,
        { orgnr, error: error.message }
      ))
      return { data: null, issues, success: false }
    }
    
    if (!data) {
      issues.push(createQualityIssue(
        'critical',
        'No master analytics data found',
        { orgnr }
      ))
      return { data: null, issues, success: false }
    }
    
    // Check data completeness
    const missingFields = []
    if (!data.SDI) missingFields.push('SDI (revenue)')
    if (!data.DR) missingFields.push('DR (net profit)')
    if (!data.EBIT_margin) missingFields.push('EBIT_margin')
    
    if (missingFields.length > 0) {
      issues.push(createQualityIssue(
        'warning',
        `Missing key financial fields: ${missingFields.join(', ')}`,
        { orgnr, missingFields }
      ))
    }
    
    return { data, issues, success: true }
    
  } catch (error) {
    issues.push(createQualityIssue(
      'critical',
      `Master analytics fetch error: ${error.message}`,
      { orgnr, error: error.message }
    ))
    return { data: null, issues, success: false }
  }
}

/**
 * Fetch historical financial accounts (4+ years)
 */
async function fetchHistoricalAccounts(
  supabase: SupabaseClient,
  orgnr: string
): Promise<DataLoadResult<any[]>> {
  const issues: QualityIssue[] = []
  
  try {
    const { data, error } = await supabase
      .from('company_accounts_by_id')
      .select('*')
      .eq('OrgNr', orgnr)
      .order('year', { ascending: false })
      .limit(4) // Last 4 years
    
    if (error) {
      issues.push(createQualityIssue(
        'warning',
        `Failed to fetch historical accounts: ${error.message}`,
        { orgnr, error: error.message }
      ))
      return { data: [], issues, success: false }
    }
    
    if (!data || data.length === 0) {
      issues.push(createQualityIssue(
        'warning',
        'No historical accounts data found',
        { orgnr }
      ))
      return { data: [], issues, success: false }
    }
    
    // Check data quality
    const validYears = data.filter(d => d.year && d.SDI > 0)
    if (validYears.length < 2) {
      issues.push(createQualityIssue(
        'warning',
        `Limited valid historical data: ${validYears.length} years`,
        { orgnr, totalYears: data.length, validYears: validYears.length }
      ))
    }
    
    return { data: validYears, issues, success: true }
    
  } catch (error) {
    issues.push(createQualityIssue(
      'warning',
      `Historical accounts fetch error: ${error.message}`,
      { orgnr, error: error.message }
    ))
    return { data: [], issues, success: false }
  }
}

/**
 * Fetch detailed KPIs
 */
async function fetchDetailedKPIs(
  supabase: SupabaseClient,
  orgnr: string
): Promise<DataLoadResult<any[]>> {
  const issues: QualityIssue[] = []
  
  try {
    const { data, error } = await supabase
      .from('company_kpis_by_id')
      .select('*')
      .eq('OrgNr', orgnr)
      .order('year', { ascending: false })
      .limit(4)
    
    if (error) {
      issues.push(createQualityIssue(
        'info',
        `Failed to fetch KPI data: ${error.message}`,
        { orgnr, error: error.message }
      ))
      return { data: [], issues, success: false }
    }
    
    return { data: data || [], issues, success: true }
    
  } catch (error) {
    issues.push(createQualityIssue(
      'info',
      `KPI data fetch error: ${error.message}`,
      { orgnr, error: error.message }
    ))
    return { data: [], issues, success: false }
  }
}

/**
 * Validate that tables exist (helper function)
 */
async function validateTablesExist(
  supabase: SupabaseClient,
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
