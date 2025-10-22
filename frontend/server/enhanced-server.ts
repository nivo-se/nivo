import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import OpenAI from 'openai'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
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
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

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

app.get('/api/companies', async (req, res) => {
  try {
    const supabase = getSupabase()
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase credentials not configured' })
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit as string || '50', 10) || 50, 1), 200)
    const offset = Math.max(parseInt(req.query.offset as string || '0', 10) || 0, 0)
    const searchTerm = (req.query.search as string)?.trim()

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
      .order('revenue', { ascending: false })
      .range(offset, offset + limit - 1)

    if (searchTerm) {
      const sanitized = searchTerm.replace(/[%]/g, '\\%').replace(/,/g, ' ')
      query = query.or(`name.ilike.%${sanitized}%,OrgNr.ilike.%${sanitized}%`)
    }

    const { data: companies, error } = await query

    if (error) {
      console.error('Database error:', error)
      return res.status(500).json({ success: false, error: 'Database error' })
    }

    res.status(200).json({
      success: true,
      companies: companies || [],
      pagination: {
        limit,
        offset,
        total: companies?.length || 0
      }
    })
  } catch (error: any) {
    console.error('Get companies error:', error)
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
        `${year.year}: Omsättning ${(year.SDI/1000).toFixed(0)} TSEK | EBIT ${(year.EBIT/1000).toFixed(0)} TSEK | Vinst ${(year.DR/1000).toFixed(0)} TSEK`
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
- Omsättning (SDI): ${(masterData.SDI/1000).toFixed(0)} TSEK
- Nettoresultat (DR): ${(masterData.DR/1000).toFixed(0)} TSEK
- Rörelseresultat (ORS): ${(masterData.ORS/1000).toFixed(0)} TSEK
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
        `${year.year}: Omsättning ${(year.SDI/1000).toFixed(0)} TSEK | EBIT ${(year.EBIT/1000).toFixed(0)} TSEK | Vinst ${(year.DR/1000).toFixed(0)} TSEK`
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

BALANSRÄKNING (begränsad data):
- Omsättning (SDI): ${(masterData.SDI/1000).toFixed(0)} TSEK
- Nettoresultat (DR): ${(masterData.DR/1000).toFixed(0)} TSEK
- Rörelseresultat (ORS): ${(masterData.ORS/1000).toFixed(0)} TSEK
- Anställda: ${masterData.employees} personer
- Omsättning per anställd: ${(masterData.SDI/masterData.employees/1000).toFixed(0)} TSEK

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
          result.targetPrice = Math.round(selectedValuation.valueEquity / 1000000) // Convert to MSEK
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

async function fetchValuationSourceData(
  supabase: SupabaseClient,
  companyIds: string[]
): Promise<FetchedValuationData> {
  const { data: masterRows, error: masterError } = await supabase
    .from('master_analytics')
    .select(`
      OrgNr,
      name,
      segment_name,
      employees,
      SDI,
      DR,
      ORS,
      Revenue_growth,
      EBIT_margin,
      NetProfit_margin
    `)
    .in('OrgNr', companyIds)

  if (masterError) {
    throw new Error(`Failed to fetch master data: ${masterError.message}`)
  }

  const { data: accountRows, error: accountsError } = await supabase
    .from('company_accounts_by_id')
    .select('*')
    .in('organisationNumber', companyIds)
    .order('year', { ascending: false })

  if (accountsError) {
    throw new Error(`Failed to fetch financial accounts: ${accountsError.message}`)
  }

  const accountsMap = new Map<string, any[]>()
  for (const row of accountRows || []) {
    const orgnr = pickOrgNumber(row)
    if (!orgnr) continue
    const existing = accountsMap.get(orgnr) || []
    existing.push(row)
    accountsMap.set(orgnr, existing)
  }

  const companies = (masterRows || []).map((row: any) => {
    const orgnr = pickOrgNumber(row)
    const fallbackYear = new Date().getFullYear()
    const fallbackRecord = {
      year: fallbackYear,
      SDI: row?.SDI,
      RG: row?.RG,
      EBIT: row?.RG,
      EBITDA: row?.ORS,
      DR: row?.DR,
      EK: row?.EK,
      SV: row?.SV,
      SEK: row?.SEK,
    }
    const rawRecords = accountsMap.get(orgnr || '') || []
    const records = rawRecords.length ? rawRecords : [fallbackRecord]

    return {
      orgnr: orgnr || row?.OrgNr,
      name: row?.name || 'Okänt bolag',
      industry: row?.segment_name || null,
      employees: typeof row?.employees === 'number' ? row.employees : Number.parseInt(row?.employees, 10) || null,
      records,
    }
  })

  return { companies }
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

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content)

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

    const { companies: fetchedCompanies } = await fetchValuationSourceData(supabase, companyIds)

    if (!fetchedCompanies.length) {
      return res.status(404).json({ success: false, error: 'Inga företag hittades för angivna ID' })
    }

    const companies: ValuationCompanyResponse[] = fetchedCompanies.map((company) => {
      const { metrics, history } = computeValuationMetrics(company.records)
      return {
        orgnr: company.orgnr,
        name: company.name,
        industry: company.industry,
        employees: company.employees,
        metrics,
        history,
        chartSeries: buildChartSeries(history),
      }
    })

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

    // Fetch company data directly from master_analytics (same as /api/companies)
    const { data: companyData, error } = await supabase
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
      .single()

    if (error || !companyData) {
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

    // Fetch company data directly from master_analytics (same as /api/companies)
    const { data: companyData, error } = await supabase
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
      .single()

    if (error || !companyData) {
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

    // Fetch company data directly from master_analytics (same as /api/companies)
    const { data: companyData, error } = await supabase
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
      .single()

    if (error || !companyData) {
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
      benchmarks: dataResult.data.benchmarks
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

    const success = await createAssumptions(supabase, assumptions)

    if (!success) {
      return res.status(500).json({ success: false, error: 'Failed to create assumptions' })
    }

    res.status(201).json({
      success: true,
      message: 'Assumptions created successfully'
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

// Start server
app.listen(port, () => {
  console.log(`🚀 Enhanced AI Analysis Server running on http://localhost:${port}`)
  console.log('✨ Features: Enhanced Codex AI analysis with Swedish localization')
  console.log('📊 Features: Multi-model valuation engine with EV vs Equity handling')
})
