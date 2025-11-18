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
 * Note: Uses the new companies + company_metrics schema and company_financials for history
 */
export async function fetchComprehensiveCompanyData(
  supabase: SupabaseClient,
  orgnr: string
): Promise<DataLoadResult<ComprehensiveCompanyData>> {
  const issues: QualityIssue[] = []
  
  try {
    // 1. Validate that core tables are accessible
    const { error: tableError } = await supabase
      .from('companies')
      .select('orgnr')
      .limit(1)
    
    if (tableError) {
      issues.push(createQualityIssue(
        'critical',
        `Cannot access companies table: ${tableError.message}`,
        { error: tableError?.message }
      ))
      return { data: null, issues, success: false }
    }

    // 2. Fetch primary company snapshot (companies + company_metrics)
    const masterResult = await fetchCompanySnapshot(supabase, orgnr)
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
async function fetchCompanySnapshot(
  supabase: SupabaseClient,
  orgnr: string
): Promise<DataLoadResult<any>> {
  const issues: QualityIssue[] = []

  try {
    const { data, error } = await supabase
      .from('companies')
      .select(`
        orgnr,
        company_id,
        company_name,
        address,
        homepage,
        email,
        segment_names,
        foundation_year,
        employees_latest,
        company_metrics (
          latest_revenue_sek,
          latest_profit_sek,
          latest_ebitda_sek,
          revenue_cagr_3y,
          avg_ebitda_margin,
          avg_net_margin,
          company_size_bucket,
          profitability_bucket,
          growth_bucket,
          digital_presence
        )
      `)
      .eq('orgnr', orgnr)
      .single()
    
    if (error) {
      issues.push(createQualityIssue(
        'critical',
        `Failed to fetch company snapshot: ${error.message}`,
        { orgnr, error: error.message }
      ))
      return { data: null, issues, success: false }
    }

    if (!data) {
      issues.push(createQualityIssue(
        'critical',
        'No company data found',
        { orgnr }
      ))
      return { data: null, issues, success: false }
    }

    // Check data completeness
    const missingFields = []
    if (!data.company_metrics?.latest_revenue_sek) missingFields.push('latest_revenue_sek (revenue)')
    if (!data.company_metrics?.latest_profit_sek) missingFields.push('latest_profit_sek (net profit)')
    if (!data.company_metrics?.avg_ebitda_margin) missingFields.push('avg_ebitda_margin')
    
    if (missingFields.length > 0) {
      issues.push(createQualityIssue(
        'warning',
        `Missing key financial fields: ${missingFields.join(', ')}`,
        { orgnr, missingFields }
      ))
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
      SDI: data.company_metrics?.latest_revenue_sek,
      DR: data.company_metrics?.latest_profit_sek,
      ORS: data.company_metrics?.latest_ebitda_sek,
      Revenue_growth: data.company_metrics?.revenue_cagr_3y,
      EBIT_margin: data.company_metrics?.avg_ebitda_margin,
      NetProfit_margin: data.company_metrics?.avg_net_margin,
      company_size_category: data.company_metrics?.company_size_bucket,
      profitability_category: data.company_metrics?.profitability_bucket,
      growth_category: data.company_metrics?.growth_bucket,
      digital_presence: data.company_metrics?.digital_presence
    }

    return { data: mapped, issues, success: true }

  } catch (error) {
    issues.push(createQualityIssue(
      'critical',
      `Company snapshot fetch error: ${error.message}`,
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
      .from('company_financials')
      .select('year, revenue_sek, profit_sek, ebitda_sek, employees')
      .eq('orgnr', orgnr)
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
    const validYears = data.filter(d => d.year && (d.revenue_sek || 0) > 0)
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
      .from('company_metrics')
      .select('revenue_cagr_3y, avg_ebitda_margin, avg_net_margin, equity_ratio_latest, debt_to_equity_latest')
      .eq('orgnr', orgnr)
      .maybeSingle()

    if (error) {
      issues.push(createQualityIssue(
        'info',
        `Failed to fetch KPI data: ${error.message}`,
        { orgnr, error: error.message }
      ))
      return { data: [], issues, success: false }
    }

    return { data: data ? [data] : [], issues, success: true }
    
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
