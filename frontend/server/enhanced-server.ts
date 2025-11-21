import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import OpenAI from 'openai'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import Database from 'better-sqlite3'
import { getLocalDB, localDBExists } from './local-db.js'
import { fetchComprehensiveCompanyData } from './data-enrichment.js'
import { QualityIssue, createQualityIssue } from './data-quality.js'
import { getCompanyContext } from './industry-benchmarks.js'
import {
  runValuations,
  createCompanyProfile,
  ValuationOutput,
  CompanyProfile
} from './valuation/engine.js'
import {
  computeValuationMetrics,
  buildValuationExportDataset,
  type ValuationMetrics,
  type NormalizedFinancialHistory
} from '../src/lib/valuation.js'
import { 
  loadAllAssumptions, 
  AssumptionsOverride,
  getAllAssumptions,
  updateAssumptions,
  createAssumptions,
  deleteAssumptions
} from './valuation/assumptions.js'
import { 
  getLLMSuggestions, 
  convertSuggestionsToAssumptions,
  validateSuggestions,
  CompanyContext 
} from './valuation/llm-advisor.js'

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables from .env.local
config({ path: path.resolve(__dirname, '../.env.local') })

// Debug: Check if environment variables are loaded
console.log('Supabase URL:', process.env.VITE_SUPABASE_URL ? 'Loaded' : 'Missing')
console.log('OpenAI API Key:', process.env.OPENAI_API_KEY ? 'Loaded' : 'Missing')

const app = express()
const port = process.env.PORT ? Number(process.env.PORT) : 3001

app.use(cors())
app.use(express.json({ limit: '2mb' }))

// Types
type Nullable<T> = T | null

interface CompanySelection {
  OrgNr?: string
  orgnr?: string
  name?: string
}

interface AnalysisRequest {
  companies: CompanySelection[]
  analysisType: 'screening' | 'deep'
  instructions?: string
  filters?: any
  initiatedBy?: string
  templateId?: string
  templateName?: string
  customInstructions?: string
}

interface UsageSummary {
  input_tokens?: number
  output_tokens?: number
  total_tokens?: number
}

interface SectionResult {
  section_type: string
  title?: string | null
  content_md: string
  supporting_metrics: any[]
  confidence?: number | null
  tokens_used?: number | null
}

interface MetricResult {
  metric_name: string
  metric_value: number
  metric_unit?: string | null
  source?: string | null
  year?: number | null
  confidence?: number | null
}

interface ValuationCompanyResponse {
  orgnr: string
  name: string
  industry: string | null
  employees: number | null
  metrics: ValuationMetrics
  history: NormalizedFinancialHistory
  chartSeries: Array<{ year: number; revenue: number | null; ebit: number | null; ebitda: number | null }>
  aiInsights?: CompanyValuationInsight
}

interface CompanyValuationInsight {
  summary: string
  valuationView?: string | null
  riskFlags: string[]
  opportunities?: string[]
  valuationRange?: string | null
  mode: 'default' | 'deep'
}

interface ValuationApiResponse {
  valuationSessionId: string | null
  mode: 'default' | 'deep'
  generatedAt: string
  companies: ValuationCompanyResponse[]
  overallSummary: string
  exportDataset: ReturnType<typeof buildValuationExportDataset>
}

interface AuditResult {
  prompt: string
  response: string
  latency_ms: number
  prompt_tokens: number
  completion_tokens: number
  cost_usd: number | null
}

interface CompanyResult {
  orgnr: string
  companyId?: string | null
  companyName: string
  summary: string | null
  recommendation: string | null
  confidence: number | null
  riskScore: number | null
  financialGrade: string | null
  commercialGrade: string | null
  operationalGrade: string | null
  financialMetrics?: {
    revenue: number
    profit: number
    equity: number
    assets: number
    liabilities: number
    cash: number
    debt: number
    equityRatio: number
    currentRatio: number
    debtToEquity: number
    returnOnEquity: number
    returnOnAssets: number
  }
  nextSteps: string[]
  sections: SectionResult[]
  metrics: MetricResult[]
  audit: AuditResult
  contextSummary?: string
  // Enhanced Codex fields
  executiveSummary?: string | null
  keyFindings?: string[] | null
  narrative?: string | null
  strengths?: string[] | null
  weaknesses?: string[] | null
  opportunities?: string[] | null
  risks?: string[] | null
  acquisitionInterest?: string | null
  financialHealth?: number | null
  growthPotential?: string | null
  marketPosition?: string | null
  targetPrice?: number | null
}

interface ScreeningResult {
  orgnr: string
  companyName: string
  screeningScore: number | null
  riskFlag: 'Low' | 'Medium' | 'High' | null
  briefSummary: string | null
  audit: AuditResult
}

interface RunPayload {
  id: string
  status: string
  modelVersion: string
  analysisMode: string
  startedAt: string
  completedAt?: string | null
  errorMessage?: string | null
}

interface RunResponsePayload {
  run: RunPayload
  analysis: { companies: CompanyResult[] } | { results: ScreeningResult[] }
}

// Constants
const MODEL_DEFAULT = process.env.OPENAI_MODEL || 'gpt-4o-mini'
const MODEL_SCREENING = 'gpt-4o-mini'  // Use mini for cost efficiency
const PROMPT_COST_PER_1K = 0.00015  // GPT-4o-mini rates
const COMPLETION_COST_PER_1K = 0.0006
const SCREENING_PROMPT_COST_PER_1K = 0.00015  // Same as deep analysis for consistency
const SCREENING_COMPLETION_COST_PER_1K = 0.0006

// Supabase client
function getSupabase(): SupabaseClient | null {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials')
    return null
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// Main AI Analysis endpoint
app.post('/api/ai-analysis', async (req, res) => {
  try {
    const { companies, analysisType = 'deep', instructions, filters, initiatedBy, templateId, templateName, customInstructions } = req.body as AnalysisRequest || {}
    
    if (!Array.isArray(companies) || companies.length === 0) {
      return res.status(400).json({ success: false, error: 'No companies provided' })
    }

    if (analysisType !== 'screening' && analysisType !== 'deep') {
      return res.status(400).json({ success: false, error: 'Invalid analysis type. Must be "screening" or "deep"' })
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ success: false, error: 'OpenAI API key not configured' })
    }

    const supabase = getSupabase()
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase credentials not configured' })
    }

    const uniqueSelections: CompanySelection[] = []
    const seen = new Set<string>()
    for (const entry of companies) {
      const orgnr = String(entry?.OrgNr || entry?.orgnr || '').trim()
      if (!orgnr || seen.has(orgnr)) continue
      seen.add(orgnr)
      uniqueSelections.push(entry)
    }

    if (uniqueSelections.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid companies provided' })
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const runId = randomUUID()
    const startedAt = new Date().toISOString()

    const modelVersion = analysisType === 'screening' ? MODEL_SCREENING : MODEL_DEFAULT
    
    try {
      await insertRunRecord(supabase, {
        id: runId,
        status: 'running',
        modelVersion,
        analysisMode: analysisType,
        startedAt,
        initiatedBy: typeof initiatedBy === 'string' ? initiatedBy : 'unknown-user',
        filters,
        templateId,
        templateName,
        customInstructions,
        companyCount: uniqueSelections.length,
      })
    } catch (error) {
      console.error('Failed to create analysis run:', error)
      return res.status(500).json({ 
        success: false, 
        error: `Failed to create analysis run: ${error instanceof Error ? error.message : 'Unknown error'}` 
      })
    }

    const companiesResults: CompanyResult[] = []
    const screeningResults: ScreeningResult[] = []
    const errors: string[] = []

    if (analysisType === 'screening') {
      // Process screening in batches for efficiency
      const batchSize = 5
      for (let i = 0; i < uniqueSelections.length; i += batchSize) {
        const batch = uniqueSelections.slice(i, i + batchSize)
        try {
          const batchResult = await processScreeningBatch(supabase, openai, runId, batch, instructions)
          screeningResults.push(...batchResult.results)
          
          // Log quality issues for monitoring
          if (batchResult.issues.length > 0) {
            console.log(`Quality issues in batch ${Math.floor(i/batchSize) + 1}:`, batchResult.issues)
          }
        } catch (error: any) {
          console.error('Screening batch failed', error)
          errors.push(`Batch ${Math.floor(i/batchSize) + 1}: ${error?.message || 'Unknown error'}`)
        }
      }
    } else {
      // Process deep analysis individually
      for (const selection of uniqueSelections) {
        try {
          const result = await processDeepAnalysis(supabase, openai, runId, selection, instructions)
          if (result) {
            companiesResults.push(result)
          }
        } catch (error: any) {
          console.error('Deep analysis failed', error)
          errors.push(`${selection.OrgNr || selection.orgnr}: ${error?.message || 'Unknown error'}`)
        }
      }
    }

    const completedAt = new Date().toISOString()
    const finalStatus = errors.length > 0 ? 'completed_with_errors' : 'completed'
    
    // Update the run record with completion status
    try {
      await updateRunRecord(supabase, {
        id: runId,
        status: finalStatus,
        completedAt,
        errorMessage: errors.length > 0 ? errors.join('; ') : null,
      })
    } catch (updateError) {
      console.error('Failed to update run record:', updateError)
    }
    
    const runPayload: RunPayload = {
      id: runId,
      status: finalStatus,
      modelVersion,
      analysisMode: analysisType,
      startedAt,
      completedAt,
      errorMessage: errors.length > 0 ? errors.join('; ') : null,
    }
    
    const response: RunResponsePayload = {
      run: runPayload,
      analysis: analysisType === 'screening' 
        ? { results: screeningResults }
        : { companies: companiesResults }
    }
    
    res.status(200).json({ success: true, ...response })
  } catch (error: any) {
    console.error('AI analysis error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

// Get analysis history or specific run
app.get('/api/ai-analysis', async (req, res) => {
  try {
    const supabase = getSupabase()
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase credentials not configured' })
    }

    const runIdParam = req.query.runId
    const historyParam = req.query.history

    if (runIdParam) {
      const runId = Array.isArray(runIdParam) ? runIdParam[0] : runIdParam
      const payload = await fetchRunDetail(supabase, runId)
      if (!payload) {
        return res.status(404).json({ success: false, error: 'Run not found' })
      }
      return res.status(200).json({ success: true, ...payload })
    }

    if (historyParam !== undefined) {
      const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit
      const limit = Math.min(Math.max(parseInt(limitRaw || '5', 10) || 5, 1), 25)
      const history = await fetchRunHistory(supabase, limit)
      return res.status(200).json({ success: true, data: history })
    }

    return res.status(400).json({ success: false, error: 'Specify runId or history query parameter' })
  } catch (error: any) {
    console.error('Get analysis error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

// Standardized API endpoints
app.get('/api/analysis-runs', async (req, res) => {
  try {
    const supabase = getSupabase()
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase credentials not configured' })
    }

    // Extract query parameters
    const page = Math.max(parseInt(req.query.page as string || '1', 10) || 1, 1)
    const limit = Math.min(Math.max(parseInt(req.query.limit as string || '20', 10) || 20, 1), 100)
    const search = req.query.search as string
    const analysisMode = req.query.analysis_mode as string
    const templateId = req.query.template_id as string
    const dateFrom = req.query.date_from as string
    const dateTo = req.query.date_to as string
    const status = req.query.status as string
    const sortBy = req.query.sort_by as string || 'date'
    const sortOrder = req.query.sort_order as string || 'desc'

    const filters = {
      search,
      analysisMode,
      templateId,
      dateFrom,
      dateTo,
      status,
      sortBy,
      sortOrder,
      page,
      limit
    }

    const result = await fetchAnalysisRuns(supabase, filters)
    
    res.status(200).json({ 
      success: true, 
      runs: result.runs,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages
    })
  } catch (error: any) {
    console.error('Get analysis runs error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

// Delete analysis run endpoint
app.delete('/api/analysis-runs/:runId', async (req, res) => {
  try {
    const supabase = getSupabase()
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase credentials not configured' })
    }

    const { runId } = req.params

    // Delete related records first (due to foreign key constraints)
    const { error: auditError } = await supabase
      .from('ai_analysis_audit')
      .delete()
      .eq('run_id', runId)

    if (auditError) {
      console.error('Error deleting audit records:', auditError)
    }

    const { error: metricsError } = await supabase
      .from('ai_analysis_metrics')
      .delete()
      .eq('run_id', runId)

    if (metricsError) {
      console.error('Error deleting metrics records:', metricsError)
    }

    const { error: sectionsError } = await supabase
      .from('ai_analysis_sections')
      .delete()
      .eq('run_id', runId)

    if (sectionsError) {
      console.error('Error deleting sections records:', sectionsError)
    }

    const { error: companyError } = await supabase
      .from('ai_company_analysis')
      .delete()
      .eq('run_id', runId)

    if (companyError) {
      console.error('Error deleting company analysis records:', companyError)
    }

    const { error: screeningError } = await supabase
      .from('ai_screening_results')
      .delete()
      .eq('run_id', runId)

    if (screeningError) {
      console.error('Error deleting screening results:', screeningError)
    }

    // Finally delete the main run record
    const { error: runError } = await supabase
      .from('ai_analysis_runs')
      .delete()
      .eq('id', runId)

    if (runError) {
      console.error('Error deleting run record:', runError)
      return res.status(500).json({ success: false, error: 'Failed to delete analysis run' })
    }

    res.status(200).json({ success: true, message: 'Analysis run deleted successfully' })
  } catch (error: any) {
    console.error('Delete analysis run error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

app.get('/api/analysis-runs/:runId', async (req, res) => {
  try {
    const supabase = getSupabase()
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase credentials not configured' })
    }

    const { runId } = req.params
    const payload = await fetchRunDetail(supabase, runId)
    
    if (!payload) {
      return res.status(404).json({ success: false, error: 'Run not found' })
    }
    
    res.status(200).json({ success: true, ...payload })
  } catch (error: any) {
    console.error('Get analysis run detail error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

app.get('/api/analysis-companies', async (req, res) => {
  try {
    const supabase = getSupabase()
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase credentials not configured' })
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit as string || '20', 10) || 20, 1), 100)
    const offset = Math.max(parseInt(req.query.offset as string || '0', 10) || 0, 0)
    
    const { data: analysisData, error } = await supabase
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
        executive_summary,
        key_findings,
        narrative,
        strengths,
        weaknesses,
        opportunities,
        risks,
        acquisition_interest,
        financial_health_score,
        growth_outlook,
        market_position,
        target_price_msek
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Database error:', error)
      return res.status(500).json({ success: false, error: 'Database error' })
    }

    // Transform data for frontend (snake_case to camelCase)
    const transformedData = (analysisData || []).map(item => ({
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
      // financialMetrics: stored in ai_analysis_metrics table, not in ai_company_analysis
      nextSteps: item.next_steps || [],
      createdAt: item.created_at,
      // Enhanced Codex fields
      executiveSummary: item.executive_summary,
      keyFindings: item.key_findings,
      narrative: item.narrative,
      strengths: item.strengths,
      weaknesses: item.weaknesses,
      opportunities: item.opportunities,
      risks: item.risks,
      acquisitionInterest: item.acquisition_interest,
      financialHealth: item.financial_health_score,
      growthPotential: item.growth_outlook,
      marketPosition: item.market_position,
      targetPrice: item.target_price_msek
    }))

    res.status(200).json({ 
      success: true, 
      data: transformedData,
      pagination: {
        limit,
        offset,
        total: transformedData.length
      }
    })
  } catch (error: any) {
    console.error('Get analysis companies error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

// Helper function to transform new schema data to old format for compatibility
function transformCompanyData(row: any): any {
  // Extract segment names from JSONB array - return as JSON string for frontend parsing
  let segmentNames: string[] = []
  if (row.segment_names) {
    if (Array.isArray(row.segment_names)) {
      segmentNames = row.segment_names
    } else if (typeof row.segment_names === 'string') {
      try {
        segmentNames = JSON.parse(row.segment_names)
      } catch {
        segmentNames = [row.segment_names]
      }
    } else {
      segmentNames = [row.segment_names]
    }
  }
  // Return as JSON string so frontend can parse it
  const segmentNameJson = segmentNames.length > 0 ? JSON.stringify(segmentNames) : null
  
  // Extract address fields from JSONB
  let addressStr: string | undefined
  let cityStr: string | undefined
  let addressObj: any = null
  
  // First try to get city from address field
  if (row.address) {
    if (typeof row.address === 'string') {
      // Try to parse as JSON string first (SQLite stores JSON as text)
      try {
        const parsed = JSON.parse(row.address)
        if (typeof parsed === 'object' && parsed !== null) {
          addressObj = parsed
        } else {
          addressStr = row.address
          // Try to extract city from string address (e.g., "Street 123, 12345 City")
          const cityMatch = row.address.match(/\d{5}\s+([^,]+)$/)
          if (cityMatch) {
            cityStr = cityMatch[1].trim()
          }
        }
      } catch {
        // Not JSON, treat as plain string
        addressStr = row.address
        // Try to extract city from string address (e.g., "Street 123, 12345 City")
        const cityMatch = row.address.match(/\d{5}\s+([^,]+)$/)
        if (cityMatch) {
          cityStr = cityMatch[1].trim()
        }
      }
    } else if (typeof row.address === 'object') {
      // Address is already an object
      addressObj = row.address
    }
    
    // Extract from address object if we have one
    if (addressObj) {
      // Try to get address from visitorAddress, mainOffice, or location
      const addr = addressObj.visitorAddress || addressObj.mainOffice || addressObj.location || addressObj.domicile || addressObj
      
      // Extract city
      cityStr = addr.postPlace || addr.city || addressObj.postPlace || addressObj.city
      
      // Build full address string
      const parts: string[] = []
      if (addr.addressLine || addressObj.addressLine) {
        parts.push(addr.addressLine || addressObj.addressLine)
      }
      if (addr.postCode || addressObj.postCode) {
        parts.push(addr.postCode || addressObj.postCode)
      }
      if (cityStr) {
        parts.push(cityStr)
      }
      
      if (parts.length > 0) {
        addressStr = parts.join(', ')
      } else if (addr.addressLine || addressObj.addressLine) {
        addressStr = addr.addressLine || addressObj.addressLine
      }
    }
  }
  
  // Fallback: Extract city from raw_json if address field is empty
  if (!cityStr && row.raw_json) {
    try {
      const rawData = typeof row.raw_json === 'string' ? JSON.parse(row.raw_json) : row.raw_json
      
      // Check top-level company object
      if (rawData?.company) {
        const company = rawData.company
        
        // Try multiple possible locations for city/postPlace in company object
        cityStr = company.visitorAddress?.postPlace || 
                  company.mainOffice?.postPlace || 
                  company.location?.postPlace ||
                  company.visitorAddress?.city ||
                  company.mainOffice?.city ||
                  company.location?.city ||
                  company.postPlace ||
                  company.city ||
                  company.domicile?.postPlace ||
                  company.domicile?.city
        
        // Also extract address if available
        if (!addressStr) {
          addressStr = company.visitorAddress?.addressLine ||
                      company.mainOffice?.addressLine ||
                      company.location?.addressLine ||
                      company.addressLine ||
                      company.domicile?.addressLine
        }
      }
      
      // Also check pageProps.company structure (some Allabolag responses use this)
      if (!cityStr && rawData?.pageProps?.company) {
        const company = rawData.pageProps.company
        cityStr = company.visitorAddress?.postPlace || 
                  company.mainOffice?.postPlace || 
                  company.location?.postPlace ||
                  company.visitorAddress?.city ||
                  company.mainOffice?.city ||
                  company.location?.city ||
                  company.postPlace ||
                  company.city ||
                  company.domicile?.postPlace ||
                  company.domicile?.city
        
        if (!addressStr) {
          addressStr = company.visitorAddress?.addressLine ||
                      company.mainOffice?.addressLine ||
                      company.location?.addressLine ||
                      company.addressLine ||
                      company.domicile?.addressLine
        }
      }
      
      // Debug logging if we still don't have city (only log first few to avoid spam)
      if (!cityStr && process.env.NODE_ENV === 'development' && Math.random() < 0.01) {
        console.log(`[City Extraction] No city found for ${row.orgnr}, raw_json structure:`, 
          rawData?.company ? `Has company object with keys: ${Object.keys(rawData.company).slice(0, 10).join(', ')}` : 'No company object',
          rawData?.pageProps?.company ? `Has pageProps.company` : 'No pageProps.company')
      }
    } catch (e) {
      // Failed to parse raw_json, ignore
      if (process.env.NODE_ENV === 'development') {
        console.log(`[City Extraction] Error parsing raw_json for ${row.orgnr}:`, e)
      }
    }
  }

  return {
    OrgNr: row.orgnr,
    name: row.company_name,
    segment_name: segmentNameJson, // Return as JSON string for frontend to parse
    city: row.city || cityStr || null,
    employees: row.employees_latest || null,
    // Database stores values in thousands (as-is from Allabolag)
    revenue: row.latest_revenue_sek ? row.latest_revenue_sek.toString() : null,
    profit: row.latest_profit_sek ? row.latest_profit_sek.toString() : null,
    // Return values as-is (in thousands) - frontend will format as MSEK by dividing by 1,000
    SDI: row.latest_revenue_sek || null,
    DR: row.latest_profit_sek || null,
    ORS: row.latest_ebitda_sek || null,
    Revenue_growth: row.revenue_cagr_3y || null,
    EBIT_margin: row.avg_ebitda_margin || null,
    NetProfit_margin: row.avg_net_margin || null,
    digital_presence: row.digital_presence || false,
    incorporation_date: row.foundation_year ? `${row.foundation_year}-01-01` : null,
    email: row.email || null,
    homepage: row.homepage || null,
    address: addressStr || null
  }
}

function parseNumberParam(value: any): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function buildCompanyFilterClauses(query: any): { whereSql: string; params: any[] } {
  const clauses: string[] = []
  const params: any[] = []

  const addClause = (clause: string, ...values: any[]) => {
    clauses.push(clause)
    params.push(...values)
  }

  const searchTerm = typeof query.search === 'string' ? query.search.trim() : undefined
  if (searchTerm) {
    const pattern = `%${searchTerm}%`
    addClause('(c.company_name LIKE ? OR c.orgnr LIKE ?)', pattern, pattern)
  }

  const industry = typeof query.industry === 'string' ? query.industry.trim() : undefined
  if (industry) {
    const pattern = `%${industry}%`
    addClause('(c.segment_names LIKE ? OR c.nace_categories LIKE ?)', pattern, pattern)
  }

  const city = typeof query.city === 'string' ? query.city.trim() : undefined
  if (city) {
    const pattern = `%${city}%`
    addClause('(c.city LIKE ? OR c.address LIKE ?)', pattern, pattern)
  }

  const minEmployees = parseNumberParam(query.minEmployees)
  if (minEmployees !== undefined) {
    addClause('(c.employees_latest IS NOT NULL AND c.employees_latest >= ?)', minEmployees)
  }

  const maxEmployees = parseNumberParam(query.maxEmployees)
  if (maxEmployees !== undefined) {
    addClause('(c.employees_latest IS NOT NULL AND c.employees_latest <= ?)', maxEmployees)
  }

  const minRevenue = parseNumberParam(query.minRevenue)
  if (minRevenue !== undefined) {
    addClause('COALESCE(k.latest_revenue_sek, 0) >= ?', minRevenue)
  }

  const maxRevenue = parseNumberParam(query.maxRevenue)
  if (maxRevenue !== undefined) {
    addClause('COALESCE(k.latest_revenue_sek, 0) <= ?', maxRevenue)
  }

  const minProfit = parseNumberParam(query.minProfit)
  if (minProfit !== undefined) {
    addClause('COALESCE(k.latest_profit_sek, 0) >= ?', minProfit)
  }

  const maxProfit = parseNumberParam(query.maxProfit)
  if (maxProfit !== undefined) {
    addClause('COALESCE(k.latest_profit_sek, 0) <= ?', maxProfit)
  }

  const minRevenueGrowth = parseNumberParam(query.minRevenueGrowth)
  if (minRevenueGrowth !== undefined) {
    addClause('COALESCE(k.revenue_cagr_3y, 0) >= ?', minRevenueGrowth)
  }

  const maxRevenueGrowth = parseNumberParam(query.maxRevenueGrowth)
  if (maxRevenueGrowth !== undefined) {
    addClause('COALESCE(k.revenue_cagr_3y, 0) <= ?', maxRevenueGrowth)
  }

  const minEbit = parseNumberParam(query.minEBITAmount)
  if (minEbit !== undefined) {
    addClause('COALESCE(k.latest_ebit_sek, k.latest_ebitda_sek, 0) >= ?', minEbit)
  }

  const maxEbit = parseNumberParam(query.maxEBITAmount)
  if (maxEbit !== undefined) {
    addClause('COALESCE(k.latest_ebit_sek, k.latest_ebitda_sek, 0) <= ?', maxEbit)
  }

  const profitability = typeof query.profitability === 'string' ? query.profitability.trim() : undefined
  if (profitability) {
    addClause('k.profitability_bucket = ?', profitability)
  }

  const size = typeof query.size === 'string' ? query.size.trim() : undefined
  if (size) {
    addClause('k.company_size_bucket = ?', size)
  }

  const growthBucket = typeof query.growth === 'string' ? query.growth.trim() : undefined
  if (growthBucket) {
    addClause('k.growth_bucket = ?', growthBucket)
  }

  return {
    whereSql: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '',
    params
  }
}

app.get('/api/companies', async (req, res) => {
  try {
    if (!localDBExists()) {
      return res.status(500).json({ success: false, error: 'Local database not found' })
    }

    const db = getLocalDB()
    const orgnr = req.query.orgnr ? String(req.query.orgnr).trim() : null
    
    // Debug logging
    console.log('[API /api/companies] orgnr param:', orgnr, 'all query:', req.query)
    
    // If orgnr is provided, return single company with historical data
    if (orgnr) {
      // Get company with metrics and raw_json for address data
      const companyQuery = `
        SELECT 
          c.orgnr,
          c.company_name,
          c.segment_names,
          c.address,
          c.city,
          c.employees_latest,
          c.homepage,
          c.email,
          c.foundation_year,
          k.latest_revenue_sek,
          k.latest_profit_sek,
          k.latest_ebitda_sek,
          k.revenue_cagr_3y,
          k.avg_ebitda_margin,
          k.avg_net_margin,
          k.digital_presence,
          k.company_size_bucket,
          k.growth_bucket,
          k.profitability_bucket,
          k.latest_year
        FROM companies c
        LEFT JOIN company_kpis k ON c.orgnr = k.orgnr
        WHERE c.orgnr = ?
      `
      const companyStmt = db.prepare(companyQuery)
      const companyRow = companyStmt.get(orgnr) as any
      
      if (!companyRow) {
        return res.status(404).json({ success: false, error: 'Company not found' })
      }
      
      // Debug: Check if raw_json is fetched
      if (process.env.NODE_ENV === 'development') {
        console.log(`[API /api/companies] Company ${orgnr} - has raw_json:`, !!companyRow.raw_json)
        if (companyRow.raw_json) {
          try {
            const parsed = typeof companyRow.raw_json === 'string' ? JSON.parse(companyRow.raw_json) : companyRow.raw_json
            console.log(`[API /api/companies] raw_json company keys:`, parsed?.company ? Object.keys(parsed.company).slice(0, 10) : 'No company object')
          } catch (e) {
            console.log(`[API /api/companies] Error parsing raw_json:`, e)
          }
        }
      }

      // Get historical financial data
      const historicalQuery = `
        SELECT 
          year,
          sdi_sek,
          rg_sek,
          dr_sek
        FROM financials
        WHERE orgnr = ? AND period = '12'
        ORDER BY year DESC
        LIMIT 4
      `
      const historicalStmt = db.prepare(historicalQuery)
      const historicalRows = historicalStmt.all(orgnr) as Array<{year: number, sdi_sek: number | null, rg_sek: number | null, dr_sek: number | null}>
      
      const historicalData = historicalRows.map(row => ({
        year: row.year,
        SDI: row.sdi_sek,
        RG: row.rg_sek,
        DR: row.dr_sek
      }))

      // Transform company data
      const transformedCompany = transformCompanyData(companyRow)
      
      // Add historical data
      ;(transformedCompany as any).historicalData = historicalData
      ;(transformedCompany as any).year = companyRow.latest_year || historicalData[0]?.year || 2023

      return res.status(200).json({
        success: true,
        company: transformedCompany
      })
    }

    // Otherwise, return list of companies
    const limit = Math.min(Math.max(parseInt(req.query.limit as string || '50', 10) || 50, 1), 200)
    const offset = Math.max(parseInt(req.query.offset as string || '0', 10) || 0, 0)
    const { whereSql, params: filterParams } = buildCompanyFilterClauses(req.query)

    // Build query with JOIN companies + company_kpis
    let query = `
      SELECT 
        c.orgnr,
        c.company_name,
        c.segment_names,
        c.address,
        c.city,
        c.employees_latest,
        c.homepage,
        c.email,
        c.foundation_year,
        k.latest_revenue_sek,
        k.latest_profit_sek,
        k.latest_ebitda_sek,
        k.revenue_cagr_3y,
        k.avg_ebitda_margin,
        k.avg_net_margin,
        k.digital_presence,
        k.company_size_bucket,
        k.growth_bucket,
        k.profitability_bucket
      FROM companies c
      LEFT JOIN company_kpis k ON c.orgnr = k.orgnr
    `
    query += `${whereSql} ORDER BY COALESCE(k.latest_revenue_sek, 0) DESC, c.company_name ASC LIMIT ? OFFSET ?`

    const stmt = db.prepare(query)
    const companies = stmt.all(...filterParams, limit, offset) as any[]

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM companies c
      LEFT JOIN company_kpis k ON c.orgnr = k.orgnr
    `
    countQuery += whereSql
    const countStmt = db.prepare(countQuery)
    const countResult = countStmt.get(...filterParams) as { total: number }
    const total = countResult.total || 0

    // Transform to old format for compatibility
    const transformedCompanies = companies.map((row: any) => {
      return transformCompanyData(row)
    })

    res.status(200).json({
      success: true,
      companies: transformedCompanies,
      pagination: {
        limit,
        offset,
        total
      }
    })
  } catch (error: any) {
    console.error('Get companies error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

app.get('/api/companies/orgnrs', async (req, res) => {
  try {
    if (!localDBExists()) {
      return res.status(500).json({ success: false, error: 'Local database not found' })
    }

    const db = getLocalDB()
    const { whereSql, params } = buildCompanyFilterClauses(req.query)
    const query = `
      SELECT c.orgnr
      FROM companies c
      LEFT JOIN company_kpis k ON c.orgnr = k.orgnr
      ${whereSql}
      ORDER BY c.orgnr ASC
    `
    const stmt = db.prepare(query)
    const rows = stmt.all(...params) as Array<{ orgnr: string }>
    res.status(200).json({
      success: true,
      orgnrs: rows.map(row => row.orgnr)
    })
  } catch (error: any) {
    console.error('Get company orgnrs error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

// Helper functions
async function insertRunRecord(supabase: SupabaseClient, run: any) {
  // Ensure initiated_by is never null
  const initiatedBy = run.initiatedBy || 'unknown-user'
  
  const { error } = await supabase
    .from('ai_analysis_runs')
    .insert([{
      id: run.id,
      initiated_by: initiatedBy,
      model_version: run.modelVersion,
      analysis_mode: run.analysisMode,
      status: run.status,
      started_at: run.startedAt,
      completed_at: run.completedAt,
      error_message: run.errorMessage,
      analysis_template_id: run.templateId,
      analysis_template_name: run.templateName,
      custom_instructions: run.customInstructions,
      company_count: run.companyCount
    }])
  
  if (error) {
    console.error('Error inserting run record:', error)
    throw new Error(`Failed to create analysis run: ${error.message}`)
  }
}

async function updateRunRecord(supabase: SupabaseClient, run: any) {
  const { error } = await supabase
    .from('ai_analysis_runs')
    .update({
      status: run.status,
      completed_at: run.completedAt,
      error_message: run.errorMessage
    })
    .eq('id', run.id)
  
  if (error) {
    console.error('Error updating run record:', error)
    throw new Error(`Failed to update analysis run: ${error.message}`)
  }
}

async function processScreeningBatch(
  supabase: SupabaseClient,
  openai: OpenAI,
  runId: string,
  batch: CompanySelection[],
  instructions?: string
): Promise<{ results: ScreeningResult[], issues: QualityIssue[] }> {
  const results: ScreeningResult[] = []
  const allIssues: QualityIssue[] = []
  
  for (const selection of batch) {
    const orgnr = selection.OrgNr || selection.orgnr || ''
    if (!orgnr) {
      allIssues.push(createQualityIssue(
        'warning',
        'Missing organization number',
        { selection }
      ))
      continue
    }
    
    try {
      // Use enhanced data fetching with quality tracking
      const dataResult = await fetchComprehensiveCompanyData(supabase, orgnr)
      allIssues.push(...dataResult.issues)
      
      if (!dataResult.success || !dataResult.data) {
        allIssues.push(createQualityIssue(
          'critical', 
          `Failed to load data for ${orgnr}`,
          { orgnr, issues: dataResult.issues }
        ))
        continue
      }
      
      const companyData = dataResult.data
      
      // Create enhanced screening prompt with comprehensive data
      const prompt = createEnhancedScreeningPrompt(companyData, instructions)

      const startTime = Date.now()
      
      // Call OpenAI API
      const response = await openai.chat.completions.create({
        model: MODEL_SCREENING,
        messages: [
          {
            role: 'system',
            content: 'Du är en expert på svenska företagsanalys och förvärv. Ge korta, precisa bedömningar.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 200
      })
      
      const latency = Date.now() - startTime
      const content = response.choices[0]?.message?.content || '{}'
      
      // Parse response - handle markdown code blocks
      let parsedResult
      try {
        // Remove markdown code blocks if present
        let cleanContent = content.trim()
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
        } else if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
        }
        parsedResult = JSON.parse(cleanContent)
      } catch (e) {
        console.error('JSON parsing failed:', e)
        console.error('Content was:', content)
        // Fallback if JSON parsing fails
        parsedResult = {
          screeningScore: 50,
          riskFlag: 'Medium',
          briefSummary: 'Automatisk analys - JSON parsing misslyckades'
        }
      }
      
      const result: ScreeningResult = {
        orgnr,
        companyName: companyData.masterData.name,
        screeningScore: parsedResult.screeningScore || 50,
        riskFlag: parsedResult.riskFlag || 'Medium',
        briefSummary: parsedResult.briefSummary || 'Ingen sammanfattning tillgänglig',
        audit: {
          prompt,
          response: content,
          latency_ms: latency,
          prompt_tokens: response.usage?.prompt_tokens || 0,
          completion_tokens: response.usage?.completion_tokens || 0,
          cost_usd: ((response.usage?.prompt_tokens || 0) * SCREENING_PROMPT_COST_PER_1K + 
                     (response.usage?.completion_tokens || 0) * SCREENING_COMPLETION_COST_PER_1K) / 1000
        }
      }
      
      results.push(result)
      
      // Save to database
      await supabase
        .from('ai_screening_results')
        .insert([{
          run_id: runId,
          orgnr,
          company_name: companyData.masterData.name,
          screening_score: result.screeningScore,
          risk_flag: result.riskFlag,
          brief_summary: result.briefSummary,
          audit_prompt: result.audit.prompt,
          audit_response: result.audit.response,
          audit_latency_ms: result.audit.latency_ms,
          audit_prompt_tokens: result.audit.prompt_tokens,
          audit_completion_tokens: result.audit.completion_tokens,
          audit_cost_usd: result.audit.cost_usd
        }])
      
    } catch (error: any) {
      console.error(`Error processing screening for ${orgnr}:`, error)
      allIssues.push(createQualityIssue(
        'critical',
        `Processing error for ${orgnr}: ${error.message}`,
        { orgnr, error: error.message }
      ))
      // Add error result
      results.push({
        orgnr,
        companyName: selection.name || 'Unknown',
        screeningScore: null,
        riskFlag: null,
        briefSummary: `Fel vid analys: ${error.message}`,
        audit: {
          prompt: 'Error occurred',
          response: error.message,
          latency_ms: 0,
          prompt_tokens: 0,
          completion_tokens: 0,
          cost_usd: 0
        }
      })
    }
  }
  
  return { results, issues: allIssues }
}

/**
 * Create enhanced screening prompt with comprehensive data
 */
function createEnhancedScreeningPrompt(companyData: any, instructions?: string): string {
  const { masterData, historicalData, trends, benchmarks } = companyData
  
  // Format historical data
  const historicalText = historicalData.length > 0 
    ? historicalData.map(year => 
        `${year.year}: Omsättning ${(year.SDI/1_000_000).toFixed(1)} MSEK | EBIT ${(year.EBIT/1_000_000).toFixed(1)} MSEK | Vinst ${(year.DR/1_000_000).toFixed(1)} MSEK`
      ).join('\n')
    : 'Begränsad historisk data tillgänglig'
  
  // Get industry context
  const industryContext = getCompanyContext(masterData, benchmarks)
  
  return `FÖRETAG: ${masterData.name} (${masterData.OrgNr})
Bransch: ${masterData.segment_name} | Stad: ${masterData.city} | Anställda: ${masterData.employees}

FINANSIELL HISTORIK (${historicalData.length} år):
${historicalText}

TILLVÄXTTRENDER:
- Omsättning CAGR: ${(trends.revenueCagr * 100).toFixed(1)}%
- EBIT-utveckling: ${trends.ebitTrend}
- Vinstmarginal trend: ${trends.marginTrend}
- Konsistens: ${trends.consistencyScore.toFixed(0)}/100

FINANSIELL ÖVERSIKT (senaste år):
- Omsättning (SDI): ${(masterData.SDI/1_000_000).toFixed(1)} MSEK
- Nettoresultat (DR): ${(masterData.DR/1_000_000).toFixed(1)} MSEK
- Rörelseresultat (ORS): ${(masterData.ORS/1_000_000).toFixed(1)} MSEK
- Anställda: ${masterData.employees} personer

LÖNSAMHETSANALYS:
- EBIT-marginal: ${(masterData.EBIT_margin * 100).toFixed(1)}% (branschsnitt: ${benchmarks.avgEbitMargin.toFixed(1)}%)
- Nettovinstmarginal: ${(masterData.NetProfit_margin * 100).toFixed(1)}%
- Avkastning på eget kapital: ${masterData.roe ? masterData.roe.toFixed(1) : 'Okänt'}%

INDUSTRY CONTEXT:
${industryContext}

${instructions ? `Specifika instruktioner: ${instructions}` : ''}

Ge en snabb bedömning (1-100 poäng) baserat på:
- Finansiell stabilitet (lönsamhet, vinstmarginaler, konsistens)
- Tillväxttrajektoria (CAGR, trend, konsistens)
- Lönsamhetsutveckling (marginaler, branschjämförelse)
- Förvärvsattraktivitet (storlek, bransch, digital närvaro)

VIKTIGT: Var specifik och unik för detta företag. Använd de exakta siffrorna från finansiell data ovan. 
Ge olika poäng och risknivåer baserat på företagets unika förhållanden.

Svara ENDAST med giltig JSON utan markdown-formatering:
{
  "screeningScore": 50,
  "riskFlag": "Medium",
  "briefSummary": "Kort sammanfattning på 2-3 meningar som refererar till specifika siffror från företaget"
}

VIKTIGT: Svara ENDAST med JSON-objektet ovan, utan ytterligare text eller markdown-formatering.`
}

/**
 * Create enhanced deep analysis prompt with comprehensive data
 */
function createEnhancedDeepAnalysisPrompt(companyData: any, instructions?: string): string {
  const { masterData, historicalData, trends, benchmarks } = companyData
  
  // Format historical data
  const historicalText = historicalData.length > 0 
    ? historicalData.map(year => 
        `${year.year}: Omsättning ${(year.SDI/1_000_000).toFixed(1)} MSEK | EBIT ${(year.EBIT/1_000_000).toFixed(1)} MSEK | Vinst ${(year.DR/1_000_000).toFixed(1)} MSEK`
      ).join('\n')
    : 'Begränsad historisk data tillgänglig'
  
  // Get industry context
  const industryContext = getCompanyContext(masterData, benchmarks)
  
  return `Genomför en djupgående förvärvsanalys av detta svenska företag:

FÖRETAG: ${masterData.name} (${masterData.OrgNr})
Bransch: ${masterData.segment_name} | Stad: ${masterData.city} | Grundat: ${masterData.incorporation_date || 'Okänt'}
Adress: ${masterData.address || 'Okänt'} | Hemsida: ${masterData.homepage || 'Okänt'}
E-post: ${masterData.email || 'Okänt'} | Anställda: ${masterData.employees || 'Okänt'}

FINANSIELL HISTORIK (${historicalData.length} år):
${historicalText}

TILLVÄXTTRENDER:
- Omsättning CAGR: ${(trends.revenueCagr * 100).toFixed(1)}%
- EBIT-utveckling: ${trends.ebitTrend}
- Vinstmarginal trend: ${trends.marginTrend}
- Konsistens: ${trends.consistencyScore.toFixed(0)}/100
- Volatilitet: ${trends.volatilityIndex.toFixed(1)}%

- BALANSRÄKNING (begränsad data):
- Omsättning (SDI): ${(masterData.SDI/1_000_000).toFixed(1)} MSEK
- Nettoresultat (DR): ${(masterData.DR/1_000_000).toFixed(1)} MSEK
- Rörelseresultat (ORS): ${(masterData.ORS/1_000_000).toFixed(1)} MSEK
- Anställda: ${masterData.employees} personer
- Omsättning per anställd: ${
    masterData.employees ? (masterData.SDI / masterData.employees / 1000).toFixed(0) : 'N/A'
  } kSEK

LÖNSAMHETSANALYS:
- EBIT-marginal: ${(masterData.EBIT_margin * 100).toFixed(1)}% (branschsnitt: ${benchmarks.avgEbitMargin.toFixed(1)}%)
- Nettovinstmarginal: ${(masterData.NetProfit_margin * 100).toFixed(1)}%
- Avkastning på eget kapital: ${masterData.roe ? masterData.roe.toFixed(1) : 'Okänt'}%
- Kassaflöde/vinst: ${masterData.cash_flow_ratio ? masterData.cash_flow_ratio.toFixed(2) : 'Okänt'}

INDUSTRY CONTEXT:
${industryContext}

DIGITAL NÄRVARO: ${masterData.digital_presence ? 'Ja' : 'Nej'}

${instructions ? `SPECIFIKA INSTRUKTIONER: ${instructions}` : ''}

Genomför en omfattande analys baserad på de faktiska finansiella nyckeltalen från allabolag.se och historisk data.

VIKTIGT: Var specifik och unik för detta företag. Använd de exakta siffrorna från finansiell data ovan. 
Ge olika betyg, poäng och rekommendationer baserat på företagets unika förhållanden.

Analysera med fokus på:
1. Finansiell stabilitet baserat på lönsamhet och tillväxt
2. Tillväxttrajektoria - är tillväxten hållbar eller avtagande?
3. Lönsamhetsutveckling - förbättras marginalerna?
4. Kapitaleffektivitet - hur väl omsätter företaget omsättning till vinst?
5. Marknadsposition - storlek och branschposition

BERÄKNA MÅLPRIS baserat på:
- Omsättningsmultipel: 0.8-2.5x omsättning (beroende på bransch och tillväxt)
- Vinstmultipel: 5-15x nettoresultat (beroende på stabilitet och tillväxt)
- Anpassa för bransch, storlek och tillväxtpotential

GE SPECIFIKA SVAR för varje metrik med hänvisning till exakta siffror.

Svara ENDAST med giltig JSON utan markdown-formatering:

{
  "executiveSummary": "Kort executive summary på 2-3 meningar som refererar till specifika siffror",
  "keyFindings": [
    "Viktigt fynd 1 med specifika siffror",
    "Viktigt fynd 2 med specifika siffror",
    "Viktigt fynd 3 med specifika siffror"
  ],
  "narrative": "Detaljerad analys på 3-4 stycken som täcker finansiell hälsa, marknadsposition, tillväxtpotential och förvärvsattraktivitet med hänvisning till exakta siffror",
  "strengths": [
    "Styrka 1 med specifika siffror",
    "Styrka 2 med specifika siffror"
  ],
  "weaknesses": [
    "Svaghet 1 med specifika siffror",
    "Svaghet 2 med specifika siffror"
  ],
  "opportunities": [
    "Möjlighet 1 med specifika siffror",
    "Möjlighet 2 med specifika siffror"
  ],
  "risks": [
    "Risk 1 med specifika siffror",
    "Risk 2 med specifika siffror"
  ],
  "acquisitionInterest": "Hög/Medium/Låg",
  "financialHealth": 5,
  "growthPotential": "Medium",
  "marketPosition": "Medium",
  "targetPrice": 0,
  "recommendation": "Pursue/Consider/Monitor/Pass",
  "confidence": 3.0,
  "riskScore": 5,
  "financialGrade": "A/B/C/D",
  "commercialGrade": "A/B/C/D",
  "operationalGrade": "A/B/C/D",
  "nextSteps": [
    "Nästa steg 1",
    "Nästa steg 2"
  ]
}

VIKTIGT: Svara ENDAST med JSON-objektet ovan, utan ytterligare text eller markdown-formatering.`
}

async function processDeepAnalysis(
  supabase: SupabaseClient,
  openai: OpenAI,
  runId: string,
  selection: CompanySelection,
  instructions?: string
): Promise<CompanyResult | null> {
  const orgnr = selection.OrgNr || selection.orgnr || ''
  if (!orgnr) return null
  
  try {
    // Use enhanced data fetching with quality tracking
    const dataResult = await fetchComprehensiveCompanyData(supabase, orgnr)
    
    if (!dataResult.success || !dataResult.data) {
      console.error(`Failed to load comprehensive data for ${orgnr}:`, dataResult.issues)
      return null
    }
    
    const companyData = dataResult.data
    
    // Create enhanced deep analysis prompt with comprehensive data
    const prompt = createEnhancedDeepAnalysisPrompt(companyData, instructions)

    const startTime = Date.now()
    
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: MODEL_DEFAULT,
      messages: [
        {
          role: 'system',
          content: 'Du är en expert på svenska företagsanalys och förvärv. Ge detaljerade, professionella bedömningar baserat på finansiell data och marknadsanalys.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1500
    })
    
    const latency = Date.now() - startTime
    const content = response.choices[0]?.message?.content || '{}'
    
    // Parse response - handle markdown code blocks
    let parsedResult
    try {
      // Remove markdown code blocks if present
      let cleanContent = content.trim()
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
      }
      parsedResult = JSON.parse(cleanContent)
    } catch (e) {
      console.error('Failed to parse AI response:', e)
      console.error('Content was:', content)
      // Fallback result
      parsedResult = {
        executiveSummary: 'Analys misslyckades - JSON parsing fel',
        keyFindings: ['Tekniskt fel vid analys'],
        narrative: 'Detaljerad analys kunde inte genomföras på grund av tekniska problem.',
        strengths: [],
        weaknesses: [],
        opportunities: [],
        risks: [],
        acquisitionInterest: 'Medel',
        financialHealth: 5,
        growthPotential: 'Medel',
        marketPosition: 'Medel',
        targetPrice: null,
        recommendation: 'Consider',
        confidence: 2.0,
        riskScore: 3,
        financialGrade: 'C',
        commercialGrade: 'C',
        operationalGrade: 'C',
        nextSteps: ['Tekniskt fel - försök igen']
      }
    }
    
    const result: CompanyResult = {
      orgnr,
      companyName: companyData.masterData.name,
      summary: parsedResult.executiveSummary || 'Ingen sammanfattning tillgänglig',
      recommendation: parsedResult.recommendation || 'Consider',
      confidence: parsedResult.confidence || 3.0,
      riskScore: parsedResult.riskScore || 3,
      financialGrade: parsedResult.financialGrade || 'C',
      commercialGrade: parsedResult.commercialGrade || 'C',
      operationalGrade: parsedResult.operationalGrade || 'C',
      financialMetrics: parsedResult.financialMetrics || undefined,
      nextSteps: parsedResult.nextSteps || [],
      sections: [],
      metrics: [],
      audit: {
        prompt,
        response: content,
        latency_ms: latency,
        prompt_tokens: response.usage?.prompt_tokens || 0,
        completion_tokens: response.usage?.completion_tokens || 0,
        cost_usd: ((response.usage?.prompt_tokens || 0) * PROMPT_COST_PER_1K + 
                   (response.usage?.completion_tokens || 0) * COMPLETION_COST_PER_1K) / 1000
      },
      contextSummary: 'Djupgående analys baserad på finansiell data',
      // Enhanced Codex fields
      executiveSummary: parsedResult.executiveSummary,
      keyFindings: parsedResult.keyFindings,
      narrative: parsedResult.narrative,
      strengths: parsedResult.strengths,
      weaknesses: parsedResult.weaknesses,
      opportunities: parsedResult.opportunities,
      risks: parsedResult.risks,
      acquisitionInterest: parsedResult.acquisitionInterest,
      financialHealth: parsedResult.financialHealth,
      growthPotential: parsedResult.growthPotential,
      marketPosition: parsedResult.marketPosition,
      targetPrice: parsedResult.targetPrice
    }
    
    // Save to database
    await supabase
      .from('ai_company_analysis')
      .insert([{
        run_id: runId,
        orgnr,
        company_name: companyData.masterData.name,
        summary: result.summary,
        recommendation: result.recommendation,
        confidence: Math.round((result.confidence || 0) * 100), // Convert to integer
        risk_score: Math.round((result.riskScore || 0) * 10), // Convert to integer
        financial_grade: result.financialGrade,
        commercial_grade: result.commercialGrade,
        operational_grade: result.operationalGrade,
        // financial_metrics: not stored in ai_company_analysis table
        next_steps: result.nextSteps,
        executive_summary: result.executiveSummary,
        key_findings: result.keyFindings,
        narrative: result.narrative,
        strengths: result.strengths,
        weaknesses: result.weaknesses,
        opportunities: result.opportunities,
        risks: result.risks,
        acquisition_interest: result.acquisitionInterest,
        financial_health_score: Math.round((result.financialHealth || 0) * 10), // Convert to integer
        growth_outlook: result.growthPotential,
        market_position: result.marketPosition,
        target_price_msek: result.targetPrice
      }])

    // Compute and save valuations
    try {
      const profile = createCompanyProfile(companyData.masterData)
      const assumptions = await loadAllAssumptions(
        supabase, 
        profile.industry, 
        profile.sizeBucket, 
        profile.growthBucket
      )
      
      const valuations = runValuations(profile, assumptions)
      
      // Create valuation run
      const { data: valuationRun, error: runError } = await supabase
        .from('valuation_runs')
        .insert({
          analysis_run_id: runId,
          company_orgnr: orgnr,
          selected_model_key: 'hybrid_score', // Default to hybrid model
          value_type: 'equity'
        })
        .select()
        .single()

      if (!runError && valuationRun) {
        // Insert valuation results
        const resultsToInsert = valuations.map(valuation => ({
          valuation_run_id: valuationRun.id,
          model_key: valuation.modelKey,
          value_ev: valuation.valueEv,
          value_equity: valuation.valueEquity,
          basis: valuation.basis,
          multiple_used: valuation.multipleUsed,
          confidence: valuation.confidence,
          inputs: valuation.inputs,
          notes: valuation.inputs.reason
        }))

        await supabase
          .from('valuation_results')
          .insert(resultsToInsert)

        // Update target price with selected model's equity value
        const selectedValuation = valuations.find(v => v.modelKey === 'hybrid_score')
        if (selectedValuation && selectedValuation.valueEquity) {
          result.targetPrice = Math.round(selectedValuation.valueEquity / 1000) // Database stores in thousands, convert to MSEK
        }
      }
    } catch (valuationError) {
      console.error('Valuation computation failed:', valuationError)
      // Continue without valuations - don't fail the entire analysis
    }
    
    return result
    
  } catch (error: any) {
    console.error(`Error processing deep analysis for ${orgnr}:`, error)
    return null
  }
}

async function fetchRunHistory(supabase: SupabaseClient, limit: number) {
  const { data, error } = await supabase
    .from('ai_analysis_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching run history:', error)
    return []
  }

  return data || []
}

async function fetchAnalysisRuns(supabase: SupabaseClient, filters: any) {
  const { page, limit, search, analysisMode, templateId, dateFrom, dateTo, status, sortBy, sortOrder } = filters
  
  // Build the query
  let query = supabase
    .from('ai_analysis_runs')
    .select(`
      *,
      ai_company_analysis(orgnr, company_name),
      ai_screening_results(orgnr, company_name)
    `, { count: 'exact' })

  // Apply filters
  if (search) {
    query = query.or(`analysis_template_name.ilike.%${search}%,custom_instructions.ilike.%${search}%,id.ilike.%${search}%`)
  }
  
  if (analysisMode && analysisMode !== 'all') {
    query = query.eq('analysis_mode', analysisMode)
  }
  
  if (templateId && templateId !== 'all') {
    if (templateId === 'custom') {
      query = query.is('analysis_template_id', null)
    } else {
      query = query.eq('analysis_template_id', templateId)
    }
  }
  
  if (dateFrom) {
    query = query.gte('started_at', dateFrom)
  }
  
  if (dateTo) {
    query = query.lte('started_at', dateTo)
  }
  
  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  // Apply sorting
  const ascending = sortOrder === 'asc'
  switch (sortBy) {
    case 'date':
      query = query.order('started_at', { ascending })
      break
    case 'companies':
      query = query.order('company_count', { ascending })
      break
    case 'template':
      query = query.order('analysis_template_name', { ascending })
      break
    default:
      query = query.order('started_at', { ascending: false })
  }

  // Apply pagination
  const offset = (page - 1) * limit
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching analysis runs:', error)
    return { runs: [], total: 0, page, totalPages: 0 }
  }

  // Transform the data to include company information
  const runs = (data || []).map(run => {
    // Get unique companies from both tables
    const companies = new Map()
    
    // Add companies from ai_company_analysis
    if (run.ai_company_analysis) {
      run.ai_company_analysis.forEach((company: any) => {
        companies.set(company.orgnr, {
          orgnr: company.orgnr,
          name: company.company_name
        })
      })
    }
    
    // Add companies from ai_screening_results
    if (run.ai_screening_results) {
      run.ai_screening_results.forEach((company: any) => {
        companies.set(company.orgnr, {
          orgnr: company.orgnr,
          name: company.company_name
        })
      })
    }

    return {
      id: run.id,
      startedAt: run.started_at,
      completedAt: run.completed_at,
      analysisMode: run.analysis_mode,
      templateName: run.analysis_template_name,
      customInstructions: run.custom_instructions,
      companyCount: run.company_count || 0,
      companies: Array.from(companies.values()),
      status: run.status,
      modelVersion: run.model_version,
      initiatedBy: run.initiated_by
    }
  })

  const totalPages = Math.ceil((count || 0) / limit)

  return {
    runs,
    total: count || 0,
    page,
    totalPages
  }
}

async function fetchRunDetail(supabase: SupabaseClient, runId: string) {
  // Fetch run details and associated analysis data
  const { data: runData, error: runError } = await supabase
    .from('ai_analysis_runs')
    .select('*')
    .eq('id', runId)
    .single()

  if (runError || !runData) {
    return null
  }

  // Fetch analysis data based on run mode
  if (runData.analysis_mode === 'screening') {
    const { data: screeningData } = await supabase
      .from('ai_screening_results')
      .select('*')
      .eq('run_id', runId)

    return {
      run: {
        id: runData.id,
        status: runData.status,
        modelVersion: runData.model_version,
        analysisMode: runData.analysis_mode,
        startedAt: runData.started_at,
        completedAt: runData.completed_at,
        errorMessage: runData.error_message
      },
      results: screeningData || []
    }
  } else {
    const { data: analysisData } = await supabase
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
        executive_summary,
        key_findings,
        narrative,
        strengths,
        weaknesses,
        opportunities,
        risks,
        acquisition_interest,
        financial_health_score,
        growth_outlook,
        market_position,
        target_price_msek
      `)
      .eq('run_id', runId)

    // Transform data for frontend (snake_case to camelCase)
    const transformedCompanies = (analysisData || []).map(item => ({
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
      // financialMetrics: stored in ai_analysis_metrics table, not in ai_company_analysis
      nextSteps: item.next_steps || [],
      createdAt: item.created_at,
      // Enhanced Codex fields
      executiveSummary: item.executive_summary,
      keyFindings: item.key_findings,
      narrative: item.narrative,
      strengths: item.strengths,
      weaknesses: item.weaknesses,
      opportunities: item.opportunities,
      risks: item.risks,
      acquisitionInterest: item.acquisition_interest,
      financialHealth: item.financial_health_score,
      growthPotential: item.growth_outlook,
      marketPosition: item.market_position,
      targetPrice: item.target_price_msek
    }))

    return {
      run: {
        id: runData.id,
        status: runData.status,
        modelVersion: runData.model_version,
        analysisMode: runData.analysis_mode,
        startedAt: runData.started_at,
        completedAt: runData.completed_at,
        errorMessage: runData.error_message
      },
      companies: transformedCompanies
    }
  }
}

// ============================================================================
// SAVED COMPANY LISTS API
// ============================================================================

// Helper function to get authenticated user from request
async function getAuthenticatedUser(req: any): Promise<{ id: string } | null> {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return null
    }

    // Create a client with the user's token
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: { user }, error } = await userClient.auth.getUser()
    if (error || !user) {
      return null
    }

    return { id: user.id }
  } catch (error) {
    console.error('Error getting authenticated user:', error)
    return null
  }
}

// Get all saved lists for the current user
app.get('/api/saved-lists', async (req, res) => {
  try {
    // Get authenticated user from request
    const user = await getAuthenticatedUser(req)
    if (!user) {
      // If no authenticated user, return empty array (or you could return 401)
      return res.status(200).json({
        success: true,
        data: []
      })
    }

    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(200).json({
        success: true,
        data: []
      })
    }

    const token = authHeader.substring(7)
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ success: false, error: 'Supabase credentials not configured' })
    }

    // Create authenticated client with user's token
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data, error } = await userClient
      .from('saved_company_lists')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching saved lists:', error)
      return res.status(500).json({ 
        success: false, 
        error: 'Database error: ' + error.message 
      })
    }

    res.status(200).json({
      success: true,
      data: data || []
    })
  } catch (error: any) {
    console.error('Get saved lists error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

// Create a new saved list
app.post('/api/saved-lists', async (req, res) => {
  try {
    const { name, description, companies, filters } = req.body

    if (!name || !companies || !Array.isArray(companies)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name and companies array are required' 
      })
    }

    // Get authenticated user from request
    const user = await getAuthenticatedUser(req)
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required. Please log in to save lists.' 
      })
    }

    // Get auth token to create authenticated client
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication token required' 
      })
    }

    const token = authHeader.substring(7)
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ success: false, error: 'Supabase credentials not configured' })
    }

    // Create authenticated client with user's token
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data, error } = await userClient
      .from('saved_company_lists')
      .insert({
        user_id: user.id,
        name,
        description: description || '',
        companies: companies,
        filters: filters || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating saved list:', error)
      return res.status(500).json({ 
        success: false, 
        error: 'Database error: ' + error.message 
      })
    }

    res.status(201).json({
      success: true,
      data: data
    })
  } catch (error: any) {
    console.error('Create saved list error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

// Update an existing saved list
app.put('/api/saved-lists/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, description, companies, filters } = req.body

    if (!id) {
      return res.status(400).json({ success: false, error: 'List ID is required' })
    }

    // Get authenticated user from request
    const user = await getAuthenticatedUser(req)
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      })
    }

    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication token required' 
      })
    }

    const token = authHeader.substring(7)
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ success: false, error: 'Supabase credentials not configured' })
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data, error } = await userClient
      .from('saved_company_lists')
      .update({
        name,
        description,
        companies,
        filters,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating saved list:', error)
      return res.status(500).json({ 
        success: false, 
        error: 'Database error: ' + error.message 
      })
    }

    res.status(200).json({
      success: true,
      data: data
    })
  } catch (error: any) {
    console.error('Update saved list error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

// Delete a saved list
app.delete('/api/saved-lists/:id', async (req, res) => {
  try {
    const { id } = req.params

    if (!id) {
      return res.status(400).json({ success: false, error: 'List ID is required' })
    }

    // Get authenticated user from request
    const user = await getAuthenticatedUser(req)
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      })
    }

    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication token required' 
      })
    }

    const token = authHeader.substring(7)
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ success: false, error: 'Supabase credentials not configured' })
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { error } = await userClient
      .from('saved_company_lists')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting saved list:', error)
      return res.status(500).json({ 
        success: false, 
        error: 'Database error: ' + error.message 
      })
    }

    res.status(200).json({
      success: true,
      message: 'List deleted successfully'
    })
  } catch (error: any) {
    console.error('Delete saved list error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

// ============================================================================
// TEST ENDPOINTS
// ============================================================================

// Test saved_company_lists table access
app.get('/api/test-saved-lists', async (req, res) => {
  try {
    const supabase = getSupabase()
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase credentials not configured' })
    }

    // Test if table exists and is accessible
    const { data, error } = await supabase
      .from('saved_company_lists')
      .select('*')
      .limit(1)

    if (error) {
      console.error('Error accessing saved_company_lists table:', error)
      return res.status(500).json({ 
        success: false, 
        error: error.message,
        code: error.code,
        details: error.details
      })
    }

    res.status(200).json({
      success: true,
      message: 'saved_company_lists table is accessible',
      count: data?.length || 0
    })
  } catch (error: any) {
    console.error('Test saved lists error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

// Test authentication and saved lists
app.get('/api/test-auth-lists', async (req, res) => {
  try {
    const supabase = getSupabase()
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase credentials not configured' })
    }

    // Test authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      return res.status(500).json({ 
        success: false, 
        error: 'Auth error: ' + authError.message 
      })
    }

    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'No authenticated user',
        user: null,
        lists: []
      })
    }

    // Test fetching lists for this user
    const { data, error } = await supabase
      .from('saved_company_lists')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(500).json({ 
        success: false, 
        error: 'Database error: ' + error.message,
        code: error.code
      })
    }

    res.status(200).json({
      success: true,
      message: 'Authentication and database access working',
      user: {
        id: user.id,
        email: user.email
      },
      lists: data || []
    })
  } catch (error: any) {
    console.error('Test auth lists error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

// ============================================================================
// VALUATION API ENDPOINTS
// ============================================================================

function pickOrgNumber(row: any): string | null {
  return (
    row?.OrgNr ||
    row?.orgnr ||
    row?.organisationNumber ||
    row?.organisation_number ||
    row?.org_number ||
    null
  )
}

function buildChartSeries(history: NormalizedFinancialHistory) {
  return [...history.records]
    .sort((a, b) => a.year - b.year)
    .map((record) => {
      const singleYearMetrics = computeValuationMetrics([record]).metrics
      return {
        year: record.year,
        revenue: record.revenue ?? null,
        ebit: record.ebit ?? null,
        ebitda: record.ebitda ?? null,
        evToEbitda: singleYearMetrics.evToEbitda,
      }
    })
}

interface FetchedValuationData {
  companies: Array<{
    orgnr: string
    name: string
    industry: string | null
    employees: number | null
    records: Array<Record<string, any>>
  }>
}

/**
 * Helper function to fetch company data from new schema and transform to old format
 * for compatibility with createCompanyProfile and other functions
 */
async function fetchCompanyDataFromNewSchema(
  supabase: SupabaseClient,
  orgnr: string
): Promise<any | null> {
  // Fetch from companies table
  const { data: companyData, error: companyError } = await supabase
    .from('companies')
    .select(`
      orgnr,
      company_name,
      segment_names,
      address,
      homepage,
      email,
      foundation_year,
      employees_latest
    `)
    .eq('orgnr', orgnr)
    .single()

  if (companyError || !companyData) {
    console.error(`[valuation] Failed to fetch company row for ${orgnr}`, companyError?.message || 'No data returned')
    return null
  }

  // Fetch from company_metrics table
  const { data: metricsData, error: metricsError } = await supabase
    .from('company_metrics')
    .select(`
      orgnr,
      latest_revenue_sek,
      latest_profit_sek,
      latest_ebitda_sek,
      revenue_cagr_3y,
      avg_ebitda_margin,
      avg_net_margin,
      digital_presence
    `)
    .eq('orgnr', orgnr)
    .single()
  if (metricsError) {
    console.warn(`[valuation] Metrics fetch warning for ${orgnr}`, metricsError.message)
  }

  // Transform to old format
  const segmentNames = Array.isArray(companyData.segment_names)
    ? companyData.segment_names
    : (companyData.segment_names ? [companyData.segment_names] : [])
  
  // Extract city from address JSONB
  let city: string | null = null
  if (companyData.address) {
    if (typeof companyData.address === 'object') {
      city = companyData.address.postPlace || companyData.address.visitorAddress?.postPlace || null
    }
  }

  // Transform revenue/profit from thousands to SEK (if needed)
  // Database stores in thousands, but createCompanyProfile expects SEK
  const revenue = metricsData?.latest_revenue_sek ? metricsData.latest_revenue_sek * 1000 : null
  const profit = metricsData?.latest_profit_sek ? metricsData.latest_profit_sek * 1000 : null

  return {
    OrgNr: companyData.orgnr,
    name: companyData.company_name,
    segment_name: segmentNames[0] || null,
    city: city,
    employees: companyData.employees_latest,
    revenue: revenue,
    profit: profit,
    SDI: metricsData?.latest_revenue_sek || null, // In thousands
    DR: metricsData?.latest_profit_sek || null, // In thousands
    ORS: metricsData?.latest_ebitda_sek || null, // In thousands
    Revenue_growth: metricsData?.revenue_cagr_3y || null,
    EBIT_margin: metricsData?.avg_ebitda_margin || null,
    NetProfit_margin: metricsData?.avg_net_margin || null,
    digital_presence: metricsData?.digital_presence || false,
    incorporation_date: companyData.foundation_year ? `${companyData.foundation_year}-01-01` : null,
    email: companyData.email,
    homepage: companyData.homepage,
    address: companyData.address
  }
}

async function fetchValuationSourceData(
  supabase: SupabaseClient,
  companyIds: string[]
): Promise<FetchedValuationData> {
  // Fetch from new schema: companies + company_metrics
  const { data: companyRows, error: companyError } = await supabase
    .from('companies')
    .select(`
      orgnr,
      company_name,
      segment_names,
      employees_latest
    `)
    .in('orgnr', companyIds)

  if (companyError) {
    throw new Error(`Failed to fetch company data: ${companyError.message}`)
  }

  const { data: metricsRows, error: metricsError } = await supabase
    .from('company_metrics')
    .select(`
      orgnr,
      latest_revenue_sek,
      latest_profit_sek,
      latest_ebitda_sek,
      revenue_cagr_3y,
      avg_ebitda_margin,
      avg_net_margin
    `)
    .in('orgnr', companyIds)

  if (metricsError) {
    throw new Error(`Failed to fetch metrics data: ${metricsError.message}`)
  }

  // Fetch historical financial accounts from new schema
  const { data: accountRows, error: accountsError } = await supabase
    .from('financial_accounts')
    .select('orgnr, year, account_code, amount_sek')
    .in('orgnr', companyIds)
    .eq('period', '12')
    .order('year', { ascending: false })

  if (accountsError) {
    throw new Error(`Failed to fetch financial accounts: ${accountsError.message}`)
  }

  // Build accounts map by orgnr and year
  const accountsMap = new Map<string, Map<number, any>>()
  for (const row of accountRows || []) {
    const orgnr = row.orgnr
    if (!orgnr) continue
    if (!accountsMap.has(orgnr)) {
      accountsMap.set(orgnr, new Map())
    }
    const yearMap = accountsMap.get(orgnr)!
    const year = row.year
    if (!yearMap.has(year)) {
      yearMap.set(year, { year })
    }
    const record = yearMap.get(year)!
    // Map account codes
    if (row.account_code === 'SDI') record.SDI = row.amount_sek
    else if (row.account_code === 'RG') record.RG = row.amount_sek
    else if (row.account_code === 'DR') record.DR = row.amount_sek
    else if (row.account_code === 'EBITDA') record.EBITDA = row.amount_sek
  }

  // Build companies array
  const companiesMap = new Map<string, any>()
  for (const companyRow of companyRows || []) {
    const orgnr = companyRow.orgnr
    const metricsRow = metricsRows?.find(m => m.orgnr === orgnr)
    const segmentNames = Array.isArray(companyRow.segment_names) 
      ? companyRow.segment_names 
      : (companyRow.segment_names ? [companyRow.segment_names] : [])
    
    const fallbackYear = new Date().getFullYear()
    const fallbackRecord = {
      year: fallbackYear,
      SDI: metricsRow?.latest_revenue_sek || null,
      RG: metricsRow?.latest_revenue_sek || null,
      EBIT: metricsRow?.latest_ebitda_sek || null,
      EBITDA: metricsRow?.latest_ebitda_sek || null,
      DR: metricsRow?.latest_profit_sek || null,
    }
    
    const yearRecords = accountsMap.get(orgnr) || new Map()
    const records = Array.from(yearRecords.values()).length > 0 
      ? Array.from(yearRecords.values())
      : [fallbackRecord]

    companiesMap.set(orgnr, {
      orgnr: orgnr,
      name: companyRow.company_name || 'Okänt bolag',
      industry: segmentNames[0] || null,
      employees: companyRow.employees_latest || null,
      records,
  })
  }

  return { companies: Array.from(companiesMap.values()) }
}

interface AiInsightResult {
  companyInsights: Record<string, CompanyValuationInsight>
  overallSummary: string
}

function fallbackInsightForCompany(
  company: ValuationCompanyResponse,
  mode: 'default' | 'deep'
): CompanyValuationInsight {
  const { metrics } = company
  const summaryParts: string[] = []
  if (metrics.revenueLatest) {
    summaryParts.push(`Omsättning ${Math.round(metrics.revenueLatest / 1_000)} MSEK`)
  }
  if (metrics.evToEbit) {
    summaryParts.push(`EV/EBIT ${metrics.evToEbit.toFixed(1)}x`)
  }
  if (metrics.peRatio) {
    summaryParts.push(`P/E ${metrics.peRatio.toFixed(1)}x`)
  }
  const summary = summaryParts.length
    ? `${company.name}: ${summaryParts.join(', ')}.`
    : `${company.name}: Begränsat dataunderlag för värdering.`

  const riskFlags: string[] = []
  if (metrics.equityRatio !== null && metrics.equityRatio < 0.25) {
    riskFlags.push('Låg soliditet')
  }
  if (metrics.revenueCagr3Y !== null && metrics.revenueCagr3Y < 0) {
    riskFlags.push('Negativ tillväxttakt')
  }

  return {
    summary,
    valuationView: metrics.enterpriseValue
      ? `Indicativt företagsvärde omkring ${(metrics.enterpriseValue / 1_000).toFixed(1)} MSEK`
      : null,
    valuationRange: metrics.enterpriseValue
      ? `${(metrics.enterpriseValue * 0.85).toFixed(0)}–${(metrics.enterpriseValue * 1.15).toFixed(0)} SEK`
      : null,
    riskFlags,
    opportunities:
      metrics.revenueCagr3Y && metrics.revenueCagr3Y > 0.05
        ? ['Stabil historisk tillväxt över 5 % per år']
        : [],
    mode,
  }
}

function createFallbackInsights(
  companies: ValuationCompanyResponse[],
  mode: 'default' | 'deep'
): AiInsightResult {
  const companyInsights: Record<string, CompanyValuationInsight> = {}
  const summaryLines: string[] = []

  companies.forEach((company) => {
    const insight = fallbackInsightForCompany(company, mode)
    companyInsights[company.orgnr] = insight
    summaryLines.push(insight.summary)
  })

  return {
    companyInsights,
    overallSummary:
      summaryLines.length > 0
        ? `Automatiskt sammanställd värderingsöversikt för ${companies.length} bolag. ${summaryLines.join(' ')}`
        : `Automatiskt sammanställd värderingsöversikt för ${companies.length} bolag.`,
  }
}

async function generateValuationInsights(
  companies: ValuationCompanyResponse[],
  mode: 'default' | 'deep'
): Promise<AiInsightResult> {
  if (!process.env.OPENAI_API_KEY) {
    return createFallbackInsights(companies, mode)
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const baseModel = mode === 'deep' ? 'gpt-4.1-mini' : 'gpt-4.1-mini'

  const payload = companies.map((company) => ({
    orgnr: company.orgnr,
    name: company.name,
    industry: company.industry,
    metrics: {
      enterpriseValue: company.metrics.enterpriseValue ? company.metrics.enterpriseValue / 1000 : null,
      evToEbit: company.metrics.evToEbit,
      evToEbitda: company.metrics.evToEbitda,
      peRatio: company.metrics.peRatio,
      pbRatio: company.metrics.pbRatio,
      psRatio: company.metrics.psRatio,
      equityRatio: company.metrics.equityRatio,
      revenueCagr3Y: company.metrics.revenueCagr3Y,
    },
  }))

  try {
    const completion = await openai.chat.completions.create({
      model: baseModel,
      temperature: 0.2,
      max_tokens: 800,
      messages: [
        {
          role: 'system',
          content:
            'Du är en senior företagsvärderare. Analysera svenska företag baserat på nyckeltal. Svara alltid på svenska och med JSON-format.',
        },
        {
          role: 'user',
          content: `Analysera följande företag och producera JSON med strukturen {"overall_summary":"...","companies":[{"orgnr":"","summary":"","valuation_view":"","valuation_range":"","risk_flags":[],"opportunities":[]}]}.
Mode: ${mode}.
Data: ${JSON.stringify(payload)}`,
        },
      ],
    })

    const content = completion.choices?.[0]?.message?.content
    if (!content) {
      return createFallbackInsights(companies, mode)
    }

    let parsed
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content)
    } catch (parseError) {
      console.error('JSON parsing error in AI insights:', parseError)
      console.error('Content that failed to parse:', content)
      return createFallbackInsights(companies, mode)
    }

    const companyInsights: Record<string, CompanyValuationInsight> = {}
    for (const entry of parsed.companies || []) {
      if (!entry?.orgnr) continue
      companyInsights[entry.orgnr] = {
        summary: entry.summary || 'Sammanfattning saknas',
        valuationView: entry.valuation_view || null,
        valuationRange: entry.valuation_range || null,
        riskFlags: Array.isArray(entry.risk_flags) ? entry.risk_flags : [],
        opportunities: Array.isArray(entry.opportunities) ? entry.opportunities : [],
        mode,
      }
    }

    const fallback = createFallbackInsights(companies, mode)
    const combinedInsights: Record<string, CompanyValuationInsight> = {}
    companies.forEach((company) => {
      combinedInsights[company.orgnr] =
        companyInsights[company.orgnr] || fallback.companyInsights[company.orgnr]
    })

    let overallSummary: string = parsed.overall_summary || fallback.overallSummary

    if (mode === 'deep' && companies.length) {
      const topCompanies = [...companies]
        .sort((a, b) => (b.metrics.enterpriseValue || 0) - (a.metrics.enterpriseValue || 0))
        .slice(0, Math.min(2, companies.length))

      const deepPrompt = topCompanies.map((company) => ({
        orgnr: company.orgnr,
        name: company.name,
        metrics: {
          enterpriseValue: company.metrics.enterpriseValue,
          evToEbit: company.metrics.evToEbit,
          peRatio: company.metrics.peRatio,
          equityRatio: company.metrics.equityRatio,
          revenueCagr3Y: company.metrics.revenueCagr3Y,
        },
      }))

      const deepCompletion = await openai.chat.completions.create({
        model: 'gpt-4o',
        temperature: 0.3,
        max_tokens: 600,
        messages: [
          {
            role: 'system',
            content:
              'Du är en expert på M&A och företagsvärdering. Ge kort men insiktsfull analys på svenska.',
          },
          {
            role: 'user',
            content: `Fördjupa analysen för dessa prioriterade bolag. Returnera JSON med {"companies":[{"orgnr":"","deep_summary":"","risk_flags":[],"opportunities":[]}]}.
Data: ${JSON.stringify(deepPrompt)}`,
          },
        ],
      })

      const deepContent = deepCompletion.choices?.[0]?.message?.content
      if (deepContent) {
        const deepJsonMatch = deepContent.match(/\{[\s\S]*\}/)
        const deepParsed = deepJsonMatch ? JSON.parse(deepJsonMatch[0]) : JSON.parse(deepContent)

        for (const item of deepParsed.companies || []) {
          if (!item?.orgnr || !combinedInsights[item.orgnr]) continue
          combinedInsights[item.orgnr] = {
            ...combinedInsights[item.orgnr],
            summary: item.deep_summary || combinedInsights[item.orgnr].summary,
            riskFlags: Array.isArray(item.risk_flags) ? item.risk_flags : combinedInsights[item.orgnr].riskFlags,
            opportunities: Array.isArray(item.opportunities)
              ? item.opportunities
              : combinedInsights[item.orgnr].opportunities,
            mode: 'deep',
          }
        }

        overallSummary = deepParsed.overall_summary || overallSummary
      }
    }

    return {
      companyInsights: combinedInsights,
      overallSummary,
    }
  } catch (error) {
    console.error('AI valuation insight generation failed:', error)
    return createFallbackInsights(companies, mode)
  }
}

async function persistValuationSession(
  supabase: SupabaseClient,
  payload: {
    companyIds: string[]
    mode: 'default' | 'deep'
    companies: ValuationCompanyResponse[]
    insights: AiInsightResult
    exportDataset: ReturnType<typeof buildValuationExportDataset>
  }
): Promise<string | null> {
  const { data, error } = await supabase
    .from('valuation_sessions')
    .insert({
      company_ids: payload.companyIds,
      mode: payload.mode,
      valuation_payload: payload.companies.map((company) => ({
        orgnr: company.orgnr,
        name: company.name,
        industry: company.industry,
        employees: company.employees,
        metrics: company.metrics,
        history: company.history,
        aiInsights: payload.insights.companyInsights[company.orgnr] ?? null,
      })),
      overall_summary: payload.insights.overallSummary,
      export_dataset: payload.exportDataset,
      generated_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to persist valuation session:', error)
    throw new Error('Could not save valuation session to database')
  }

  return data?.id || null
}

app.post('/api/valuation', async (req, res) => {
  try {
    const { companyIds, mode: modeInput } = req.body || {}
    const mode: 'default' | 'deep' = modeInput === 'deep' ? 'deep' : 'default'

    if (!Array.isArray(companyIds) || companyIds.length === 0) {
      return res.status(400).json({ success: false, error: 'companyIds array is required' })
    }

    if (companyIds.length > 15) {
      return res.status(400).json({ success: false, error: 'Max 15 företag kan värderas samtidigt' })
    }

    const supabase = getSupabase()
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase credentials not configured' })
    }

    // Fetch company data from new schema for each company
    const companies: ValuationCompanyResponse[] = []
    
    for (const companyId of companyIds) {
      const companyData = await fetchCompanyDataFromNewSchema(supabase, companyId)

      if (!companyData) {
        console.error(`Failed to fetch data for company ${companyId}`)
        continue
      }

      // Create company profile and run valuations
      const profile = createCompanyProfile(companyData)
      const assumptions = await loadAllAssumptions(
        supabase, 
        profile.industry, 
        profile.sizeBucket, 
        profile.growthBucket
      )
      const valuations = runValuations(profile, assumptions)

      // Calculate metrics from valuations
      const revenueModel = valuations.find(v => v.modelKey === 'revenue_multiple')
      const ebitdaModel = valuations.find(v => v.modelKey === 'ebitda_multiple')
      const earningsModel = valuations.find(v => v.modelKey === 'earnings_multiple')
      
      const metrics = {
        enterpriseValue: revenueModel?.valueEv || null,
        equityValue: revenueModel?.valueEquity || null,
        revenueLatest: profile.revenue,
        revenueCagr3Y: null, // Not available without historical data
        evToEbit: null,
        evToEbitda: null,
        peRatio: null,
        pbRatio: null,
        psRatio: null,
        equityRatio: null
      }
      
      console.log(`Company ${companyData.OrgNr} metrics:`, {
        revenue: profile.revenue,
        ebitda: profile.ebitda,
        netProfit: profile.netProfit,
        revenueModel: revenueModel?.valueEv,
        ebitdaModel: ebitdaModel?.valueEv,
        earningsModel: earningsModel?.valueEv
      })

      companies.push({
        orgnr: companyData.OrgNr,
        name: companyData.name,
        industry: profile.industry,
        employees: companyData.employees,
        metrics,
        history: [], // Empty for now
        chartSeries: [], // Empty for now
      })
    }

    if (!companies.length) {
      return res.status(404).json({ success: false, error: 'Inga företag hittades för angivna ID' })
    }

    const insights = await generateValuationInsights(companies, mode)

    const exportDataset = buildValuationExportDataset(
      companies.map((company) => ({
        orgnr: company.orgnr,
        name: company.name,
        industry: company.industry,
        history: company.history,
        metrics: company.metrics,
      }))
    )

    const valuationSessionId = await persistValuationSession(supabase, {
      companyIds: companyIds.map(String),
      mode,
      companies,
      insights,
      exportDataset,
    })

    const response: ValuationApiResponse = {
      valuationSessionId,
      mode,
      generatedAt: new Date().toISOString(),
      companies: companies.map((company) => ({
        ...company,
        aiInsights: insights.companyInsights[company.orgnr],
      })),
      overallSummary: insights.overallSummary,
      exportDataset,
    }

    res.status(200).json({ success: true, data: response })
  } catch (error: any) {
    console.error('Valuation API error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

// Preview valuations for a company (no persistence)
app.post('/api/valuation/preview', async (req, res) => {
  try {
    const { orgnr, overrides, valueType = 'equity' } = req.body
    
    if (!orgnr) {
      return res.status(400).json({ success: false, error: 'Organization number required' })
    }

    const supabase = getSupabase()
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase credentials not configured' })
    }

    // Fetch company data from new schema
    const companyData = await fetchCompanyDataFromNewSchema(supabase, orgnr)

    if (!companyData) {
      return res.status(404).json({ success: false, error: 'Company data not found' })
    }

    // Create company profile
    const profile = createCompanyProfile(companyData)
    
    // Load assumptions
    const assumptions = await loadAllAssumptions(
      supabase, 
      profile.industry, 
      profile.sizeBucket, 
      profile.growthBucket,
      overrides
    )

    // Run valuations
    const results = runValuations(profile, assumptions)

    res.status(200).json({
      success: true,
      data: {
        company: profile,
        valuations: results,
        valueType
      }
    })
  } catch (error: any) {
    console.error('Valuation preview error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

// Commit valuations to database (persist results)
app.post('/api/valuation/commit', async (req, res) => {
  try {
    const { analysisRunId, orgnr, selectedModelKey, overrides, valueType = 'equity' } = req.body
    
    if (!analysisRunId || !orgnr) {
      return res.status(400).json({ success: false, error: 'Analysis run ID and organization number required' })
    }

    const supabase = getSupabase()
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase credentials not configured' })
    }

    // Fetch company data from new schema
    const companyData = await fetchCompanyDataFromNewSchema(supabase, orgnr)

    if (!companyData) {
      return res.status(404).json({ success: false, error: 'Company data not found' })
    }

    // Create company profile
    const profile = createCompanyProfile(companyData)
    
    // Load assumptions
    const assumptions = await loadAllAssumptions(
      supabase, 
      profile.industry, 
      profile.sizeBucket, 
      profile.growthBucket,
      overrides
    )

    // Run valuations
    const results = runValuations(profile, assumptions)

    // Create valuation run
    const { data: valuationRun, error: runError } = await supabase
      .from('valuation_runs')
      .insert({
        analysis_run_id: analysisRunId,
        company_orgnr: orgnr,
        selected_model_key: selectedModelKey,
        value_type: valueType
      })
      .select()
      .single()

    if (runError) {
      console.error('Error creating valuation run:', runError)
      return res.status(500).json({ success: false, error: 'Failed to create valuation run' })
    }

    // Insert valuation results
    const resultsToInsert = results.map(result => ({
      valuation_run_id: valuationRun.id,
      model_key: result.modelKey,
      value_ev: result.valueEv,
      value_equity: result.valueEquity,
      basis: result.basis,
      multiple_used: result.multipleUsed,
      confidence: result.confidence,
      inputs: result.inputs,
      notes: result.inputs.reason
    }))

    const { error: resultsError } = await supabase
      .from('valuation_results')
      .insert(resultsToInsert)

    if (resultsError) {
      console.error('Error inserting valuation results:', resultsError)
      return res.status(500).json({ success: false, error: 'Failed to save valuation results' })
    }

    res.status(200).json({
      success: true,
      data: {
        valuationRunId: valuationRun.id,
        company: profile,
        valuations: results,
        selectedModelKey,
        valueType
      }
    })
  } catch (error: any) {
    console.error('Valuation commit error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

// Get valuations for a specific run and company
app.get('/api/valuation/:runId/:orgnr', async (req, res) => {
  try {
    const { runId, orgnr } = req.params

    const supabase = getSupabase()
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase credentials not configured' })
    }

    // Get valuation run
    const { data: valuationRun, error: runError } = await supabase
      .from('valuation_runs')
      .select('*')
      .eq('analysis_run_id', runId)
      .eq('company_orgnr', orgnr)
      .single()

    if (runError || !valuationRun) {
      return res.status(404).json({ success: false, error: 'Valuation run not found' })
    }

    // Get valuation results
    const { data: results, error: resultsError } = await supabase
      .from('valuation_results')
      .select('*')
      .eq('valuation_run_id', valuationRun.id)
      .order('model_key')

    if (resultsError) {
      console.error('Error fetching valuation results:', resultsError)
      return res.status(500).json({ success: false, error: 'Failed to fetch valuation results' })
    }

    res.status(200).json({
      success: true,
      data: {
        valuationRun,
        valuations: results || []
      }
    })
  } catch (error: any) {
    console.error('Get valuation error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

// Select/update active model for a valuation run
app.patch('/api/valuation/:valuationRunId/select', async (req, res) => {
  try {
    const { valuationRunId } = req.params
    const { modelKey, valueType = 'equity' } = req.body

    if (!modelKey) {
      return res.status(400).json({ success: false, error: 'Model key required' })
    }

    const supabase = getSupabase()
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase credentials not configured' })
    }

    const { error } = await supabase
      .from('valuation_runs')
      .update({
        selected_model_key: modelKey,
        value_type: valueType
      })
      .eq('id', valuationRunId)

    if (error) {
      console.error('Error updating valuation run:', error)
      return res.status(500).json({ success: false, error: 'Failed to update valuation run' })
    }

    res.status(200).json({
      success: true,
      message: 'Valuation model selection updated'
    })
  } catch (error: any) {
    console.error('Select valuation model error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

// Get LLM suggestions for valuation assumptions
app.post('/api/valuation/advice', async (req, res) => {
  try {
    const { orgnr } = req.body
    
    if (!orgnr) {
      return res.status(400).json({ success: false, error: 'Organization number required' })
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ success: false, error: 'OpenAI API key not configured' })
    }

    const supabase = getSupabase()
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase credentials not configured' })
    }

    // Fetch company data from new schema
    const companyData = await fetchCompanyDataFromNewSchema(supabase, orgnr)

    if (!companyData) {
      return res.status(404).json({ success: false, error: 'Company data not found' })
    }

    // Create company profile
    const profile = createCompanyProfile(companyData)
    
    // Create company context for LLM
    const context: CompanyContext = {
      name: profile.name,
      industry: profile.industry,
      sizeBucket: profile.sizeBucket,
      growthBucket: profile.growthBucket,
      revenue: profile.revenue,
      netProfit: profile.netProfit,
      ebitda: profile.ebitda,
      revenueGrowth: profile.revenueGrowth,
      ebitMargin: profile.ebitMargin,
      netProfitMargin: profile.netProfitMargin,
      employees: profile.employees,
      benchmarks: null // Benchmarks not available in this context
    }

    // Get LLM suggestions
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const suggestions = await getLLMSuggestions(openai, context)
    const validatedSuggestions = validateSuggestions(suggestions)

    res.status(200).json({
      success: true,
      data: {
        company: profile,
        suggestions: validatedSuggestions
      }
    })
  } catch (error: any) {
    console.error('LLM advice error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

// Admin endpoints for managing valuation assumptions
app.get('/api/valuation/assumptions', async (req, res) => {
  try {
    const supabase = getSupabase()
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase credentials not configured' })
    }

    const assumptions = await getAllAssumptions(supabase)

    res.status(200).json({
      success: true,
      data: assumptions
    })
  } catch (error: any) {
    console.error('Get assumptions error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

app.patch('/api/valuation/assumptions/:id', async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    const supabase = getSupabase()
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase credentials not configured' })
    }

    const success = await updateAssumptions(supabase, id, updates)

    if (!success) {
      return res.status(500).json({ success: false, error: 'Failed to update assumptions' })
    }

    res.status(200).json({
      success: true,
      message: 'Assumptions updated successfully'
    })
  } catch (error: any) {
    console.error('Update assumptions error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

app.post('/api/valuation/assumptions', async (req, res) => {
  try {
    const assumptions = req.body

    const supabase = getSupabase()
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase credentials not configured' })
    }

    const createdRecord = await createAssumptions(supabase, assumptions)

    if (!createdRecord) {
      return res.status(500).json({ success: false, error: 'Failed to create assumptions' })
    }

    res.status(201).json({
      success: true,
      message: 'Assumptions created successfully',
      data: createdRecord
    })
  } catch (error: any) {
    console.error('Create assumptions error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

app.delete('/api/valuation/assumptions/:id', async (req, res) => {
  try {
    const { id } = req.params

    const supabase = getSupabase()
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase credentials not configured' })
    }

    const success = await deleteAssumptions(supabase, id)

    if (!success) {
      return res.status(500).json({ success: false, error: 'Failed to delete assumptions' })
    }

    res.status(200).json({
      success: true,
      message: 'Assumptions deleted successfully'
    })
  } catch (error: any) {
    console.error('Delete assumptions error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

// Dashboard Analytics endpoint - Local SQLite Database
app.get('/api/analytics-local', async (req, res) => {
  try {
    const dbPath = path.resolve(__dirname, '../../data/nivo_optimized.db')
    console.log(`[Local DB] Opening database at: ${dbPath}`)
    
    if (!fs.existsSync(dbPath)) {
      console.error(`[Local DB] Database file not found: ${dbPath}`)
      return res.status(500).json({ success: false, error: 'Local database file not found' })
    }
    
    const db = new Database(dbPath, { readonly: true })

    // Get total companies count
    const totalCompaniesResult = db.prepare('SELECT COUNT(*) as count FROM companies').get() as { count: number }
    const totalCompanies = totalCompaniesResult.count || 0

    // Get all KPIs from pre-calculated company_kpis table
    // This is much faster than calculating on-the-fly and enables efficient segmentation
    const metricsQuery = db.prepare(`
      SELECT 
        orgnr,
        latest_revenue_sek,
        latest_profit_sek,
        latest_ebitda_sek,
        revenue_cagr_3y,
        avg_ebitda_margin,
        avg_net_margin
      FROM company_kpis
    `)
    const allMetrics = metricsQuery.all() as Array<{
      orgnr: string
      latest_revenue_sek: number | null
      latest_profit_sek: number | null
      latest_ebitda_sek: number | null
      revenue_cagr_3y: number | null
      avg_ebitda_margin: number | null
      avg_net_margin: number | null
    }>
    
    console.log(`[Local DB Analytics] Metrics query result: ${allMetrics.length} rows`)
    if (allMetrics.length > 0) {
      const sample = allMetrics[0]
      console.log(`[Local DB Analytics] Sample metric:`, {
        orgnr: sample.orgnr,
        latest_revenue_sek: sample.latest_revenue_sek,
        revenue_type: typeof sample.latest_revenue_sek,
        isNull: sample.latest_revenue_sek === null,
        isGreaterThanZero: sample.latest_revenue_sek > 0
      })
      // Check first 5 metrics
      const firstFive = allMetrics.slice(0, 5)
      console.log(`[Local DB Analytics] First 5 metrics revenue values:`, 
        firstFive.map(m => ({ orgnr: m.orgnr, revenue: m.latest_revenue_sek, type: typeof m.latest_revenue_sek }))
      )
    } else {
      console.error(`[Local DB Analytics] ERROR: No metrics returned from query!`)
    }

    // Calculate metrics from pre-calculated values
    const revenueValues: number[] = []
    const growthValues: number[] = []
    const ebitMarginValues: number[] = []
    const netMarginValues: number[] = []
    let totalWithFinancials = 0
    let totalWithKPIs = 0

    allMetrics.forEach(metric => {
      // Companies with financials = have revenue data
      if (metric.latest_revenue_sek !== null && metric.latest_revenue_sek > 0) {
        totalWithFinancials++
        revenueValues.push(metric.latest_revenue_sek)
      }

      // Companies with KPIs = have at least one KPI calculated
      const hasKPI = metric.revenue_cagr_3y !== null || 
                     metric.avg_ebitda_margin !== null || 
                     metric.avg_net_margin !== null
      
      if (hasKPI) {
        totalWithKPIs++
      }

      // Collect values for averages (only valid numbers)
      if (metric.revenue_cagr_3y !== null && !isNaN(metric.revenue_cagr_3y)) {
        growthValues.push(metric.revenue_cagr_3y)
      }
      
      // Filter out extreme outliers (margins outside -1 to 1 range are likely data errors)
      // This prevents a few extreme values from skewing the average
      if (metric.avg_ebitda_margin !== null && !isNaN(metric.avg_ebitda_margin)) {
        // Only include reasonable margins (-100% to +100%)
        if (metric.avg_ebitda_margin >= -1 && metric.avg_ebitda_margin <= 1) {
          ebitMarginValues.push(metric.avg_ebitda_margin)
        }
      }
      
      if (metric.avg_net_margin !== null && !isNaN(metric.avg_net_margin)) {
        // Only include reasonable margins (-100% to +50%)
        // Net margins above 50% are extremely rare and likely data errors
        if (metric.avg_net_margin >= -1 && metric.avg_net_margin <= 0.5) {
          netMarginValues.push(metric.avg_net_margin)
        }
      }
    })

    // Get digital presence count
    const digitalPresenceQuery = db.prepare(`
      SELECT COUNT(*) as count 
      FROM companies 
      WHERE homepage IS NOT NULL AND homepage != ''
    `)
    const digitalResult = digitalPresenceQuery.get() as { count: number }
    const totalWithDigitalPresence = digitalResult.count || 0

    // Calculate averages - return null if no data (not 0)
    const averageRevenue = revenueValues.length > 0
      ? revenueValues.reduce((sum, val) => sum + val, 0) / revenueValues.length
      : null
    const averageRevenueGrowth = growthValues.length > 0
      ? growthValues.reduce((sum, val) => sum + val, 0) / growthValues.length
      : null
    const averageEBITMargin = ebitMarginValues.length > 0
      ? ebitMarginValues.reduce((sum, val) => sum + val, 0) / ebitMarginValues.length
      : null
    const averageNetProfitMargin = netMarginValues.length > 0
      ? netMarginValues.reduce((sum, val) => sum + val, 0) / netMarginValues.length
      : null

    // Get industry distribution - count unique companies per industry
    // segment_names is a JSON array, so we need to extract and count unique companies
    // Handle cases where segment_names might not be valid JSON
    let industries: Array<{ industry_name: string; count: number }> = []
    try {
      const industryQuery = db.prepare(`
        SELECT 
          json_extract(value, '$') as industry_name,
          COUNT(DISTINCT orgnr) as count
        FROM companies,
        json_each(segment_names)
        WHERE segment_names IS NOT NULL 
          AND segment_names != ''
          AND json_valid(segment_names) = 1
          AND json_array_length(segment_names) > 0
        GROUP BY industry_name
        ORDER BY count DESC
        LIMIT 10
      `)
      industries = industryQuery.all() as Array<{ industry_name: string; count: number }>
    } catch (error: any) {
      console.warn('[Local DB Analytics] Industry query failed, trying alternative approach:', error.message)
      // Fallback: try to parse segment_names as text and extract industries
      try {
        const fallbackQuery = db.prepare(`
          SELECT segment_names, COUNT(*) as count
          FROM companies
          WHERE segment_names IS NOT NULL AND segment_names != ''
          GROUP BY segment_names
          ORDER BY count DESC
          LIMIT 10
        `)
        const fallbackResults = fallbackQuery.all() as Array<{ segment_names: string; count: number }>
        const industryMap = new Map<string, number>()
        fallbackResults.forEach(row => {
          try {
            const segments = JSON.parse(row.segment_names)
            if (Array.isArray(segments)) {
              segments.forEach((seg: string) => {
                industryMap.set(seg, (industryMap.get(seg) || 0) + row.count)
              })
            }
          } catch (e) {
            // If not JSON, treat as single industry name
            industryMap.set(row.segment_names, (industryMap.get(row.segment_names) || 0) + row.count)
          }
        })
        industries = Array.from(industryMap.entries()).map(([name, count]) => ({ industry_name: name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
      } catch (fallbackError) {
        console.error('[Local DB Analytics] Fallback industry query also failed:', fallbackError)
      }
    }
    
    // Calculate total companies with segments for percentage calculation
    let companiesWithSegments = totalCompanies
    try {
      const companiesWithSegmentsQuery = db.prepare(`
        SELECT COUNT(DISTINCT orgnr) as count
        FROM companies,
        json_each(segment_names)
        WHERE segment_names IS NOT NULL 
          AND segment_names != ''
          AND json_valid(segment_names) = 1
          AND json_array_length(segment_names) > 0
      `)
      const companiesWithSegmentsResult = companiesWithSegmentsQuery.get() as { count: number }
      companiesWithSegments = companiesWithSegmentsResult.count || totalCompanies
    } catch (error) {
      // If query fails, use totalCompanies as fallback
      companiesWithSegments = totalCompanies
    }
    
    const topIndustries = industries.map(ind => ({
      name: ind.industry_name || 'Okänd',
      count: ind.count,
      percentage: totalCompanies > 0 ? (ind.count / totalCompanies) * 100 : 0
    }))

    // Get company size distribution based on revenue from metrics
    // Need to get revenue for ALL companies from company_metrics
    const allCompanyRevenues = new Map<string, number>()
    let metricsWithRevenue = 0
    allMetrics.forEach(metric => {
      // Convert to number explicitly in case SQLite returns string
      const revenue = typeof metric.latest_revenue_sek === 'string' 
        ? parseFloat(metric.latest_revenue_sek) 
        : metric.latest_revenue_sek
      
      if (revenue !== null && revenue !== undefined && !isNaN(revenue) && revenue > 0) {
        allCompanyRevenues.set(metric.orgnr, revenue)
        metricsWithRevenue++
      }
    })

    console.log(`[Local DB Analytics] Size distribution calculation:`)
    console.log(`  - Total metrics processed: ${allMetrics.length}`)
    console.log(`  - Metrics with valid revenue: ${metricsWithRevenue}`)
    console.log(`  - Companies with revenue in map: ${allCompanyRevenues.size}`)
    if (allCompanyRevenues.size > 0) {
      const revenueValues = Array.from(allCompanyRevenues.values())
      const sampleRevenues = revenueValues.slice(0, 5)
      console.log(`  - Sample revenue values: ${sampleRevenues.join(', ')}`)
      const minRevenue = Math.min(...revenueValues)
      const maxRevenue = Math.max(...revenueValues)
      console.log(`  - Revenue range: ${minRevenue} - ${maxRevenue}`)
      console.log(`  - Sample revenue types: ${sampleRevenues.map(v => typeof v).join(', ')}`)
    } else {
      console.log(`  - WARNING: No companies with revenue found!`)
      if (allMetrics.length > 0) {
        const sample = allMetrics[0]
        console.log(`  - Sample metric:`, {
          orgnr: sample.orgnr,
          latest_revenue_sek: sample.latest_revenue_sek,
          type: typeof sample.latest_revenue_sek,
          isNull: sample.latest_revenue_sek === null,
          isUndefined: sample.latest_revenue_sek === undefined
        })
      }
    }

    const sizeDistribution: Array<{ name: string; count: number; percentage: number }> = []
    
    // Use direct SQL query as fallback if allCompanyRevenues is empty
    if (allCompanyRevenues.size === 0) {
      console.log(`[Local DB Analytics] WARNING: allCompanyRevenues is empty, using SQL fallback`)
      const sizeRanges = [
        { name: 'Små (50-100 MSEK)', min: 50_000, max: 100_000 },
        { name: 'Medelstora (100-150 MSEK)', min: 100_000, max: 150_000 },
        { name: 'Stora (150-200 MSEK)', min: 150_000, max: 200_000 }
      ]
      
      for (const range of sizeRanges) {
        const countQuery = db.prepare(`
          SELECT COUNT(*) as count 
          FROM company_metrics 
          WHERE latest_revenue_sek >= ? AND latest_revenue_sek < ?
        `)
        const result = countQuery.get(range.min, range.max) as { count: number }
        const count = result.count || 0
        console.log(`  - ${range.name}: ${count} companies (SQL query, range: ${range.min} - ${range.max})`)
        sizeDistribution.push({
          name: range.name,
          count,
          percentage: totalCompanies > 0 ? (count / totalCompanies) * 100 : 0
        })
      }
    } else {
      // Database stores revenue in thousands (tSEK), so 50,000 = 50M SEK
      const sizeRanges = [
        { name: 'Små (50-100 MSEK)', min: 50_000, max: 100_000 },
        { name: 'Medelstora (100-150 MSEK)', min: 100_000, max: 150_000 },
        { name: 'Stora (150-200 MSEK)', min: 150_000, max: 200_000 }
      ]

      sizeRanges.forEach(range => {
        const revenueValues = Array.from(allCompanyRevenues.values())
        const matchingRevenues = revenueValues.filter(r => {
          const num = typeof r === 'string' ? parseFloat(r) : r
          return !isNaN(num) && num >= range.min && num < range.max
        })
        const count = matchingRevenues.length
        console.log(`  - ${range.name}: ${count} companies (range: ${range.min} - ${range.max})`)
        if (count === 0 && revenueValues.length > 0) {
          // Debug why no matches
          const sampleInRange = revenueValues.filter(r => {
            const num = typeof r === 'string' ? parseFloat(r) : r
            return !isNaN(num) && num >= range.min - 1000 && num <= range.max + 1000
          }).slice(0, 3)
          console.log(`    - Sample values near range: ${sampleInRange.join(', ')}`)
        }
        sizeDistribution.push({
          name: range.name,
          count,
          percentage: totalCompanies > 0 ? (count / totalCompanies) * 100 : 0
        })
      })
    }

    // Add "Unknown size" for companies without revenue data
    // Use SQL query if allCompanyRevenues is empty
    let companiesWithRevenue = allCompanyRevenues.size
    if (companiesWithRevenue === 0) {
      const revenueCountQuery = db.prepare(`
        SELECT COUNT(*) as count 
        FROM company_metrics 
        WHERE latest_revenue_sek IS NOT NULL AND latest_revenue_sek > 0
      `)
      const revenueResult = revenueCountQuery.get() as { count: number }
      companiesWithRevenue = revenueResult.count || 0
    }
    const companiesWithoutRevenue = totalCompanies - companiesWithRevenue
    if (companiesWithoutRevenue > 0) {
      sizeDistribution.push({
        name: 'Okänd storlek',
        count: companiesWithoutRevenue,
        percentage: totalCompanies > 0 ? (companiesWithoutRevenue / totalCompanies) * 100 : 0
      })
    }

    // Detailed logging for all metrics - verify all 5 cards
    console.log(`[Local DB Analytics] ========================================`)
    console.log(`📊 CARD VALUES VERIFICATION:`)
    console.log(`---`)
    console.log(`Card 1 - Totalt antal företag: ${totalCompanies.toLocaleString('sv-SE')}`)
    console.log(`Card 2 - Genomsnittlig omsättning: ${averageRevenue ? (averageRevenue / 1_000).toFixed(1) + ' MSEK' : 'N/A'} (from ${revenueValues.length} companies)`)  // Database stores in thousands
    console.log(`Card 3 - Genomsnittlig tillväxt (3 år CAGR): ${averageRevenueGrowth !== null ? (averageRevenueGrowth * 100).toFixed(2) + '%' : 'N/A'} (from ${growthValues.length} companies)`)
    console.log(`Card 4 - Genomsnittlig EBIT-marginal: ${averageEBITMargin !== null ? (averageEBITMargin * 100).toFixed(2) + '%' : 'N/A'} (from ${ebitMarginValues.length} companies)`)
    console.log(`Card 5 - Genomsnittlig vinstmarginal: ${averageNetProfitMargin !== null ? (averageNetProfitMargin * 100).toFixed(2) + '%' : 'N/A'} (from ${netMarginValues.length} companies)`)
    console.log(`---`)
    console.log(`Supporting metrics:`)
    console.log(`  - Total with Financials: ${totalWithFinancials}`)
    console.log(`  - Total with KPIs: ${totalWithKPIs}`)
    console.log(`  - Total with Digital Presence: ${totalWithDigitalPresence}`)
    console.log(`---`)
    console.log(`📊 COMPANY SIZE DISTRIBUTION:`)
    console.log(`  - Total companies with revenue: ${allCompanyRevenues.size}`)
    console.log(`  - Size distribution entries: ${sizeDistribution.length}`)
    sizeDistribution.forEach((size, idx) => {
      console.log(`    ${idx + 1}. ${size.name}: ${size.count} companies (${size.percentage.toFixed(1)}%)`)
    })
    console.log(`========================================`)

    // Get detailed margin analysis (before closing DB)
    const marginAnalysisQuery = db.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN latest_profit_sek < 0 THEN 1 END) as negative_profit,
        COUNT(CASE WHEN latest_profit_sek >= 0 THEN 1 END) as positive_profit,
        COUNT(CASE WHEN latest_profit_sek IS NULL THEN 1 END) as null_profit,
        COUNT(CASE WHEN latest_ebitda_sek < 0 THEN 1 END) as negative_ebit,
        COUNT(CASE WHEN latest_ebitda_sek >= 0 THEN 1 END) as positive_ebit,
        COUNT(CASE WHEN latest_ebitda_sek IS NULL THEN 1 END) as null_ebit,
        COUNT(CASE WHEN avg_ebitda_margin < -1 THEN 1 END) as extreme_negative_margin,
        COUNT(CASE WHEN avg_ebitda_margin >= -1 AND avg_ebitda_margin < 0 THEN 1 END) as negative_margin,
        COUNT(CASE WHEN avg_ebitda_margin >= 0 AND avg_ebitda_margin <= 1 THEN 1 END) as positive_margin,
        COUNT(CASE WHEN avg_ebitda_margin > 1 THEN 1 END) as extreme_positive_margin
      FROM company_metrics
    `)
    const marginAnalysis = marginAnalysisQuery.get() as {
      total: number
      negative_profit: number
      positive_profit: number
      null_profit: number
      negative_ebit: number
      positive_ebit: number
      null_ebit: number
      extreme_negative_margin: number
      negative_margin: number
      positive_margin: number
      extreme_positive_margin: number
    }

    // Close database connection after all queries
    db.close()

    // Log the size distribution before sending response
    console.log(`[Local DB Analytics] Sending response with sizeDistribution:`, JSON.stringify(sizeDistribution, null, 2))

    res.status(200).json({
      success: true,
      data: {
        totalCompanies,
        totalWithFinancials,
        totalWithKPIs,
        totalWithDigitalPresence,
        averageRevenueGrowth,
        averageEBITMargin,
        averageNetProfitMargin,
        // Profit growth not available - would need historical profit data to calculate CAGR
        // For now, set to null as we don't have profit_cagr_3y in the database
        averageNetProfitGrowth: null,
        averageRevenue,
        averageCAGR4Y: null,
        topIndustries,
        companySizeDistribution: sizeDistribution,
        marginAnalysis: {
          profit: {
            negative: marginAnalysis.negative_profit,
            positive: marginAnalysis.positive_profit,
            null: marginAnalysis.null_profit,
            total: marginAnalysis.total
          },
          ebit: {
            negative: marginAnalysis.negative_ebit,
            positive: marginAnalysis.positive_ebit,
            null: marginAnalysis.null_ebit,
            total: marginAnalysis.total
          },
          ebitdaMargin: {
            extremeNegative: marginAnalysis.extreme_negative_margin,
            negative: marginAnalysis.negative_margin,
            positive: marginAnalysis.positive_margin,
            extremePositive: marginAnalysis.extreme_positive_margin,
            total: marginAnalysis.total
          }
        }
      }
    })
  } catch (error: any) {
    console.error('[Local DB Analytics] Error:', error)
    console.error('[Local DB Analytics] Stack:', error?.stack)
    res.status(500).json({ 
      success: false, 
      error: error?.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    })
  }
})

// Dashboard Analytics endpoint - redirect to local DB version
app.get('/api/analytics', async (req, res) => {
  // Redirect to local DB analytics endpoint
  try {
    if (!localDBExists()) {
      return res.status(500).json({ success: false, error: 'Local database not found' })
    }

    const db = getLocalDB()

    // Get total companies count
    const totalCompaniesResult = db.prepare('SELECT COUNT(*) as count FROM companies').get() as { count: number }
    const totalCompanies = totalCompaniesResult.count || 0

    // Get metrics counts directly from company_metrics table
    const metricsCountQuery = db.prepare(`
      SELECT 
        COUNT(*) as total_metrics,
        COUNT(CASE WHEN latest_revenue_sek IS NOT NULL AND latest_revenue_sek > 0 THEN 1 END) as with_financials,
        COUNT(CASE WHEN revenue_cagr_3y IS NOT NULL OR avg_ebitda_margin IS NOT NULL OR avg_net_margin IS NOT NULL THEN 1 END) as with_kpis
      FROM company_metrics
    `)
    const metricsCounts = metricsCountQuery.get() as { total_metrics: number; with_financials: number; with_kpis: number }

    // Get all metrics for calculating averages
    const metricsQuery = db.prepare(`
      SELECT 
        latest_revenue_sek,
        revenue_cagr_3y,
        avg_ebitda_margin,
        avg_net_margin
      FROM company_metrics
      WHERE latest_revenue_sek IS NOT NULL
    `)
    const allMetrics = metricsQuery.all() as Array<{
      latest_revenue_sek: number | null
      revenue_cagr_3y: number | null
      avg_ebitda_margin: number | null
      avg_net_margin: number | null
    }>

    // Get digital presence count
    const digitalPresenceQuery = db.prepare(`
      SELECT COUNT(*) as count 
      FROM companies 
      WHERE homepage IS NOT NULL AND homepage != ''
    `)
    const digitalResult = digitalPresenceQuery.get() as { count: number }
    const totalWithDigitalPresence = digitalResult.count || 0

    // Calculate averages
    const revenueValues = allMetrics.map(m => m.latest_revenue_sek).filter(v => v !== null && !isNaN(v!)) as number[]
    const revenueGrowthValues = allMetrics.map(m => m.revenue_cagr_3y).filter(v => v !== null && !isNaN(v!)) as number[]
    // Filter out extreme outliers (margins outside -1 to 1 range are likely data errors)
    const ebitMarginValues = allMetrics
      .map(m => m.avg_ebitda_margin)
      .filter(v => v !== null && !isNaN(v!) && v! >= -1 && v! <= 1) as number[]
    const netProfitMarginValues = allMetrics.map(m => m.avg_net_margin).filter(v => v !== null && !isNaN(v!)) as number[]

    const averageRevenueGrowth = revenueGrowthValues.length > 0 
      ? revenueGrowthValues.reduce((sum, val) => sum + val, 0) / revenueGrowthValues.length 
      : null
    const averageEBITMargin = ebitMarginValues.length > 0 
      ? ebitMarginValues.reduce((sum, val) => sum + val, 0) / ebitMarginValues.length 
      : null
    const averageNetProfitMargin = netProfitMarginValues.length > 0 
      ? netProfitMarginValues.reduce((sum, val) => sum + val, 0) / netProfitMarginValues.length 
      : null
    const averageRevenue = revenueValues.length > 0 
      ? revenueValues.reduce((sum, val) => sum + val, 0) / revenueValues.length 
      : null

    const analytics = {
      totalCompanies,
      totalWithFinancials: metricsCounts.with_financials,
      totalWithKPIs: metricsCounts.with_kpis,
      totalWithDigitalPresence,
      averageRevenueGrowth,
      averageEBITMargin,
      averageNetProfitMargin,
      averageNetProfitGrowth: averageRevenueGrowth,
      averageRevenue,
      averageCAGR4Y: null
    }

    res.status(200).json({
      success: true,
      data: analytics
    })
  } catch (error: any) {
    console.error('Analytics endpoint error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

// Start server
app.listen(port, () => {
  console.log(`🚀 Enhanced AI Analysis Server running on http://localhost:${port}`)
  console.log('✨ Features: Enhanced Codex AI analysis with Swedish localization')
  console.log('📊 Features: Multi-model valuation engine with EV vs Equity handling')
})
