import type { VercelRequest, VercelResponse } from '@vercel/node'
import OpenAI from 'openai'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

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
  nextSteps: string[]
  sections: SectionResult[]
  metrics: MetricResult[]
  audit: AuditResult
  contextSummary?: string
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

interface CompanySnapshot {
  orgnr: string
  companyId?: string | null
  companyName: string
  segmentName?: string | null
  industry?: string | null
  city?: string | null
  employees?: number | null
  metrics: Record<string, any>
  financials: Array<Record<string, any>>
  contextSummary: string
}

interface CompanyDataBundle {
  orgnr: string
  companyId: string | null
  companyName: string
  segmentName?: string | null
  industry?: string | null
  city?: string | null
  email?: string | null
  homepage?: string | null
  incorporationDate?: string | null
  employees?: number | null
  financials: FinancialRecord[]
  kpis: KPIRecord[]
  contextSummary: string
}

interface FinancialRecord {
  year: number
  revenue: Nullable<number>
  profit: Nullable<number>
  employees: Nullable<number>
}

interface KPIRecord {
  year: number
  revenue_growth: Nullable<number>
  ebit_margin: Nullable<number>
  net_margin: Nullable<number>
  equity_ratio: Nullable<number>
  return_on_equity: Nullable<number>
}

const MODEL_DEFAULT = process.env.OPENAI_MODEL || 'gpt-4o'
const MODEL_SCREENING = 'gpt-3.5-turbo'
const PROMPT_COST_PER_1K = 0.15
const COMPLETION_COST_PER_1K = 0.6
const SCREENING_PROMPT_COST_PER_1K = 0.0005
const SCREENING_COMPLETION_COST_PER_1K = 0.0015

const ANALYSIS_QUESTION =
  "Based on this company's financial data and KPIs, analyze its performance and attractiveness for acquisition. Highlight major strengths, weaknesses, and potential red flags."

const analysisSchema = {
  name: 'CompanyAnalysisBundle',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      recommendation: { type: 'string' },
      confidence: { type: 'number' },
      risk_score: { type: 'number' },
      financial_grade: { type: 'string' },
      commercial_grade: { type: 'string' },
      operational_grade: { type: 'string' },
      next_steps: { type: 'array', items: { type: 'string' } },
      sections: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            section_type: { type: 'string' },
            title: { type: 'string' },
            content_md: { type: 'string' },
            supporting_metrics: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  metric_name: { type: 'string' },
                  metric_value: { type: 'number' },
                  metric_unit: { type: 'string' },
                  source: { type: 'string' },
                  year: { type: 'integer' },
                },
                required: ['metric_name', 'metric_value'],
              },
            },
            confidence: { type: 'number' },
            tokens_used: { type: 'integer' },
          },
          required: ['section_type', 'content_md'],
        },
      },
      metrics: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            metric_name: { type: 'string' },
            metric_value: { type: 'number' },
            metric_unit: { type: 'string' },
            source: { type: 'string' },
            year: { type: 'integer' },
            confidence: { type: 'number' },
          },
          required: ['metric_name', 'metric_value'],
        },
      },
    },
    required: [
      'summary',
      'recommendation',
      'confidence',
      'risk_score',
      'financial_grade',
      'commercial_grade',
      'operational_grade',
      'sections',
      'metrics',
    ],
  },
}

const screeningSchema = {
  name: 'ScreeningAnalysis',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      screening_score: {
        type: 'number',
        description: 'Overall screening score from 1-100 based on financial health, growth, and market position.',
        minimum: 1,
        maximum: 100,
      },
      risk_flag: {
        type: 'string',
        description: 'Risk level: Low, Medium, or High',
        enum: ['Low', 'Medium', 'High'],
      },
      brief_summary: {
        type: 'string',
        description: '2-3 sentences highlighting key strengths and weaknesses.',
      },
    },
    required: ['screening_score', 'risk_flag', 'brief_summary'],
  },
}

let cachedSupabase: SupabaseClient | null | undefined

function getSupabase(): SupabaseClient | null {
  if (cachedSupabase !== undefined) {
    return cachedSupabase
  }
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) {
    cachedSupabase = null
    return cachedSupabase
  }
  cachedSupabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cachedSupabase
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    return handlePost(req, res)
  }
  if (req.method === 'GET') {
    return handleGet(req, res)
  }
  res.status(405).json({ success: false, error: 'Method not allowed' })
}

async function handlePost(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabase()
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Supabase credentials not configured' })
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ success: false, error: 'OpenAI API key not configured' })
  }

  const { companies, analysisType = 'deep', instructions, filters, initiatedBy } = req.body as AnalysisRequest || {}
  if (!Array.isArray(companies) || companies.length === 0) {
    return res.status(400).json({ success: false, error: 'No companies provided' })
  }

  if (analysisType !== 'screening' && analysisType !== 'deep') {
    return res.status(400).json({ success: false, error: 'Invalid analysis type. Must be "screening" or "deep"' })
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
    return res.status(400).json({ success: false, error: 'Could not resolve any valid organisation numbers' })
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
    // Process deep analysis one by one
    for (const selection of uniqueSelections) {
      const orgnr = String(selection?.OrgNr || selection?.orgnr || '').trim()
      if (!orgnr) {
        errors.push('Missing organisation number for selection')
        continue
      }
      try {
        const bundle = await fetchCompanyDataBundle(supabase, orgnr)
        const prompt = buildPrompt(bundle.contextSummary, instructions)
        const { parsed, rawText, usage, latency } = await invokeModel(openai, prompt)
        const result = buildCompanyResult(
          bundle.orgnr,
          bundle.companyName,
          bundle.companyId,
          parsed,
          usage,
          latency,
          prompt,
          rawText,
          bundle.contextSummary
        )
        companiesResults.push(result)
        await persistCompanyResult(supabase, runId, result, bundle)
      } catch (error: any) {
        console.error('AI analysis failed', error)
        errors.push(`${orgnr}: ${error?.message || 'Unknown error'}`)
      }
    }
  }

  const completedAt = new Date().toISOString()
  await updateRunRecord(supabase, {
    id: runId,
    status: errors.length > 0 ? 'completed_with_errors' : 'completed',
    completedAt,
    errorMessage: errors.length > 0 ? errors.join('; ') : null,
  })

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
}

async function handleGet(req: VercelRequest, res: VercelResponse) {
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
    return res.status(200).json({ success: true, history })
  }

  return res.status(400).json({ success: false, error: 'Specify runId or history query parameter' })
}

async function processScreeningBatch(
  supabase: SupabaseClient,
  openai: OpenAI,
  runId: string,
  batch: CompanySelection[],
  instructions?: string
): Promise<ScreeningResult[]> {
  const companiesData = []
  
  // Fetch company data for the batch
  for (const selection of batch) {
    const orgnr = String(selection?.OrgNr || selection?.orgnr || '').trim()
    if (!orgnr) continue
    
    try {
      const snapshot = await fetchCompanySnapshot(supabase, orgnr)
      companiesData.push({
        orgnr: snapshot.orgnr,
        name: snapshot.companyName,
        industry: snapshot.segmentName || snapshot.industry || 'Unknown',
        financials: snapshot.financials
      })
    } catch (error) {
      console.error(`Failed to fetch data for ${orgnr}:`, error)
    }
  }
  
  if (companiesData.length === 0) {
    return []
  }
  
  // Build batch screening prompt
  const prompt = buildScreeningPrompt(companiesData, instructions)
  const { parsed, rawText, usage, latency } = await invokeScreeningModel(openai, prompt)
  
  // Parse results and create ScreeningResult objects
  const results: ScreeningResult[] = []
  for (let i = 0; i < Math.min(parsed.length, companiesData.length); i++) {
    const resultData = parsed[i]
    const companyData = companiesData[i]
    
    const result: ScreeningResult = {
      orgnr: companyData.orgnr,
      companyName: companyData.name,
      screeningScore: resultData?.screening_score ?? null,
      riskFlag: resultData?.risk_flag ?? null,
      briefSummary: resultData?.brief_summary ?? null,
      audit: {
        prompt,
        response: rawText,
        latency_ms: latency,
        prompt_tokens: usage.input_tokens || 0,
        completion_tokens: usage.output_tokens || 0,
        cost_usd: calculateScreeningCost(usage.input_tokens || 0, usage.output_tokens || 0),
      }
    }
    
    results.push(result)
    await persistScreeningResult(supabase, runId, result)
  }
  
  return results
}

function buildScreeningPrompt(companiesData: any[], instructions?: string): string {
  let prompt = 'Analyze these companies for M&A potential. For each, provide:\n\n'
  
  companiesData.forEach((company, index) => {
    const financials = company.financials.map((f: any) => 
      `${f.year}: Rev=${f.revenue || 'N/A'}, Profit=${f.profitAfterTax || 'N/A'}`
    ).join(', ')
    
    prompt += `${index + 1}. ${company.name} (${company.orgnr})\n`
    prompt += `   Industry: ${company.industry}\n`
    prompt += `   Financials: ${financials || 'No data'}\n\n`
  })
  
  prompt += 'Respond with JSON array in this exact format:\n'
  prompt += '[\n'
  prompt += '  {\n'
  prompt += '    "orgnr": "<orgnr>",\n'
  prompt += '    "screening_score": <number 1-100>,\n'
  prompt += '    "risk_flag": "<Low/Medium/High>",\n'
  prompt += '    "brief_summary": "<2-3 sentences>"\n'
  prompt += '  },\n'
  prompt += '  ...\n'
  prompt += ']\n'
  
  if (instructions) {
    prompt += `\nAdditional instructions: ${instructions}`
  }
  
  return prompt
}

async function invokeScreeningModel(openai: OpenAI, prompt: string) {
  const started = Date.now()
  const response = await openai.responses.create({
    model: MODEL_SCREENING,
    temperature: 0.1,
    max_output_tokens: 500,
    input: [
      { role: 'system', content: [{ type: 'text', text: screeningSystemPrompt }] },
      { role: 'user', content: [{ type: 'text', text: prompt }] },
    ],
    response_format: { type: 'json_schema', json_schema: screeningSchema },
  })
  const latency = Date.now() - started

  let rawText = (response as any).output_text as string | undefined
  if (!rawText) {
    try {
      rawText = (response as any)?.output?.[0]?.content?.[0]?.text
    } catch (error) {
      rawText = '[]'
    }
  }

  let parsed: any = []
  try {
    parsed = JSON.parse(rawText || '[]')
  } catch (error) {
    parsed = []
  }

  const usage: UsageSummary = {}
  const rawUsage: any = (response as any).usage
  if (rawUsage) {
    usage.input_tokens = rawUsage.input_tokens || rawUsage.prompt_tokens || 0
    usage.output_tokens = rawUsage.output_tokens || rawUsage.completion_tokens || 0
    usage.total_tokens = rawUsage.total_tokens || 0
  }

  return { parsed, rawText: rawText || '[]', usage, latency }
}

async function persistScreeningResult(supabase: SupabaseClient, runId: string, result: ScreeningResult) {
  const screeningRow = {
    run_id: runId,
    orgnr: result.orgnr,
    company_name: result.companyName,
    screening_score: result.screeningScore,
    risk_flag: result.riskFlag,
    brief_summary: result.briefSummary,
  }

  const { error: screeningError } = await supabase
    .schema('ai_ops')
    .from('ai_screening_results')
    .upsert(screeningRow)
  if (screeningError) throw screeningError

  const { error: auditError } = await supabase
    .schema('ai_ops')
    .from('ai_analysis_audit')
    .upsert({
      run_id: runId,
      orgnr: result.orgnr,
      module: 'screening_analysis',
      prompt: result.audit.prompt,
      response: result.audit.response,
      model: MODEL_SCREENING,
      latency_ms: result.audit.latency_ms,
      prompt_tokens: result.audit.prompt_tokens,
      completion_tokens: result.audit.completion_tokens,
      cost_usd: result.audit.cost_usd,
    })
  if (auditError) throw auditError
}

function calculateScreeningCost(promptTokens: number, completionTokens: number): number {
  const promptCost = (promptTokens / 1000) * SCREENING_PROMPT_COST_PER_1K
  const completionCost = (completionTokens / 1000) * SCREENING_COMPLETION_COST_PER_1K
  const total = promptCost + completionCost
  return Number(total.toFixed(4))
}

async function insertRunRecord(
  supabase: SupabaseClient,
  payload: {
    id: string
    status: string
    modelVersion: string
    analysisMode: string
    startedAt: string
    initiatedBy: string | null
    filters?: any
  }
) {
  const { error } = await supabase
    .schema('ai_ops')
    .from('ai_analysis_runs')
    .insert({
      id: payload.id,
      status: payload.status,
      model_version: payload.modelVersion,
      analysis_mode: payload.analysisMode,
      started_at: payload.startedAt,
      initiated_by: payload.initiatedBy,
      filters_json: payload.filters || {},
    })
  if (error) throw error
}

async function updateRunRecord(
  supabase: SupabaseClient,
  payload: { id: string; status: string; completedAt: string; errorMessage: string | null }
) {
  const { error } = await supabase
    .schema('ai_ops')
    .from('ai_analysis_runs')
    .update({
      status: payload.status,
      completed_at: payload.completedAt,
      error_message: payload.errorMessage,
    })
    .eq('id', payload.id)
  if (error) throw error
}

const currencyFormatter = new Intl.NumberFormat('sv-SE', {
  style: 'currency',
  currency: 'SEK',
  maximumFractionDigits: 0,
})

const integerFormatter = new Intl.NumberFormat('sv-SE', {
  maximumFractionDigits: 0,
})

const percentFormatter = new Intl.NumberFormat('sv-SE', {
  maximumFractionDigits: 1,
})

function resolveCompanyId(company: any): string | null {
  const candidates = [
    company?.company_id,
    company?.companyId,
    company?.companyID,
    company?.id,
    company?.companyid,
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim()
    }
  }
  return null
}

function normalizeFinancialRecords(rows: any[] | null | undefined): FinancialRecord[] {
  if (!Array.isArray(rows)) return []
  return rows
    .map((row: any) => {
      const year = Number(row?.year)
      if (!Number.isFinite(year)) {
        return null
      }
      return {
        year,
        revenue: safeNumber(row?.revenue ?? row?.Revenue ?? row?.SDI),
        profit: safeNumber(row?.profit ?? row?.Profit ?? row?.NetIncome ?? row?.DR),
        employees: safeNumber(row?.employees ?? row?.Employees),
      }
    })
    .filter((row): row is FinancialRecord => Boolean(row))
    .sort((a, b) => b.year - a.year)
    .slice(0, 4)
}

function normalizeKpiRecords(rows: any[] | null | undefined): KPIRecord[] {
  if (!Array.isArray(rows)) return []
  return rows
    .map((row: any) => {
      const year = Number(row?.year)
      if (!Number.isFinite(year)) {
        return null
      }
      return {
        year,
        revenue_growth: safeNumber(row?.revenue_growth ?? row?.Revenue_growth ?? row?.RG),
        ebit_margin: safeNumber(row?.ebit_margin ?? row?.EBIT_margin),
        net_margin: safeNumber(row?.net_margin ?? row?.NetProfit_margin ?? row?.net_margin_pct),
        equity_ratio: safeNumber(row?.equity_ratio ?? row?.Equity_ratio),
        return_on_equity: safeNumber(row?.return_on_equity ?? row?.Return_on_equity ?? row?.roe),
      }
    })
    .filter((row): row is KPIRecord => Boolean(row))
    .sort((a, b) => b.year - a.year)
    .slice(0, 4)
}

function formatCurrency(value: Nullable<number>): string {
  if (value === null || value === undefined) return 'N/A'
  try {
    return currencyFormatter.format(value)
  } catch (error) {
    return value.toString()
  }
}

function formatInteger(value: Nullable<number>): string {
  if (value === null || value === undefined) return 'N/A'
  try {
    return integerFormatter.format(value)
  } catch (error) {
    return value.toString()
  }
}

function formatPercent(value: Nullable<number>): string {
  if (value === null || value === undefined) return 'N/A'
  const normalized = Math.abs(value) <= 1 ? value * 100 : value
  try {
    return `${percentFormatter.format(normalized)}%`
  } catch (error) {
    return `${normalized.toFixed(1)}%`
  }
}

function formatPercentChange(value: Nullable<number>): string {
  if (value === null || value === undefined) return 'N/A'
  const percent = value * 100
  try {
    return `${percentFormatter.format(percent)}%`
  } catch (error) {
    return `${percent.toFixed(1)}%`
  }
}

function formatContextSummary({
  company,
  orgnr,
  companyId,
  financials,
  kpis,
  employees,
}: {
  company: any
  orgnr: string
  companyId: string | null
  financials: FinancialRecord[]
  kpis: KPIRecord[]
  employees: Nullable<number>
}): string {
  const companyName = company?.name ?? company?.company_name ?? 'Unknown company'
  const generalInfoLines: string[] = [
    `- Name: ${companyName}`,
    `- Organisation number: ${orgnr}`,
  ]

  if (companyId) {
    generalInfoLines.push(`- Company ID: ${companyId}`)
  }

  const segment = company?.segment_name ?? company?.segment
  if (segment) {
    generalInfoLines.push(`- Segment: ${segment}`)
  }

  const industry = company?.industry_name ?? company?.industry
  if (industry) {
    generalInfoLines.push(`- Industry: ${industry}`)
  }

  if (company?.city) {
    generalInfoLines.push(`- City: ${company.city}`)
  }

  const incorporation = company?.incorporation_date ?? company?.incorporationDate
  if (incorporation) {
    generalInfoLines.push(`- Incorporated: ${incorporation}`)
  }

  if (company?.homepage) {
    generalInfoLines.push(`- Website: ${company.homepage}`)
  }

  if (company?.email) {
    generalInfoLines.push(`- Email: ${company.email}`)
  }

  if (employees !== null && employees !== undefined) {
    generalInfoLines.push(`- Employees (latest): ${formatInteger(employees)}`)
  }

  const lastUpdated = company?.last_updated ?? company?.lastUpdated
  if (lastUpdated) {
    generalInfoLines.push(`- Last updated in companies: ${lastUpdated}`)
  }

  const coverageYears = uniqueSortedYears([...financials, ...kpis])
  if (coverageYears.length > 0) {
    const firstYear = coverageYears[0]
    const lastYear = coverageYears[coverageYears.length - 1]
    const coverageLabel = firstYear === lastYear ? `${firstYear}` : `${firstYear}–${lastYear}`
    generalInfoLines.push(`- Data coverage: ${coverageLabel}`)
  }

  const sections: string[] = []
  sections.push(['### General Information', ...generalInfoLines].join('\n'))

  const financialLines = financials.length
    ? financials.map((row) => {
        const metrics: string[] = []
        if (row.revenue !== null && row.revenue !== undefined) {
          metrics.push(`Revenue ${formatCurrency(row.revenue)}`)
        }
        if (row.profit !== null && row.profit !== undefined) {
          metrics.push(`Profit ${formatCurrency(row.profit)}`)
        }
        if (row.employees !== null && row.employees !== undefined) {
          metrics.push(`Employees ${formatInteger(row.employees)}`)
        }
        const metricsText = metrics.length > 0 ? metrics.join(' | ') : 'No financial metrics available'
        return `- ${row.year}: ${metricsText}`
      })
    : ['- No financial records available in company_accounts for the last four fiscal years.']

  sections.push(['### Financial Performance (company_accounts)', ...financialLines].join('\n'))

  const trendLines = describeFinancialTrends(financials)
  if (trendLines.length > 0) {
    sections.push(['### Financial Trends & Momentum', ...trendLines].join('\n'))
  }

  const kpiLines = kpis.length
    ? kpis.map((row) => {
        const metrics: string[] = []
        if (row.revenue_growth !== null && row.revenue_growth !== undefined) {
          metrics.push(`Revenue growth ${formatPercent(row.revenue_growth)}`)
        }
        if (row.ebit_margin !== null && row.ebit_margin !== undefined) {
          metrics.push(`EBIT margin ${formatPercent(row.ebit_margin)}`)
        }
        if (row.net_margin !== null && row.net_margin !== undefined) {
          metrics.push(`Net margin ${formatPercent(row.net_margin)}`)
        }
        if (row.equity_ratio !== null && row.equity_ratio !== undefined) {
          metrics.push(`Equity ratio ${formatPercent(row.equity_ratio)}`)
        }
        if (row.return_on_equity !== null && row.return_on_equity !== undefined) {
          metrics.push(`Return on equity ${formatPercent(row.return_on_equity)}`)
        }
        const metricsText = metrics.length > 0 ? metrics.join(' | ') : 'No KPI metrics recorded'
        return `- ${row.year}: ${metricsText}`
      })
    : ['- No KPI records available in company_kpis for the last four fiscal years.']

  sections.push(['### KPI Summary (company_kpis)', ...kpiLines].join('\n'))

  const kpiHighlights = buildKpiHighlights(kpis)
  if (kpiHighlights.length > 0) {
    sections.push(['### KPI Highlights', ...kpiHighlights].join('\n'))
  }

  sections.push(
    [
      '### Data Sources',
      '- companies (core metadata)',
      '- company_accounts (last four reported financial years)',
      '- company_kpis (last four KPI snapshots)',
    ].join('\n')
  )

  return sections.join('\n\n')
}

function describeFinancialTrends(financials: FinancialRecord[]): string[] {
  if (!Array.isArray(financials) || financials.length < 2) return []
  const metrics: Array<{ key: keyof FinancialRecord; label: string; formatter: (value: Nullable<number>) => string }> = [
    { key: 'revenue', label: 'Revenue', formatter: formatCurrency },
    { key: 'profit', label: 'Profit after tax', formatter: formatCurrency },
    { key: 'employees', label: 'Employees', formatter: formatInteger },
  ]

  const lines: string[] = []
  for (const metric of metrics) {
    const line = buildFinancialTrendLine(financials, metric.key, metric.label, metric.formatter)
    if (line) {
      lines.push(line)
    }
  }
  return lines
}

function buildFinancialTrendLine(
  financials: FinancialRecord[],
  key: keyof FinancialRecord,
  label: string,
  formatter: (value: Nullable<number>) => string
): string | null {
  const validRecords = financials.filter((row) => row[key] !== null && row[key] !== undefined)
  if (validRecords.length < 2) {
    return null
  }

  const latest = validRecords[0]
  const earliest = validRecords[validRecords.length - 1]
  const latestValue = latest[key]
  const earliestValue = earliest[key]

  if (latestValue === null || latestValue === undefined || earliestValue === null || earliestValue === undefined) {
    return null
  }

  const change = (latestValue as number) - (earliestValue as number)
  if (change === 0) {
    return `- ${label} remained stable at ${formatter(latestValue)} between ${earliest.year} and ${latest.year}.`
  }

  const direction = change > 0 ? 'increased' : 'decreased'
  const signSymbol = change > 0 ? '+' : '-'
  const changeSummaryParts: string[] = []
  changeSummaryParts.push(`${signSymbol}${formatter(Math.abs(change))}`)

  const percentChange = earliestValue !== 0 ? ((latestValue as number) - (earliestValue as number)) / Math.abs(earliestValue as number) : null
  if (percentChange !== null) {
    changeSummaryParts.push(`${signSymbol}${formatPercentChange(Math.abs(percentChange))}`)
  }

  const changeSummary = changeSummaryParts.length > 0 ? ` (${changeSummaryParts.join(', ')})` : ''

  return `- ${label} ${direction} from ${formatter(earliestValue)} (${earliest.year}) to ${formatter(latestValue)} (${latest.year})${changeSummary}.`
}

function buildKpiHighlights(kpis: KPIRecord[]): string[] {
  if (!Array.isArray(kpis) || kpis.length === 0) return []
  const highlights: string[] = []
  const latest = kpis[0]

  if (latest.revenue_growth !== null && latest.revenue_growth !== undefined) {
    highlights.push(`- Latest revenue growth (${latest.year}): ${formatPercent(latest.revenue_growth)}`)
  }
  if (latest.ebit_margin !== null && latest.ebit_margin !== undefined) {
    highlights.push(`- Latest EBIT margin (${latest.year}): ${formatPercent(latest.ebit_margin)}`)
  }
  if (latest.net_margin !== null && latest.net_margin !== undefined) {
    highlights.push(`- Latest net margin (${latest.year}): ${formatPercent(latest.net_margin)}`)
  }
  if (latest.equity_ratio !== null && latest.equity_ratio !== undefined) {
    highlights.push(`- Latest equity ratio (${latest.year}): ${formatPercent(latest.equity_ratio)}`)
  }
  if (latest.return_on_equity !== null && latest.return_on_equity !== undefined) {
    highlights.push(`- Latest return on equity (${latest.year}): ${formatPercent(latest.return_on_equity)}`)
  }

  if (kpis.length > 1) {
    const avgEbit = average(kpis.map((row) => row.ebit_margin))
    if (avgEbit !== null) {
      highlights.push(`- Average EBIT margin (${kpis.length} years): ${formatPercent(avgEbit)}`)
    }
    const avgNetMargin = average(kpis.map((row) => row.net_margin))
    if (avgNetMargin !== null) {
      highlights.push(`- Average net margin (${kpis.length} years): ${formatPercent(avgNetMargin)}`)
    }
    const avgRevenueGrowth = average(kpis.map((row) => row.revenue_growth))
    if (avgRevenueGrowth !== null) {
      highlights.push(`- Average revenue growth (${kpis.length} years): ${formatPercent(avgRevenueGrowth)}`)
    }
  }

  return highlights
}

function average(values: Array<Nullable<number>>): Nullable<number> {
  const filtered = values.filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value))
  if (filtered.length === 0) return null
  const sum = filtered.reduce((acc, value) => acc + value, 0)
  return sum / filtered.length
}

function uniqueSortedYears(records: Array<{ year: number }>): number[] {
  const years = records
    .map((record) => Number(record?.year))
    .filter((year) => Number.isFinite(year))
  return Array.from(new Set(years)).sort((a, b) => a - b)
}

async function fetchCompanyDataBundle(supabase: SupabaseClient, orgnr: string): Promise<CompanyDataBundle> {
  const trimmedOrgnr = String(orgnr).trim()

  const baseQuery = supabase.from('companies').select('*').eq('OrgNr', trimmedOrgnr).maybeSingle()
  const { data: companyByOrgNr, error: baseError } = await baseQuery
  if (baseError) throw baseError

  let companyRecord = companyByOrgNr
  if (!companyRecord) {
    const { data: fallbackCompany, error: fallbackError } = await supabase
      .from('companies')
      .select('*')
      .eq('orgnr', trimmedOrgnr)
      .maybeSingle()
    if (fallbackError) throw fallbackError
    companyRecord = fallbackCompany
  }

  if (!companyRecord) {
    throw new Error('Company not found in companies')
  }

  const canonicalOrgnr = String(companyRecord.OrgNr ?? companyRecord.orgnr ?? trimmedOrgnr).trim()

  const { data: accounts, error: accountsError } = await supabase
    .from('company_accounts')
    .select('*')
    .or(`OrgNr.eq.${canonicalOrgnr},orgnr.eq.${canonicalOrgnr}`)
    .order('year', { ascending: false })
    .limit(4)
  if (accountsError) throw accountsError

  const { data: kpis, error: kpisError } = await supabase
    .from('company_kpis')
    .select('*')
    .or(`OrgNr.eq.${canonicalOrgnr},orgnr.eq.${canonicalOrgnr}`)
    .order('year', { ascending: false })
    .limit(4)
  if (kpisError) throw kpisError

  const financials = normalizeFinancialRecords(accounts)
  const kpiRecords = normalizeKpiRecords(kpis)
  const companyId = resolveCompanyId(companyRecord)
  const employees = financials.length > 0
    ? financials[0].employees ?? safeNumber(companyRecord?.employees ?? companyRecord?.Employees)
    : safeNumber(companyRecord?.employees ?? companyRecord?.Employees)

  const contextSummary = formatContextSummary({
    company: companyRecord,
    orgnr: canonicalOrgnr,
    companyId,
    financials,
    kpis: kpiRecords,
    employees,
  })

  return {
    orgnr: canonicalOrgnr,
    companyId,
    companyName: (companyRecord?.name ?? companyRecord?.company_name ?? 'Unknown company') as string,
    segmentName: companyRecord?.segment_name ?? companyRecord?.segment ?? null,
    industry: companyRecord?.industry_name ?? companyRecord?.industry ?? null,
    city: companyRecord?.city ?? null,
    email: companyRecord?.email ?? null,
    homepage: companyRecord?.homepage ?? null,
    incorporationDate: companyRecord?.incorporation_date ?? companyRecord?.incorporationDate ?? null,
    employees: employees ?? null,
    financials,
    kpis: kpiRecords,
    contextSummary,
  }
}

async function fetchCompanySnapshot(supabase: SupabaseClient, orgnr: string): Promise<CompanySnapshot> {
  const bundle = await fetchCompanyDataBundle(supabase, orgnr)
  const latestFinancial = bundle.financials[0]
  const latestKpi = bundle.kpis[0]

  const metrics: Record<string, any> = {
    revenue: latestFinancial?.revenue ?? null,
    profit: latestFinancial?.profit ?? null,
    employees: latestFinancial?.employees ?? bundle.employees ?? null,
    revenue_growth: latestKpi?.revenue_growth ?? null,
    ebit_margin: latestKpi?.ebit_margin ?? null,
    net_margin: latestKpi?.net_margin ?? null,
    equity_ratio: latestKpi?.equity_ratio ?? null,
    return_on_equity: latestKpi?.return_on_equity ?? null,
  }

  const financials = bundle.financials.map((row) => ({
    year: row.year,
    revenue: row.revenue,
    profitAfterTax: row.profit,
    employees: row.employees,
  }))

  return {
    orgnr: bundle.orgnr,
    companyId: bundle.companyId,
    companyName: bundle.companyName,
    segmentName: bundle.segmentName ?? null,
    industry: bundle.industry ?? null,
    city: bundle.city ?? null,
    employees: bundle.employees ?? null,
    metrics,
    financials,
    contextSummary: bundle.contextSummary,
  }
}

function buildPrompt(contextSummary: string, instructions?: string) {
  const trimmedInstructions = instructions?.trim()
  const instructionText = trimmedInstructions ? `\nAdditional instructions: ${trimmedInstructions}` : ''
  return `${contextSummary}\n\nTask: ${ANALYSIS_QUESTION}${instructionText}\nRespond using the JSON schema provided by the system.`
}

async function invokeModel(openai: OpenAI, prompt: string) {
  const started = Date.now()
  const response = await openai.chat.completions.create({
    model: MODEL_DEFAULT,
    temperature: 0.2,
    max_tokens: 1400,
    messages: [
      { role: 'system', content: defaultSystemPrompt },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_schema', json_schema: analysisSchema },
  })
  const latency = Date.now() - started

  const rawText = response.choices?.[0]?.message?.content ?? '{}'

  let parsed: any = {}
  try {
    parsed = JSON.parse(rawText || '{}')
  } catch (error) {
    parsed = {}
  }

  const usage: UsageSummary = {}
  const rawUsage: any = response.usage
  if (rawUsage) {
    usage.input_tokens = rawUsage.prompt_tokens || rawUsage.input_tokens || 0
    usage.output_tokens = rawUsage.completion_tokens || rawUsage.output_tokens || 0
    usage.total_tokens = rawUsage.total_tokens || 0
  }

  return { parsed, rawText: rawText || '{}', usage, latency }
}

function buildCompanyResult(
  orgnr: string,
  companyName: string,
  companyId: string | null,
  payload: any,
  usage: UsageSummary,
  latencyMs: number,
  prompt: string,
  rawText: string,
  contextSummary: string
): CompanyResult {
  const sections: SectionResult[] = Array.isArray(payload?.sections)
    ? payload.sections.map((section: any) => ({
        section_type: section?.section_type || section?.type || 'unspecified',
        title: section?.title || null,
        content_md: section?.content_md || section?.content || '',
        supporting_metrics: Array.isArray(section?.supporting_metrics) ? section.supporting_metrics : [],
        confidence: section?.confidence ?? null,
        tokens_used: section?.tokens_used ?? null,
      }))
    : []

  const metrics: MetricResult[] = Array.isArray(payload?.metrics)
    ? payload.metrics
        .filter((metric: any) => metric?.metric_value !== undefined && metric?.metric_value !== null)
        .map((metric: any) => ({
          metric_name: metric?.metric_name || metric?.name || 'metric',
          metric_value: Number(metric?.metric_value),
          metric_unit: metric?.metric_unit ?? null,
          source: metric?.source ?? null,
          year: metric?.year ?? null,
          confidence: metric?.confidence ?? null,
        }))
    : []

  const promptTokens = usage.input_tokens || 0
  const completionTokens = usage.output_tokens || 0
  const cost = calculateCost(promptTokens, completionTokens)

  return {
    orgnr,
    companyId,
    companyName,
    summary: payload?.summary ?? null,
    recommendation: payload?.recommendation ?? null,
    confidence: payload?.confidence ?? null,
    riskScore: payload?.risk_score ?? null,
    financialGrade: payload?.financial_grade ?? null,
    commercialGrade: payload?.commercial_grade ?? null,
    operationalGrade: payload?.operational_grade ?? null,
    nextSteps: Array.isArray(payload?.next_steps) ? payload.next_steps : [],
    sections,
    metrics,
    audit: {
      prompt,
      response: rawText,
      latency_ms: latencyMs,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      cost_usd: cost,
    },
    contextSummary,
  }
}

async function persistCompanyResult(
  supabase: SupabaseClient,
  runId: string,
  result: CompanyResult,
  bundle: CompanyDataBundle
) {
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
    next_steps: result.nextSteps,
  }

  const { error: companyError } = await supabase.schema('ai_ops').from('ai_company_analysis').upsert(companyRow)
  if (companyError) throw companyError

  const resolvedCompanyId = bundle.companyId ?? result.companyId ?? result.orgnr
  if (!bundle.companyId && !result.companyId) {
    console.warn(`Falling back to organisation number for company_id linkage: ${result.orgnr}`)
  }

  const analysisPayload = {
    summary: result.summary,
    recommendation: result.recommendation,
    confidence: result.confidence,
    risk_score: result.riskScore,
    financial_grade: result.financialGrade,
    commercial_grade: result.commercialGrade,
    operational_grade: result.operationalGrade,
    next_steps: result.nextSteps,
    sections: result.sections,
    metrics: result.metrics,
  }

  const { error: ragError } = await supabase
    .schema('ai_ops')
    .from('ai_analysis')
    .insert({
      run_id: runId,
      company_id: resolvedCompanyId,
      orgnr: result.orgnr,
      model_version: MODEL_DEFAULT,
      prompt_summary: bundle.contextSummary ?? result.contextSummary ?? null,
      analysis: analysisPayload,
    })
  if (ragError) throw ragError

  if (result.sections.length > 0) {
    const { error } = await supabase
      .schema('ai_ops')
      .from('ai_analysis_sections')
      .upsert(
        result.sections.map((section) => ({
          run_id: runId,
          orgnr: result.orgnr,
          section_type: section.section_type,
          title: section.title,
          content_md: section.content_md,
          supporting_metrics: section.supporting_metrics,
          confidence: section.confidence,
          tokens_used: section.tokens_used,
        }))
      )
    if (error) throw error
  }

  if (result.metrics.length > 0) {
    const { error } = await supabase
      .schema('ai_ops')
      .from('ai_analysis_metrics')
      .upsert(
        result.metrics.map((metric) => ({
          run_id: runId,
          orgnr: result.orgnr,
          metric_name: metric.metric_name,
          metric_value: metric.metric_value,
          metric_unit: metric.metric_unit,
          source: metric.source,
          year: metric.year,
          confidence: metric.confidence,
        }))
      )
    if (error) throw error
  }

  const { error: auditError } = await supabase
    .schema('ai_ops')
    .from('ai_analysis_audit')
    .upsert({
      run_id: runId,
      orgnr: result.orgnr,
      module: 'comprehensive_analysis',
      prompt: result.audit.prompt,
      response: result.audit.response,
      model: MODEL_DEFAULT,
      latency_ms: result.audit.latency_ms,
      prompt_tokens: result.audit.prompt_tokens,
      completion_tokens: result.audit.completion_tokens,
      cost_usd: result.audit.cost_usd,
    })
  if (auditError) throw auditError
}

async function fetchRunDetail(supabase: SupabaseClient, runId: string) {
  const { data: run, error: runError } = await supabase
    .schema('ai_ops')
    .from('ai_analysis_runs')
    .select('*')
    .eq('id', runId)
    .maybeSingle()
  if (runError) throw runError
  if (!run) return null

  const { data: companies, error: companyError } = await supabase
    .schema('ai_ops')
    .from('ai_company_analysis')
    .select('*')
    .eq('run_id', runId)
  if (companyError) throw companyError

  const { data: sections, error: sectionsError } = await supabase
    .schema('ai_ops')
    .from('ai_analysis_sections')
    .select('*')
    .eq('run_id', runId)
  if (sectionsError) throw sectionsError

  const { data: metrics, error: metricsError } = await supabase
    .schema('ai_ops')
    .from('ai_analysis_metrics')
    .select('*')
    .eq('run_id', runId)
  if (metricsError) throw metricsError

  const { data: ragAnalyses, error: ragError } = await supabase
    .schema('ai_ops')
    .from('ai_analysis')
    .select('company_id, orgnr, prompt_summary, analysis')
    .eq('run_id', runId)
  if (ragError) throw ragError

  const ragByOrgnr = new Map<string, any>()
  for (const row of ragAnalyses || []) {
    if (!row?.orgnr) continue
    ragByOrgnr.set(row.orgnr, row)
  }

  const groupedSections = new Map<string, SectionResult[]>()
  for (const section of sections || []) {
    const key = section.orgnr
    if (!groupedSections.has(key)) groupedSections.set(key, [])
    groupedSections.get(key)!.push({
      section_type: section.section_type,
      title: section.title,
      content_md: section.content_md,
      supporting_metrics: section.supporting_metrics || [],
      confidence: section.confidence,
      tokens_used: section.tokens_used,
    })
  }

  const groupedMetrics = new Map<string, MetricResult[]>()
  for (const metric of metrics || []) {
    const key = metric.orgnr
    if (!groupedMetrics.has(key)) groupedMetrics.set(key, [])
    groupedMetrics.get(key)!.push({
      metric_name: metric.metric_name,
      metric_value: metric.metric_value,
      metric_unit: metric.metric_unit,
      source: metric.source,
      year: metric.year,
      confidence: metric.confidence,
    })
  }

  const companyResults = (companies || []).map((company: any) => {
    const ragRow = ragByOrgnr.get(company.orgnr)
    let analysisJson = ragRow?.analysis || {}
    if (typeof analysisJson === 'string') {
      try {
        analysisJson = JSON.parse(analysisJson)
      } catch (error) {
        analysisJson = {}
      }
    }
    const contextSummary = typeof ragRow?.prompt_summary === 'string' ? ragRow.prompt_summary : undefined
    const nextSteps = Array.isArray(company.next_steps)
      ? company.next_steps
      : Array.isArray(analysisJson.next_steps)
      ? analysisJson.next_steps
      : []

    return {
      orgnr: company.orgnr,
      companyId: ragRow?.company_id ?? null,
      companyName: company.company_name,
      summary: company.summary ?? analysisJson.summary ?? null,
      recommendation: company.recommendation ?? analysisJson.recommendation ?? null,
      confidence: company.confidence ?? analysisJson.confidence ?? null,
      riskScore: company.risk_score ?? analysisJson.risk_score ?? null,
      financialGrade: company.financial_grade ?? analysisJson.financial_grade ?? null,
      commercialGrade: company.commercial_grade ?? analysisJson.commercial_grade ?? null,
      operationalGrade: company.operational_grade ?? analysisJson.operational_grade ?? null,
      nextSteps,
      sections: groupedSections.get(company.orgnr) || [],
      metrics: groupedMetrics.get(company.orgnr) || [],
      contextSummary,
    }
  })

  const runPayload: RunResponse = {
    id: run.id,
    status: run.status,
    modelVersion: run.model_version,
    startedAt: run.started_at,
    completedAt: run.completed_at,
    errorMessage: run.error_message,
  }

  return { run: runPayload, analysis: { companies: companyResults } }
}

async function fetchRunHistory(supabase: SupabaseClient, limit: number) {
  const { data, error } = await supabase
    .schema('ai_ops')
    .from('ai_analysis_dashboard_feed')
    .select('*')
    .order('completed_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

function calculateCost(promptTokens: number, completionTokens: number): number {
  const promptCost = (promptTokens / 1000) * PROMPT_COST_PER_1K
  const completionCost = (completionTokens / 1000) * COMPLETION_COST_PER_1K
  const total = promptCost + completionCost
  return Number(total.toFixed(4))
}

function safeNumber(value: any): Nullable<number> {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const defaultSystemPrompt = `You are Nivo's lead corporate development strategist. Your task is to produce
concise yet actionable analysis for potential SME acquisitions in Sweden.
Assess each target's financial health, commercial opportunity, and post-acquisition
value creation levers. Incorporate any engineered insights such as risk flags or
segment information when relevant.

Respond in professional English even if source data is Swedish. If information is
missing, acknowledge the gap explicitly and infer carefully using comparable metrics.`

const screeningSystemPrompt = `You are a rapid M&A screening analyst. For each company, provide:
1. Screening Score (1-100): Based on financial health, growth trajectory, and market position
2. Risk Flag: (Low/Medium/High) - Key concerns if any
3. Brief Summary: 2-3 sentences highlighting key strengths/weaknesses

Focus on: Revenue trends, profitability, debt levels, growth consistency.
Use available financial data (4 years history). Flag missing critical data.

Be concise and direct. Prioritize red flags and high-potential opportunities.`

// Export functions for use in development server
export { handlePost, handleGet }

