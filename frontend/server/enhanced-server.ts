import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import OpenAI from 'openai'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

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
    const { companies, analysisType = 'deep', instructions, filters, initiatedBy } = req.body as AnalysisRequest || {}
    
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
    
    await insertRunRecord(supabase, {
      id: runId,
      status: 'running',
      modelVersion,
      analysisMode: analysisType,
      startedAt,
      initiatedBy: typeof initiatedBy === 'string' ? initiatedBy : null,
      filters,
    })

    const companiesResults: CompanyResult[] = []
    const screeningResults: ScreeningResult[] = []
    const errors: string[] = []

    if (analysisType === 'screening') {
      // Process screening in batches for efficiency
      const batchSize = 5
      for (let i = 0; i < uniqueSelections.length; i += batchSize) {
        const batch = uniqueSelections.slice(i, i + batchSize)
        try {
          const batchResults = await processScreeningBatch(supabase, openai, runId, batch, instructions)
          screeningResults.push(...batchResults)
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
    const runPayload: RunPayload = {
      id: runId,
      status: errors.length > 0 ? 'completed_with_errors' : 'completed',
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

    const limit = Math.min(Math.max(parseInt(req.query.limit as string || '10', 10) || 10, 1), 50)
    const history = await fetchRunHistory(supabase, limit)
    
    res.status(200).json({ 
      success: true, 
      data: history,
      pagination: {
        limit,
        total: history.length
      }
    })
  } catch (error: any) {
    console.error('Get analysis runs error:', error)
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
      financialMetrics: item.financial_metrics ? JSON.parse(item.financial_metrics) : undefined,
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
    
    const { data: companies, error } = await supabase
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
  const { error } = await supabase
    .from('ai_analysis_runs')
    .insert([{
      id: run.id,
      initiated_by: run.initiatedBy,
      model_version: run.modelVersion,
      analysis_mode: run.analysisMode,
      status: run.status,
      started_at: run.startedAt,
      completed_at: run.completedAt,
      error_message: run.errorMessage
      // Removed filters column as it doesn't exist in the schema
    }])
  
  if (error) {
    console.error('Error inserting run record:', error)
  }
}

async function processScreeningBatch(
  supabase: SupabaseClient,
  openai: OpenAI,
  runId: string,
  batch: CompanySelection[],
  instructions?: string
): Promise<ScreeningResult[]> {
  const results: ScreeningResult[] = []
  
  for (const selection of batch) {
    const orgnr = selection.OrgNr || selection.orgnr || ''
    if (!orgnr) continue
    
    try {
      // Fetch comprehensive company data from master_analytics
      const { data: companyData, error } = await supabase
        .from('master_analytics')
        .select('*')
        .eq('OrgNr', orgnr)
        .single()
      
      if (error || !companyData) {
        console.error(`Failed to fetch data for ${orgnr}:`, error)
        continue
      }
      
      // Create screening prompt
      const prompt = `Analysera detta svenska företag för förvärvsintresse:

Företag: ${companyData.name}
Organisationsnummer: ${orgnr}
Bransch: ${companyData.segment_name || 'Okänd'}
Stad: ${companyData.city || 'Okänd'}
Anställda: ${companyData.employees || 'Okänt'}

FINANSIELL DATA (från allabolag.se):
Nettoomsättning (SDI): ${companyData.SDI ? (companyData.SDI / 1000).toFixed(0) + ' TSEK' : 'Okänd'}
Årets resultat (DR): ${companyData.DR ? (companyData.DR / 1000).toFixed(0) + ' TSEK' : 'Okänd'}
Årets resultat (ORS): ${companyData.ORS ? (companyData.ORS / 1000).toFixed(0) + ' TSEK' : 'Okänd'}
Tillväxt: ${companyData.Revenue_growth ? (companyData.Revenue_growth * 100).toFixed(1) + '%' : 'Okänd'}
EBIT-marginal: ${companyData.EBIT_margin ? (companyData.EBIT_margin * 100).toFixed(1) + '%' : 'Okänd'}
Nettovinstmarginal: ${companyData.NetProfit_margin ? (companyData.NetProfit_margin * 100).toFixed(1) + '%' : 'Okänd'}

KOMPLETT FINANSIELL ANALYS:
Baserat på de tillgängliga nyckeltalen från allabolag.se, analysera:
- Finansiell hälsa: Omsättning, vinst, marginaler
- Tillväxtpotential: Revenue_growth och trend
- Lönsamhet: EBIT-marginal och nettovinstmarginal
- Förvärvsattraktivitet: Storlek, bransch, digital närvaro

${instructions ? `Specifika instruktioner: ${instructions}` : ''}

Ge en snabb bedömning (1-100 poäng) baserat på:
- Finansiell hälsa (SDI, DR, ORS, marginaler)
- Lönsamhet (EBIT-marginal, Nettovinstmarginal)
- Tillväxtpotential (Revenue_growth, trend)
- Förvärvsattraktivitet (storlek, bransch, digital närvaro)

Svara ENDAST med giltig JSON utan markdown-formatering:
{
  "screeningScore": 85,
  "riskFlag": "Low",
  "briefSummary": "Kort sammanfattning på 2-3 meningar"
}

VIKTIGT: Svara ENDAST med JSON-objektet ovan, utan ytterligare text eller markdown-formatering.`

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
        temperature: 0.1,
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
        companyName: companyData.name,
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
          company_name: companyData.name,
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
  
  return results
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
    // Fetch comprehensive company data from master_analytics
    const { data: companyData, error } = await supabase
      .from('master_analytics')
      .select('*')
      .eq('OrgNr', orgnr)
      .single()
    
    if (error || !companyData) {
      console.error(`Failed to fetch data for ${orgnr}:`, error)
      return null
    }
    
    // Create comprehensive analysis prompt
    const prompt = `Genomför en djupgående förvärvsanalys av detta svenska företag:

FÖRETAGSINFORMATION:
Företag: ${companyData.name}
Organisationsnummer: ${orgnr}
Bransch: ${companyData.segment_name || 'Okänd'}
Stad: ${companyData.city || 'Okänd'}
Adress: ${companyData.address || 'Okänd'}
Hemsida: ${companyData.homepage || 'Okänd'}
E-post: ${companyData.email || 'Okänd'}

GRUNDDATA:
Anställda: ${companyData.employees || 'Okänt'}

FINANSIELL DATA (från allabolag.se):
Nettoomsättning (SDI): ${companyData.SDI ? (companyData.SDI / 1000).toFixed(0) + ' TSEK' : 'Okänd'}
Årets resultat (DR): ${companyData.DR ? (companyData.DR / 1000).toFixed(0) + ' TSEK' : 'Okänd'}
Årets resultat (ORS): ${companyData.ORS ? (companyData.ORS / 1000).toFixed(0) + ' TSEK' : 'Okänd'}
Tillväxt: ${companyData.Revenue_growth ? (companyData.Revenue_growth * 100).toFixed(1) + '%' : 'Okänd'}
EBIT-marginal: ${companyData.EBIT_margin ? (companyData.EBIT_margin * 100).toFixed(1) + '%' : 'Okänd'}
Nettovinstmarginal: ${companyData.NetProfit_margin ? (companyData.NetProfit_margin * 100).toFixed(1) + '%' : 'Okänd'}

FINANSIELL ANALYS:
Baserat på de tillgängliga nyckeltalen från allabolag.se, analysera:
- Finansiell hälsa: Omsättning, vinst, marginaler
- Tillväxtpotential: Revenue_growth och trend
- Lönsamhet: EBIT-marginal och nettovinstmarginal
- Förvärvsattraktivitet: Storlek, bransch, digital närvaro

DIGITAL NÄRVARO: ${companyData.digital_presence ? 'Ja' : 'Nej'}
REGISTRERAT: ${companyData.incorporation_date || 'Okänt'}

${instructions ? `SPECIFIKA INSTRUKTIONER: ${instructions}` : ''}

Genomför en omfattande analys baserad på de faktiska finansiella nyckeltalen från allabolag.se. Fokusera på:

1. FINANSIELL HÄLSA: 
   - P&L: SDI (nettoomsättning), DR/ORS (årets resultat), marginaler
   - Lönsamhet: EBIT-marginal och nettovinstmarginal

2. TILLVÄXT OCH POTENTIAL:
   - Revenue_growth och trendanalys
   - Finansiell styrka för expansion

3. MARKNADSPOSITION OCH FÖRVÄRVSATTRAKTIVITET:
   - Storlek, bransch, digital närvaro, konkurrenskraft
   - Potential för tillväxt, synergier, risker
   - Finansiell stabilitet för förvärv

Svara ENDAST med giltig JSON utan markdown-formatering:

{
  "executiveSummary": "Kort executive summary på 2-3 meningar",
  "keyFindings": [
    "Viktigt fynd 1",
    "Viktigt fynd 2",
    "Viktigt fynd 3"
  ],
  "narrative": "Detaljerad analys på 3-4 stycken som täcker finansiell hälsa, marknadsposition, tillväxtpotential och förvärvsattraktivitet",
  "strengths": [
    "Styrka 1",
    "Styrka 2"
  ],
  "weaknesses": [
    "Svaghet 1",
    "Svaghet 2"
  ],
  "opportunities": [
    "Möjlighet 1",
    "Möjlighet 2"
  ],
  "risks": [
    "Risk 1",
    "Risk 2"
  ],
  "acquisitionInterest": "Hög",
  "financialHealth": 8,
  "growthPotential": "Hög",
  "marketPosition": "Stark",
  "targetPrice": 25.5,
  "recommendation": "Pursue",
  "confidence": 4.2,
  "riskScore": 2,
  "financialGrade": "B",
  "commercialGrade": "A",
  "operationalGrade": "B",
  "financialMetrics": {
    "revenue": 150000,
    "profit": 7000,
    "equity": 50000,
    "assets": 200000,
    "liabilities": 150000,
    "cash": 25000,
    "debt": 100000,
    "equityRatio": 25.0,
    "currentRatio": 1.5,
    "debtToEquity": 2.0,
    "returnOnEquity": 14.0,
    "returnOnAssets": 3.5
  },
  "nextSteps": [
    "Nästa steg 1",
    "Nästa steg 2"
  ]
}

VIKTIGT: Svara ENDAST med JSON-objektet ovan, utan ytterligare text eller markdown-formatering.`

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
      temperature: 0.2,
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
      companyName: companyData.name,
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
        company_name: companyData.name,
        summary: result.summary,
        recommendation: result.recommendation,
        confidence: Math.round((result.confidence || 0) * 100), // Convert to integer
        risk_score: Math.round((result.riskScore || 0) * 10), // Convert to integer
        financial_grade: result.financialGrade,
        commercial_grade: result.commercialGrade,
        operational_grade: result.operationalGrade,
        financial_metrics: result.financialMetrics ? JSON.stringify(result.financialMetrics) : null,
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
      financialMetrics: item.financial_metrics ? JSON.parse(item.financial_metrics) : undefined,
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

// Start server
app.listen(port, () => {
  console.log(`🚀 Enhanced AI Analysis Server running on http://localhost:${port}`)
  console.log('✨ Features: Enhanced Codex AI analysis with Swedish localization')
})
