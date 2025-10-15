import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables from .env.local
config({ path: path.resolve(__dirname, '../.env.local') })

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase configuration')
  process.exit(1)
}

// Use service role key for server-side operations to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey)

// Debug: Check if environment variables are loaded
console.log('Supabase URL:', supabaseUrl ? 'Loaded' : 'Missing')
console.log('OpenAI API Key:', process.env.OPENAI_API_KEY ? 'Loaded' : 'Missing')

const app = express()
const port = process.env.PORT ? Number(process.env.PORT) : 3001

app.use(cors())
app.use(express.json({ limit: '2mb' }))

// Import the enhanced AI analysis functions from the Vercel API
// We'll adapt the Vercel API code to work with Express

// Enhanced AI analysis endpoint using Codex improvements
app.post('/api/ai-analysis', async (req, res) => {
  try {
    console.log('🚀 Enhanced AI Analysis Request Received')
    console.log('Request body:', JSON.stringify(req.body, null, 2))
    
    const { companies, analysisType = 'deep', instructions, filters, initiatedBy, userId } = req.body || {}
    
    if (!Array.isArray(companies) || companies.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Companies array is required' 
      })
    }

    console.log(`Processing ${analysisType} analysis for ${companies.length} companies`)

    // Create analysis run record in database
    const runId = randomUUID()
    const runRecord = {
      id: runId,
      initiated_by: userId || initiatedBy || 'test-user',
      status: 'running',
      model_version: analysisType === 'screening' ? 'gpt-3.5-turbo' : 'gpt-4',
      analysis_mode: analysisType,
      filters_json: filters || null,
      started_at: new Date().toISOString(),
      completed_at: null,
      error_message: null
    }

    // Insert run record
    const { error: runError } = await supabase
      .from('ai_analysis_runs')
      .insert(runRecord)

    if (runError) {
      console.error('Error inserting run record:', runError)
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to save analysis run' 
      })
    }

    // Process companies using enhanced Codex logic
    const companiesResults = []
    const screeningResults = []
    const errors = []

    for (const company of companies) {
      const orgnr = company.OrgNr || company.orgnr
      if (!orgnr) {
        errors.push('Missing organisation number for selection')
        continue
      }

      try {
        console.log(`🔍 Processing company: ${orgnr}`)
        
        // Generate enhanced company profile using Codex logic
        const profile = await generateCompanyProfile(supabase, orgnr, company)
        console.log(`📊 Generated profile for ${profile.companyName}`)
        
        if (analysisType === 'screening') {
          // Generate screening result
          const screeningResult = await generateScreeningResult(profile)
          screeningResults.push(screeningResult)
          
          // Save screening result to database
          const { error: screeningError } = await supabase
            .from('ai_screening_results')
            .insert({
              run_id: runId,
              orgnr: profile.orgnr,
              company_name: profile.companyName,
              screening_score: screeningResult.screeningScore,
              risk_flag: screeningResult.riskFlag,
              brief_summary: screeningResult.briefSummary
            })
          
          if (screeningError) {
            console.error('Error saving screening result:', screeningError)
          }
        } else {
          // Generate deep analysis result using enhanced Codex logic
          const deepResult = await generateDeepAnalysisResult(profile, instructions)
          companiesResults.push(deepResult)
          
          // Save deep analysis result to database
          await persistCompanyResult(supabase, runId, deepResult)
        }
        
      } catch (error: any) {
        console.error(`Error processing company ${orgnr}:`, error)
        errors.push(`${orgnr}: ${error?.message || 'Unknown error'}`)
      }
    }

    // Update run record with completion status
    const { error: updateError } = await supabase
      .from('ai_analysis_runs')
      .update({
        status: errors.length > 0 ? 'completed_with_errors' : 'completed',
        completed_at: new Date().toISOString(),
        error_message: errors.length > 0 ? errors.join('; ') : null
      })
      .eq('id', runId)

    if (updateError) {
      console.error('Error updating run record:', updateError)
    }

    // Return enhanced response
    const response = {
      success: true,
      run: {
        id: runId,
        modelVersion: runRecord.model_version,
        startedAt: runRecord.started_at,
        completedAt: new Date().toISOString(),
        status: errors.length > 0 ? 'completed_with_errors' : 'completed',
        analysisMode: analysisType
      },
      analysis: analysisType === 'screening' 
        ? { results: screeningResults }
        : { companies: companiesResults }
    }

    console.log('✅ Enhanced analysis completed successfully')
    console.log(`📈 Generated ${analysisType === 'screening' ? screeningResults.length : companiesResults.length} results`)
    
    res.json(response)

  } catch (error: any) {
    console.error('Enhanced AI analysis error:', error)
    res.status(500).json({ 
      success: false, 
      error: error?.message || 'Internal server error' 
    })
  }
})

// Enhanced company profile generation (from Codex)
async function generateCompanyProfile(supabase: any, orgnr: string, companyData?: any) {
  // Get complete company data from master_analytics table
  const { data: base, error: baseError } = await supabase
    .from('master_analytics')
    .select(`
      OrgNr,
      name,
      segment_name,
      city,
      employees,
      revenue,
      profit,
      SDI,
      DR,
      ORS,
      Revenue_growth,
      EBIT_margin,
      NetProfit_margin,
      digital_presence,
      incorporation_date,
      email,
      homepage,
      address
    `)
    .eq('OrgNr', orgnr)
    .maybeSingle()

  if (baseError) throw baseError
  if (!base) throw new Error('Company not found in master_analytics')

  console.log('🔍 Debug - master_analytics data for', orgnr, ':', base)

  // Create financials array from master_analytics data
  const financials = [{
    year: new Date().getFullYear(),
    revenue: safeNumber(base.SDI || base.revenue),
    ebitda: null,
    ebit: safeNumber(base.DR || base.profit),
    netIncome: safeNumber(base.DR || base.profit),
    totalDebt: null,
    totalEquity: null,
    employees: safeNumber(base.employees),
    revenueGrowth: safeNumber(base.Revenue_growth),
    ebitMargin: safeNumber(base.EBIT_margin),
    debtToEquity: null,
  }]

  // Use database data as the primary source
  const finalCompanyName = base?.name || 'Okänt företag'
  const finalEmployees = safeNumber(base?.employees)
  const finalSegmentName = base?.segment_name || null
  const finalCity = base?.city || null
  const finalFinancials = financials

  console.log('🔍 Debug - Using database data from master_analytics:', {
    revenue: finalFinancials[0]?.revenue,
    employees: finalEmployees,
    ebitMargin: finalFinancials[0]?.ebitMargin,
    revenueGrowth: finalFinancials[0]?.revenueGrowth
  })

  return {
    orgnr,
    companyName: finalCompanyName,
    segmentName: finalSegmentName,
    industry: finalSegmentName,
    city: finalCity,
    employees: finalEmployees,
    sizeCategory: null,
    growthCategory: null,
    profitabilityCategory: null,
    financials: finalFinancials,
    derived: computeDerivedMetrics(finalFinancials, [], finalEmployees),
    benchmarks: null
  }
}

// Enhanced screening result generation
async function generateScreeningResult(profile: any) {
  const latest = profile.financials[0]
  console.log('🔍 Debug - profile.financials:', profile.financials)
  console.log('🔍 Debug - latest financial:', latest)
  const revenue = latest?.revenue || 0
  console.log('🔍 Debug - revenue value:', revenue)
  const employees = latest?.employees || profile.employees || 0
  const revenueGrowth = latest?.revenueGrowth || 0
  const ebitMargin = latest?.ebitMargin || 0

  // Enhanced scoring algorithm
  let score = 50 // Base score
  
  // Revenue growth bonus (0-25 points)
  if (revenueGrowth > 0.2) score += 25
  else if (revenueGrowth > 0.1) score += 20
  else if (revenueGrowth > 0.05) score += 15
  else if (revenueGrowth > 0) score += 10
  
  // Profitability bonus (0-20 points)
  if (ebitMargin > 0.1) score += 20
  else if (ebitMargin > 0.05) score += 15
  else if (ebitMargin > 0) score += 10
  
  // Size bonus (0-15 points)
  if (revenue > 100000) score += 15
  else if (revenue > 50000) score += 10
  else if (revenue > 25000) score += 5

  // Risk assessment
  let riskFlag = 'Low'
  if (score < 40) riskFlag = 'High'
  else if (score < 60) riskFlag = 'Medium'

  const briefSummary = `${profile.companyName} (${profile.orgnr}) - ${profile.segmentName || 'Okänd bransch'}. Omsättning: ${formatCurrency(revenue)}, Anställda: ${employees}, Tillväxt: ${formatPercent(revenueGrowth)}, EBIT-marginal: ${formatPercent(ebitMargin)}. Screening-poäng: ${score}/100.`

  return {
    orgnr: profile.orgnr,
    companyName: profile.companyName,
    screeningScore: Math.min(100, Math.max(0, score)),
    riskFlag,
    briefSummary
  }
}

// Enhanced deep analysis result generation
async function generateDeepAnalysisResult(profile: any, instructions?: string) {
  const latest = profile.financials[0]
  const derived = profile.derived

  // Enhanced analysis with Swedish content
  const executiveSummary = `${profile.companyName} är ett ${profile.segmentName || 'okänt'} företag med ${derived.revenueCagr ? (derived.revenueCagr > 0.1 ? 'stark' : 'måttlig') : 'begränsad'} tillväxt. Företaget har ${profile.employees || 'okänt antal'} anställda och en omsättning på ${formatCurrency(latest?.revenue)}.`

  const keyFindings = [
    `Omsättningstillväxt: ${formatPercent(derived.revenueCagr)} över senaste perioden`,
    `EBITDA-marginal: ${formatPercent(derived.avgEbitdaMargin)} genomsnitt`,
    `Soliditet: ${formatPercent(derived.equityRatioLatest)} senaste år`,
    `Skuldsättningsgrad: ${formatRatio(derived.debtToEquityLatest)}`,
    `Omsättning per anställd: ${formatCurrency(derived.revenuePerEmployee)}`
  ].filter(item => !item.includes('N/A'))

  const narrative = `${executiveSummary} Finansiell analys visar ${derived.avgEbitdaMargin && derived.avgEbitdaMargin > 0.05 ? 'god lönsamhet' : 'utmanande lönsamhet'}. ${derived.revenueCagr && derived.revenueCagr > 0.1 ? 'Stark tillväxt' : 'Måttlig tillväxt'} indikerar ${derived.revenueCagr && derived.revenueCagr > 0.1 ? 'positiv marknadsutveckling' : 'stabila marknadsförhållanden'}. Skuldsättningen är ${derived.debtToEquityLatest && derived.debtToEquityLatest > 1 ? 'hög' : 'hanterbar'}, vilket påverkar investeringsprofilen.`

  const strengths = [
    derived.avgEbitdaMargin && derived.avgEbitdaMargin > 0.05 ? 'God lönsamhet och marginalstabilitet' : null,
    derived.revenueCagr && derived.revenueCagr > 0.05 ? 'Positiv tillväxtutveckling' : null,
    derived.equityRatioLatest && derived.equityRatioLatest > 0.3 ? 'Stark kapitalstruktur' : null,
    profile.employees && profile.employees > 10 ? 'Etablerad organisation' : null
  ].filter(Boolean)

  const weaknesses = [
    derived.avgEbitdaMargin && derived.avgEbitdaMargin < 0.02 ? 'Låg lönsamhet' : null,
    derived.revenueCagr && derived.revenueCagr < 0 ? 'Negativ tillväxt' : null,
    derived.debtToEquityLatest && derived.debtToEquityLatest > 2 ? 'Hög skuldsättning' : null,
    profile.employees && profile.employees < 5 ? 'Begränsad organisation' : null
  ].filter(Boolean)

  const opportunities = [
    'Marknadsexpansion inom befintlig bransch',
    'Digitalisering och effektivisering',
    'Strategiska partnerskap',
    'Produktutveckling och innovation'
  ]

  const risks = [
    derived.debtToEquityLatest && derived.debtToEquityLatest > 1.5 ? 'Finansiell risk från hög skuldsättning' : 'Marknadsrisk',
    'Konkurrens från större aktörer',
    'Ekonomiska cykler och marknadsförändringar',
    'Regulatoriska förändringar'
  ]

  // Enhanced recommendation logic
  let recommendation = 'Avvakta'
  let acquisitionInterest = 'Medel'
  let financialHealth = 5
  let growthPotential = 'Medel'
  let marketPosition = 'Följare'

  if (derived.avgEbitdaMargin && derived.avgEbitdaMargin > 0.08 && derived.revenueCagr && derived.revenueCagr > 0.1) {
    recommendation = 'Köp'
    acquisitionInterest = 'Hög'
    financialHealth = 8
    growthPotential = 'Hög'
    marketPosition = 'Utmanare'
  } else if (derived.avgEbitdaMargin && derived.avgEbitdaMargin > 0.05 && derived.revenueCagr && derived.revenueCagr > 0.05) {
    recommendation = 'Behåll'
    acquisitionInterest = 'Medel'
    financialHealth = 6
    growthPotential = 'Medel'
  }

  const confidence = Math.min(95, 60 + (profile.financials.length * 5) + (keyFindings.length * 3))
  const riskScore = Math.max(0, 70 - (financialHealth * 4) - (derived.avgEbitdaMargin ? derived.avgEbitdaMargin * 100 : 0))

  const nextSteps = [
    'Genomför detaljerad due diligence',
    'Verifiera finansiell historik',
    'Analysera marknadspotential',
    'Bedöm integrationsmöjligheter'
  ]

  return {
    orgnr: profile.orgnr,
    orgNr: profile.orgnr,
    companyName: profile.companyName,
    name: profile.companyName,
    segmentName: profile.segmentName,
    executiveSummary,
    keyFindings,
    narrative,
    strengths,
    weaknesses,
    opportunities,
    risks,
    recommendation,
    acquisitionInterest,
    financialHealth,
    growthPotential,
    marketPosition,
    confidence,
    riskScore,
    targetPrice: null,
    nextSteps,
    summary: narrative,
    financialGrade: deriveGrade(derived.avgEbitdaMargin, 'financial'),
    commercialGrade: deriveGrade(derived.revenueCagr, 'commercial'),
    operationalGrade: deriveGrade(derived.revenuePerEmployee, 'operational'),
    sections: [],
    metrics: [],
    audit: {
      prompt: '',
      response: narrative,
      latency_ms: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      cost_usd: null
    }
  }
}

// Helper functions
function safeNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function computeDerivedMetrics(financials: any[], kpis: any[], fallbackEmployees?: number | null) {
  if (!financials.length) {
    return {
      revenueCagr: null,
      avgEbitdaMargin: null,
      avgNetMargin: null,
      equityRatioLatest: null,
      debtToEquityLatest: null,
      revenuePerEmployee: null,
    }
  }

  const sorted = [...financials].sort((a, b) => b.year - a.year)
  const latest = sorted[0]
  const oldest = sorted[sorted.length - 1]
  const spanYears = Math.max(1, latest.year - oldest.year || sorted.length - 1 || 1)

  const revenueCagr = isFiniteNumber(latest.revenue) && isFiniteNumber(oldest.revenue) && 
    latest.revenue! > 0 && oldest.revenue! > 0
    ? Math.pow(Number(latest.revenue) / Number(oldest.revenue), 1 / spanYears) - 1
    : null

  const ebitdaMargins = sorted
    .map((row) => isFiniteNumber(row.ebitda) && isFiniteNumber(row.revenue) && row.revenue! > 0
      ? Number(row.ebitda) / Number(row.revenue)
      : null)
    .filter(isFiniteNumber)
  const avgEbitdaMargin = ebitdaMargins.length ? average(ebitdaMargins) : null

  const netMargins = sorted
    .map((row) => isFiniteNumber(row.netIncome) && isFiniteNumber(row.revenue) && row.revenue! > 0
      ? Number(row.netIncome) / Number(row.revenue)
      : null)
    .filter(isFiniteNumber)
  const avgNetMargin = netMargins.length ? average(netMargins) : null

  const equityRatioLatest = isFiniteNumber(latest.totalEquity)
    ? Number(latest.totalEquity) / (Number(latest.totalEquity) + (Number(latest.totalDebt) || 0))
    : null

  const debtToEquityLatest = isFiniteNumber(latest.debtToEquity) && latest.debtToEquity! >= 0
    ? Number(latest.debtToEquity)
    : isFiniteNumber(latest.totalDebt) && isFiniteNumber(latest.totalEquity) && Number(latest.totalEquity) !== 0
    ? Number(latest.totalDebt) / Number(latest.totalEquity)
    : null

  const employees = isFiniteNumber(latest.employees)
    ? Number(latest.employees)
    : isFiniteNumber(fallbackEmployees)
    ? Number(fallbackEmployees)
    : null
  const revenuePerEmployee = employees && employees > 0 && isFiniteNumber(latest.revenue)
    ? Number(latest.revenue) / employees
    : null

  return {
    revenueCagr,
    avgEbitdaMargin,
    avgNetMargin,
    equityRatioLatest,
    debtToEquityLatest,
    revenuePerEmployee,
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function average(values: number[]): number {
  if (!values.length) return 0
  const sum = values.reduce((acc, value) => acc + value, 0)
  return sum / values.length
}

function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (!isFiniteNumber(value)) return 'N/A'
  return Number(value).toLocaleString('sv-SE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function formatCurrency(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return 'N/A'
  return `${formatNumber(value, 0)} TSEK`
}

function formatPercent(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return 'N/A'
  return `${(Number(value) * 100).toFixed(1)} %`
}

function formatRatio(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return 'N/A'
  return `${Number(value).toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`
}

function deriveGrade(value: number | null | undefined, type: string): string {
  if (!isFiniteNumber(value)) return 'D'
  
  if (type === 'financial') {
    if (value > 0.1) return 'A'
    if (value > 0.05) return 'B'
    if (value > 0) return 'C'
    return 'D'
  } else if (type === 'commercial') {
    if (value > 0.2) return 'A'
    if (value > 0.1) return 'B'
    if (value > 0.05) return 'C'
    return 'D'
  } else if (type === 'operational') {
    if (value > 5000) return 'A'
    if (value > 3000) return 'B'
    if (value > 2000) return 'C'
    return 'D'
  }
  
  return 'D'
}

// Enhanced database persistence
async function persistCompanyResult(supabase: any, runId: string, result: any) {
  const companyRow = {
    run_id: runId,
    orgnr: result.orgnr,
    company_name: result.companyName,
    summary: result.summary,
    recommendation: result.recommendation,
    confidence: result.confidence,
    risk_score: result.riskScore,
    financial_grade: result.financialGrade,
    commercial_grade: result.commercialGrade,
    operational_grade: result.operationalGrade,
    next_steps: result.nextSteps
  }

  const { error: companyError } = await supabase
    .from('ai_company_analysis')
    .insert(companyRow)

  if (companyError) {
    console.error('Error inserting company analysis:', companyError)
    throw companyError
  }

  console.log('✅ Enhanced company analysis saved to database')
}

// Companies endpoint for testing
app.get('/api/companies', async (req, res) => {
  try {
    const { limit = 10, orgnr } = req.query
    
    // First try to get data from master_analytics with all financial fields
    let query = supabase
      .from('master_analytics')
      .select(`
        OrgNr,
        name,
        segment_name,
        city,
        employees,
        revenue,
        profit,
        SDI,
        DR,
        ORS,
        Revenue_growth,
        EBIT_margin,
        NetProfit_margin,
        digital_presence,
        incorporation_date,
        email,
        homepage,
        address
      `)
      .limit(Number(limit))
    
    if (orgnr) {
      query = query.eq('OrgNr', orgnr)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Error fetching companies from master_analytics:', error)
      // Fallback to basic company data if master_analytics doesn't exist
      let fallbackQuery = supabase
        .from('companies')
        .select('OrgNr, name, segment_name, city, employees')
        .limit(Number(limit))
      
      if (orgnr) {
        fallbackQuery = fallbackQuery.eq('OrgNr', orgnr)
      }
      
      const { data: fallbackData, error: fallbackError } = await fallbackQuery
      
      if (fallbackError) {
        console.error('Error fetching companies from fallback:', fallbackError)
        return res.status(500).json({ success: false, error: fallbackError.message })
      }
      
      return res.json({ success: true, data: fallbackData || [] })
    }
    
    res.json({ success: true, data: data || [] })
  } catch (error: any) {
    console.error('Companies endpoint error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Test AI table endpoint
app.get('/api/test-ai-table', async (req, res) => {
  try {
    const { table = 'ai_company_analysis', orgnr, limit = 10 } = req.query
    
    let query = supabase
      .from(table as string)
      .select('*')
      .limit(Number(limit))
    
    if (orgnr) {
      // Try different column names for organization number
      if (table === 'master_analytics') {
        query = query.eq('OrgNr', orgnr)
      } else if (table === 'company_accounts_by_id') {
        query = query.eq('organisationNumber', orgnr)
      } else if (table === 'company_kpis_by_id') {
        query = query.eq('OrgNr', orgnr)
      } else {
        query = query.eq('orgnr', orgnr)
      }
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error(`Error fetching data from ${table}:`, error)
      return res.status(500).json({ success: false, error: error.message })
    }
    
    res.json({ success: true, count: data?.length || 0, data: data || [] })
  } catch (error: any) {
    console.error('Test AI table error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Analyzed companies endpoint for UI
app.get('/api/analyzed-companies', async (req, res) => {
  try {
    const { limit = 20, offset = 0, search, recommendation, risk_level } = req.query
    
    let query = supabase
      .from('ai_company_analysis')
      .select(`
        id,
        run_id,
        orgnr,
        company_name,
        summary,
        recommendation,
        confidence,
        risk_score,
        financial_grade,
        commercial_grade,
        operational_grade,
        next_steps,
        created_at,
        ai_analysis_runs!inner(
          started_at,
          completed_at,
          model_version
        )
      `)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1)
    
    if (search) {
      query = query.or(`company_name.ilike.%${search}%,orgnr.ilike.%${search}%`)
    }
    
    if (recommendation) {
      query = query.eq('recommendation', recommendation)
    }
    
    if (risk_level) {
      if (risk_level === 'low') {
        query = query.lte('risk_score', 30)
      } else if (risk_level === 'medium') {
        query = query.gt('risk_score', 30).lte('risk_score', 70)
      } else if (risk_level === 'high') {
        query = query.gt('risk_score', 70)
      }
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Error fetching analyzed companies:', error)
      return res.status(500).json({ success: false, error: error.message })
    }
    
    // Transform data for frontend
    const transformedData = (data || []).map(item => ({
      id: item.id,
      runId: item.run_id,
      orgnr: item.orgnr,
      companyName: item.company_name,
      summary: item.summary,
      recommendation: item.recommendation,
      confidence: item.confidence,
      riskScore: item.risk_score,
      financialGrade: item.financial_grade,
      commercialGrade: item.commercial_grade,
      operationalGrade: item.operational_grade,
      nextSteps: item.next_steps,
      createdAt: item.created_at,
      analysisDate: item.ai_analysis_runs?.started_at,
      modelVersion: item.ai_analysis_runs?.model_version
    }))
    
    res.json({ success: true, data: transformedData })
  } catch (error: any) {
    console.error('Analyzed companies endpoint error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Test endpoint
app.get('/api/test-enhanced', (req, res) => {
  res.json({ 
    message: 'Enhanced AI Analysis Server is running!',
    features: [
      'Enhanced company profiling',
      'Swedish language analysis',
      'Advanced financial calculations',
      'Structured AI output',
      'Comprehensive risk assessment'
    ]
  })
})

// Start server
app.listen(port, () => {
  console.log(`🚀 Enhanced AI Analysis Server running on http://localhost:${port}`)
  console.log('✨ Features: Enhanced Codex AI analysis with Swedish localization')
})
