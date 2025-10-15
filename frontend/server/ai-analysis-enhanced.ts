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
  orgNr: string
  companyName: string
  name: string
  segmentName?: string | null
  executiveSummary: string
  keyFindings: string[]
  narrative: string
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]
  risks: string[]
  recommendation: string
  acquisitionInterest: string
  financialHealth: number
  growthPotential: string
  marketPosition: string
  confidence: number
  riskScore: number
  targetPrice?: number | null
  nextSteps: string[]
  summary: string | null
  financialGrade: string | null
  commercialGrade: string | null
  operationalGrade: string | null
  sections: SectionResult[]
  metrics: MetricResult[]
  audit: AuditResult
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

interface FinancialYearRecord {
  year: number
  revenue: number | null
  ebitda: number | null
  ebit: number | null
  netIncome: number | null
  totalDebt: number | null
  totalEquity: number | null
  employees: number | null
  revenueGrowth?: number | null
  ebitMargin?: number | null
  debtToEquity?: number | null
}

interface KPIRecord {
  year: number
  revenueGrowth?: number | null
  ebitMargin?: number | null
  netMargin?: number | null
  equityRatio?: number | null
  returnOnEquity?: number | null
}

interface CompanyBenchmarks {
  segment?: string | null
  avgRevenueGrowth?: number | null
  avgEbitMargin?: number | null
  avgNetMargin?: number | null
  avgEquityRatio?: number | null
}

interface CompanyDerivedMetrics {
  revenueCagr?: number | null
  avgEbitdaMargin?: number | null
  avgNetMargin?: number | null
  equityRatioLatest?: number | null
  debtToEquityLatest?: number | null
  revenuePerEmployee?: number | null
}

interface CompanyProfile {
  orgnr: string
  companyName: string
  segmentName?: string | null
  industry?: string | null
  city?: string | null
  employees?: number | null
  sizeCategory?: string | null
  growthCategory?: string | null
  profitabilityCategory?: string | null
  financials: FinancialYearRecord[]
  kpis: KPIRecord[]
  derived: CompanyDerivedMetrics
  benchmarks?: CompanyBenchmarks
}

const MODEL_DEFAULT = process.env.OPENAI_MODEL || 'gpt-4.1-mini'
const MODEL_SCREENING = 'gpt-3.5-turbo'
const PROMPT_COST_PER_1K = 0.15
const COMPLETION_COST_PER_1K = 0.6
const SCREENING_PROMPT_COST_PER_1K = 0.0005
const SCREENING_COMPLETION_COST_PER_1K = 0.0015

const deepAnalysisSchema = {
  name: 'DeepCompanyAnalysis',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      executive_summary: {
        type: 'string',
        description: 'Två meningar som sammanfattar företagets läge och investeringsläge.',
        minLength: 40,
      },
      key_findings: {
        type: 'array',
        minItems: 4,
        maxItems: 6,
        items: {
          type: 'string',
          minLength: 20,
        },
        description: 'Bullet points med de viktigaste observationerna.',
      },
      narrative: {
        type: 'string',
        description: 'En handlingsinriktad text kring 280-320 ord på svenska.',
        minLength: 1200,
      },
      strengths: {
        type: 'array',
        minItems: 3,
        items: { type: 'string', minLength: 15 },
      },
      weaknesses: {
        type: 'array',
        minItems: 2,
        items: { type: 'string', minLength: 15 },
      },
      opportunities: {
        type: 'array',
        minItems: 2,
        items: { type: 'string', minLength: 15 },
      },
      risks: {
        type: 'array',
        minItems: 2,
        items: { type: 'string', minLength: 15 },
      },
      recommendation: {
        type: 'string',
        enum: ['Stark köp', 'Köp', 'Behåll', 'Avvakta', 'Sälj'],
      },
      acquisition_interest: {
        type: 'string',
        enum: ['Hög', 'Medel', 'Låg'],
      },
      financial_health_score: {
        type: 'number',
        minimum: 1,
        maximum: 10,
      },
      growth_outlook: {
        type: 'string',
        enum: ['Hög', 'Medel', 'Låg'],
      },
      market_position: {
        type: 'string',
        enum: ['Marknadsledare', 'Utmanare', 'Följare', 'Nischaktör'],
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 100,
      },
      risk_score: {
        type: 'number',
        minimum: 0,
        maximum: 100,
      },
      next_steps: {
        type: 'array',
        minItems: 3,
        items: { type: 'string', minLength: 10 },
      },
      target_price: {
        type: 'number',
        description: 'Indikerat värde (MSEK) baserat på multipelresonemang.',
      },
      word_count: {
        type: 'integer',
      },
    },
    required: [
      'executive_summary',
      'key_findings',
      'narrative',
      'strengths',
      'weaknesses',
      'opportunities',
      'risks',
      'recommendation',
      'acquisition_interest',
      'financial_health_score',
      'growth_outlook',
      'market_position',
      'confidence',
      'risk_score',
      'next_steps',
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

  const { companies, analysisType = 'deep', instructions, filters, initiatedBy } =
    (req.body as AnalysisRequest) || {}
  if (!Array.isArray(companies) || companies.length === 0) {
    return res.status(400).json({ success: false, error: 'No companies provided' })
  }

  const normalizedAnalysisType =
    analysisType === 'comprehensive' ? 'deep' : analysisType

  if (normalizedAnalysisType !== 'screening' && normalizedAnalysisType !== 'deep') {
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

  const modelVersion = normalizedAnalysisType === 'screening' ? MODEL_SCREENING : MODEL_DEFAULT

  await insertRunRecord(supabase, {
    id: runId,
    status: 'running',
    modelVersion,
    analysisMode: normalizedAnalysisType,
    startedAt,
    initiatedBy: typeof initiatedBy === 'string' ? initiatedBy : null,
    filters,
  })

  const companiesResults: CompanyResult[] = []
  const screeningResults: ScreeningResult[] = []
  const errors: string[] = []

  if (normalizedAnalysisType === 'screening') {
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

      const fallbackName =
        typeof selection?.name === 'string' && selection.name.trim().length > 0
          ? selection.name.trim()
          : `Bolag ${orgnr}`

      try {
        const profile = await generateCompanyProfile(supabase, orgnr)
        const prompt = buildDeepAnalysisPrompt(profile, instructions)
        const { parsed, rawText, usage, latency } = await invokeDeepAnalysisModel(openai, prompt)
        const result = buildCompanyResult(profile, parsed, usage, latency, prompt, rawText)
        companiesResults.push(result)
        await persistCompanyResult(supabase, runId, result)
      } catch (error: any) {
        console.error('AI analysis failed', error)
        errors.push(`${orgnr}: ${error?.message || 'Unknown error'}`)
        const fallback = buildFallbackResult(orgnr, fallbackName, selection)
        companiesResults.push(fallback)
        await persistCompanyResult(supabase, runId, fallback)
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
    analysisMode: normalizedAnalysisType,
    startedAt,
    completedAt,
    errorMessage: errors.length > 0 ? errors.join('; ') : null,
  }

  const response: RunResponsePayload = {
    run: runPayload,
    analysis: normalizedAnalysisType === 'screening'
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
      const profile = await generateCompanyProfile(supabase, orgnr)
      companiesData.push({
        orgnr: profile.orgnr,
        name: profile.companyName,
        industry: profile.segmentName || profile.industry || 'Unknown',
        financials: profile.financials,
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
      `${f.year}: Rev=${f.revenue ?? 'N/A'}, Profit=${f.netIncome ?? 'N/A'}`
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

async function generateCompanyProfile(
  supabase: SupabaseClient,
  orgnr: string,
  baseRow?: any | null
): Promise<CompanyProfile> {
  let base = baseRow

  if (!base) {
    const { data, error } = await supabase
      .from('master_analytics')
      .select(
        `
          OrgNr,
          name,
          segment_name,
          industry_name,
          city,
          employees,
          Revenue_growth,
          EBIT_margin,
          NetProfit_margin,
          company_size_category,
          growth_category,
          profitability_category
        `
      )
      .eq('OrgNr', orgnr)
      .maybeSingle()

    if (error) throw error
    base = data
  }

  if (!base) {
    throw new Error('Company not found in master_analytics')
  }

  const { data: accounts, error: accountsError } = await supabase
    .from('company_accounts_by_id')
    .select('*')
    .eq('organisationNumber', orgnr)
    .order('year', { ascending: false })
    .limit(6)

  if (accountsError) throw accountsError

  const financials = (accounts || [])
    .map((row: any) => {
      const year = Number.parseInt(row?.year, 10)
      if (!Number.isFinite(year)) {
        return null
      }

      const revenue = safeNumber(row?.SDI)
      const ebitda = safeNumber(row?.resultat_e_avskrivningar ?? row?.EBITDA)
      const ebit = safeNumber(row?.EBIT)
      const netIncome = safeNumber(row?.NetIncome ?? row?.DR)
      const totalDebt = safeNumber(row?.summa_langfristiga_skulder ?? row?.FK ?? row?.FSD)
      const totalEquity = safeNumber(row?.EK ?? row?.SEK ?? row?.SFA)
      const employees = safeNumber(row?.Employees ?? row?.ANT)
      const revenueGrowth = safeNumber(row?.RG ?? row?.revenue_growth)
      const ebitMargin =
        safeNumber(row?.EBIT_margin) ??
        (revenue && ebit !== null && revenue > 0 ? Number(ebit / revenue) : null)
      const debtToEquity =
        totalDebt !== null && totalEquity && totalEquity !== 0 ? Number(totalDebt / totalEquity) : null

      return {
        year,
        revenue,
        ebitda,
        ebit,
        netIncome,
        totalDebt,
        totalEquity,
        employees,
        revenueGrowth,
        ebitMargin,
        debtToEquity,
      } as FinancialYearRecord
    })
    .filter((item): item is FinancialYearRecord => Boolean(item))
    .sort((a, b) => b.year - a.year)
    .slice(0, 4)

  const { data: kpiRows, error: kpiError } = await supabase
    .from('company_kpis_by_id')
    .select('year, ebit_margin, net_margin, revenue_growth, equity_ratio, return_on_equity')
    .eq('organisationNumber', orgnr)
    .order('year', { ascending: false })
    .limit(6)

  if (kpiError) throw kpiError

  const kpis = (kpiRows || [])
    .map((row: any) => {
      const year = Number.parseInt(row?.year, 10)
      if (!Number.isFinite(year)) return null
      return {
        year,
        revenueGrowth: safeNumber(row?.revenue_growth),
        ebitMargin: safeNumber(row?.ebit_margin),
        netMargin: safeNumber(row?.net_margin),
        equityRatio: safeNumber(row?.equity_ratio),
        returnOnEquity: safeNumber(row?.return_on_equity),
      } as KPIRecord
    })
    .filter((item): item is KPIRecord => Boolean(item))
    .sort((a, b) => b.year - a.year)
    .slice(0, 4)

  const derived = computeDerivedMetrics(financials, kpis, safeNumber(base?.employees))
  const benchmarks = await fetchSegmentBenchmarks(supabase, base?.segment_name)

  return {
    orgnr,
    companyName: base?.name || 'Okänt företag',
    segmentName: base?.segment_name || null,
    industry: base?.industry_name || null,
    city: base?.city || null,
    employees: safeNumber(base?.employees),
    sizeCategory: base?.company_size_category || null,
    growthCategory: base?.growth_category || null,
    profitabilityCategory: base?.profitability_category || null,
    financials,
    kpis,
    derived,
    benchmarks,
  }
}

function buildDeepAnalysisPrompt(profile: CompanyProfile, instructions?: string) {
  const financialLines = profile.financials.length
    ? profile.financials
        .map(
          (row) =>
            `${row.year} | ${formatNumber(row.revenue)} | ${formatNumber(row.ebitda)} | ${formatNumber(row.netIncome)} | ${formatNumber(row.totalDebt)} | ${formatNumber(row.totalEquity)} | ${formatNumber(row.employees)} | ${formatPercent(row.revenueGrowth)}`
        )
        .join('\n')
    : 'Ingen historik tillgänglig'

  const kpiLines = profile.kpis.length
    ? profile.kpis
        .map(
          (row) =>
            `${row.year}: Tillväxt=${formatPercent(row.revenueGrowth)}, EBIT-marginal=${formatPercent(row.ebitMargin)}, Nettomarginal=${formatPercent(row.netMargin)}, Soliditet=${formatPercent(row.equityRatio)}`
        )
        .join('\n')
    : 'Inga KPI-data tillgängliga.'

  const derived = profile.derived
  const benchmarkText = profile.benchmarks
    ? `Sektorbenchmark (${profile.benchmarks.segment}):
- Medeltillväxt: ${formatPercent(profile.benchmarks.avgRevenueGrowth)}
- Medel EBIT-marginal: ${formatPercent(profile.benchmarks.avgEbitMargin)}
- Medel nettomarginal: ${formatPercent(profile.benchmarks.avgNetMargin)}`
    : 'Sektorbenchmark: Ej tillgänglig.'

  const instructionText = instructions ? `Extra instruktioner från användaren: ${instructions}` : ''

  return `
Företag: ${profile.companyName} (${profile.orgnr})
Bransch/segment: ${profile.segmentName || profile.industry || 'Okänd'}
Ort: ${profile.city || 'Okänd'}
Storleksklass: ${profile.sizeCategory || 'Okänd'} • Tillväxtkategori: ${profile.growthCategory || 'Okänd'} • Lönsamhetsprofil: ${profile.profitabilityCategory || 'Okänd'}

Finansiell historik (TSEK):
År | Omsättning | EBITDA | Nettoresultat | Skulder | Eget kapital | Anställda | Tillväxt
${financialLines}

Beräknade nyckeltal:
- Fyraårs CAGR omsättning: ${formatPercent(derived.revenueCagr)}
- Genomsnittlig EBITDA-marginal: ${formatPercent(derived.avgEbitdaMargin)}
- Genomsnittlig nettomarginal: ${formatPercent(derived.avgNetMargin)}
- Soliditet (senaste): ${formatPercent(derived.equityRatioLatest)}
- Skuldsättningsgrad (senaste): ${formatRatio(derived.debtToEquityLatest)}
- Omsättning per anställd (senaste): ${formatCurrency(derived.revenuePerEmployee)}

KPI-historik:
${kpiLines}

${benchmarkText}

Uppgift:
- Svara på svenska med professionell ton.
- Leverera JSON enligt schemat DeepCompanyAnalysis.
- Gör narrativet cirka 300 ord och redovisa uppskattat word_count.
- Analysera finansiell stabilitet, marginaler, skuldsättning och kapitalstruktur.
- Lyft fram risker och uppsidor för ett potentiellt förvärv inom 12–24 månader.
- Ge en tydlig rekommendation (Köp/Håll/Sälj) och bedöm förvärvsintresset (Hög/Medel/Låg).

Fråga att besvara:
"Baserat på denna finansiella profil, hur presterar företaget och hur stabilt är det? Finns det betydande risker eller uppsidor? Är verksamheten intressant för förvärv?"

${instructionText}
`
}

async function invokeDeepAnalysisModel(openai: OpenAI, prompt: string) {
  const started = Date.now()
  const response = await openai.responses.create({
    model: MODEL_DEFAULT,
    temperature: 0.25,
    max_output_tokens: 1600,
    input: [
      { role: 'system', content: [{ type: 'text', text: deepAnalysisSystemPrompt }] },
      { role: 'user', content: [{ type: 'text', text: prompt }] },
    ],
    response_format: { type: 'json_schema', json_schema: deepAnalysisSchema },
  })
  const latency = Date.now() - started

  let rawText = (response as any).output_text as string | undefined
  if (!rawText) {
    try {
      rawText = (response as any)?.output?.[0]?.content?.[0]?.text
    } catch (error) {
      rawText = '{}'
    }
  }

  let parsed: any = {}
  try {
    parsed = JSON.parse(rawText || '{}')
  } catch {
    parsed = {}
  }

  const usage: UsageSummary = {}
  const rawUsage: any = (response as any).usage
  if (rawUsage) {
    usage.input_tokens = rawUsage.input_tokens || rawUsage.prompt_tokens || 0
    usage.output_tokens = rawUsage.output_tokens || rawUsage.completion_tokens || 0
    usage.total_tokens = rawUsage.total_tokens || 0
  }

  return { parsed, rawText: rawText || '{}', usage, latency }
}

function buildCompanyResult(
  profile: CompanyProfile,
  payload: any,
  usage: UsageSummary,
  latencyMs: number,
  prompt: string,
  rawText: string
): CompanyResult {
  const executiveSummary =
    typeof payload?.executive_summary === 'string' ? payload.executive_summary.trim() : ''
  const keyFindings = ensureStringArray(payload?.key_findings)
  const strengths = ensureStringArray(payload?.strengths)
  const weaknesses = ensureStringArray(payload?.weaknesses)
  const opportunities = ensureStringArray(payload?.opportunities)
  const risks = ensureStringArray(payload?.risks)
  const nextSteps = ensureStringArray(payload?.next_steps)
  const narrative =
    typeof payload?.narrative === 'string' && payload.narrative.trim().length > 0
      ? payload.narrative.trim()
      : keyFindings.join(' ')

  const targetPrice =
    payload?.target_price !== undefined && payload?.target_price !== null
      ? Number(payload.target_price)
      : null

  const financialHealth = clampNumber(
    Number(payload?.financial_health_score ?? NaN),
    1,
    10,
    5
  )
  const growthPotential =
    typeof payload?.growth_outlook === 'string' ? payload.growth_outlook : 'Medel'
  const marketPosition =
    typeof payload?.market_position === 'string' ? payload.market_position : 'Följare'
  const recommendation =
    typeof payload?.recommendation === 'string' ? payload.recommendation : 'Avvakta'
  const acquisitionInterest =
    typeof payload?.acquisition_interest === 'string' ? payload.acquisition_interest : 'Medel'
  const confidence = clampNumber(
    Number(payload?.confidence ?? NaN),
    0,
    100,
    estimateConfidenceFromProfile(profile)
  )
  const riskScore = clampNumber(
    Number(payload?.risk_score ?? NaN),
    0,
    100,
    estimateRiskScore(profile, financialHealth)
  )

  const { financialGrade, commercialGrade, operationalGrade } = deriveGrades(profile)
  const metrics = buildMetricsFromProfile(profile)

  const sections: SectionResult[] = [
    {
      section_type: 'key_findings',
      title: 'Nyckelobservationer',
      content_md: keyFindings.length
        ? keyFindings.map((item) => `- ${item}`).join('\n')
        : '- Inga nyckelobservationer genererade.',
      supporting_metrics: metrics.map((metric) => ({
        metric_name: metric.metric_name,
        metric_value: metric.metric_value,
        metric_unit: metric.metric_unit,
      })),
      confidence,
    },
    {
      section_type: 'executive_overview',
      title: 'Sammanfattad analys',
      content_md:
        narrative ||
        executiveSummary ||
        'Analysen kunde inte generera ett narrativ baserat på underlaget.',
      supporting_metrics: [],
      confidence,
    },
    {
      section_type: 'risk_opportunity',
      title: 'Risker och möjligheter',
      content_md: [
        '**Risker:**',
        risks.length ? risks.map((item) => `- ${item}`).join('\n') : '- Ej identifierat',
        '\n**Möjligheter:**',
        opportunities.length
          ? opportunities.map((item) => `- ${item}`).join('\n')
          : '- Ej identifierat',
      ].join('\n'),
      supporting_metrics: [],
      confidence,
    },
  ]

  if (strengths.length || weaknesses.length) {
    sections.push({
      section_type: 'strengths_weaknesses',
      title: 'Styrkor och svagheter',
      content_md: [
        '**Styrkor:**',
        strengths.length ? strengths.map((item) => `- ${item}`).join('\n') : '- Ej identifierat',
        '\n**Svagheter:**',
        weaknesses.length
          ? weaknesses.map((item) => `- ${item}`).join('\n')
          : '- Ej identifierat',
      ].join('\n'),
      supporting_metrics: [],
      confidence,
    })
  }

  const promptTokens = usage.input_tokens || 0
  const completionTokens = usage.output_tokens || 0
  const cost = calculateCost(promptTokens, completionTokens)

  return {
    orgnr: profile.orgnr,
    orgNr: profile.orgnr,
    companyName: profile.companyName,
    name: profile.companyName,
    segmentName: profile.segmentName,
    executiveSummary: executiveSummary || narrative,
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
    targetPrice,
    nextSteps: nextSteps.length
      ? nextSteps
      : ['Komplettera dataunderlag', 'Verifiera senaste bokslut', 'Kör ny analys efter datakorrigering'],
    summary: narrative || executiveSummary || null,
    financialGrade,
    commercialGrade,
    operationalGrade,
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
  }
}

function computeDerivedMetrics(
  financials: FinancialYearRecord[],
  kpis: KPIRecord[],
  fallbackEmployees?: number | null
): CompanyDerivedMetrics {
  if (!financials.length) {
    return {
      revenueCagr: null,
      avgEbitdaMargin: null,
      avgNetMargin: null,
      equityRatioLatest: kpis[0]?.equityRatio ?? null,
      debtToEquityLatest: null,
      revenuePerEmployee: null,
    }
  }

  const sorted = [...financials].sort((a, b) => b.year - a.year)
  const latest = sorted[0]
  const oldest = sorted[sorted.length - 1]
  const spanYears = Math.max(1, latest.year - oldest.year || sorted.length - 1 || 1)

  const revenueCagr =
    isFiniteNumber(latest.revenue) &&
    isFiniteNumber(oldest.revenue) &&
    latest.revenue! > 0 &&
    oldest.revenue! > 0
      ? Math.pow(Number(latest.revenue) / Number(oldest.revenue), 1 / spanYears) - 1
      : null

  const ebitdaMargins = sorted
    .map((row) =>
      isFiniteNumber(row.ebitda) && isFiniteNumber(row.revenue) && row.revenue! > 0
        ? Number(row.ebitda) / Number(row.revenue)
        : null
    )
    .filter(isFiniteNumber)
  const avgEbitdaMargin = ebitdaMargins.length ? average(ebitdaMargins) : null

  const netMargins = sorted
    .map((row) =>
      isFiniteNumber(row.netIncome) && isFiniteNumber(row.revenue) && row.revenue! > 0
        ? Number(row.netIncome) / Number(row.revenue)
        : null
    )
    .filter(isFiniteNumber)
  const avgNetMargin = netMargins.length ? average(netMargins) : null

  const equityRatioLatest =
    kpis.find((kpi) => isFiniteNumber(kpi.equityRatio))?.equityRatio ??
    (isFiniteNumber(latest.totalEquity)
      ? Number(latest.totalEquity) /
        (Number(latest.totalEquity) + (Number(latest.totalDebt) || 0))
      : null)

  const debtToEquityLatest =
    isFiniteNumber(latest.debtToEquity) && latest.debtToEquity! >= 0
      ? Number(latest.debtToEquity)
      : isFiniteNumber(latest.totalDebt) &&
        isFiniteNumber(latest.totalEquity) &&
        Number(latest.totalEquity) !== 0
      ? Number(latest.totalDebt) / Number(latest.totalEquity)
      : null

  const employees = isFiniteNumber(latest.employees)
    ? Number(latest.employees)
    : isFiniteNumber(fallbackEmployees)
    ? Number(fallbackEmployees)
    : null
  const revenuePerEmployee =
    employees && employees > 0 && isFiniteNumber(latest.revenue)
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

async function fetchSegmentBenchmarks(
  supabase: SupabaseClient,
  segmentName?: string | null
): Promise<CompanyBenchmarks | undefined> {
  if (!segmentName) return undefined
  const { data, error } = await supabase
    .from('master_analytics')
    .select(
      `
        avg_revenue_growth:avg(Revenue_growth),
        avg_ebit_margin:avg(EBIT_margin),
        avg_net_margin:avg(NetProfit_margin)
      `
    )
    .eq('segment_name', segmentName)
    .maybeSingle()

  if (error) throw error
  if (!data) return { segment: segmentName }

  return {
    segment: segmentName,
    avgRevenueGrowth: safeNumber((data as any)?.avg_revenue_growth),
    avgEbitMargin: safeNumber((data as any)?.avg_ebit_margin),
    avgNetMargin: safeNumber((data as any)?.avg_net_margin),
  }
}

function average(values: number[]): number {
  if (!values.length) return 0
  const sum = values.reduce((acc, value) => acc + value, 0)
  return sum / values.length
}

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  if (value < min) return min
  if (value > max) return max
  return value
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
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

function percentValue(value: number | null | undefined): number | null {
  if (!isFiniteNumber(value)) return null
  return Number((Number(value) * 100).toFixed(2))
}

function ensureStringArray(value: any): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item) => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim())
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return value
      .split(/[\n•\-]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  }
  return []
}

function estimateConfidenceFromProfile(profile: CompanyProfile): number {
  let score = 55
  if (profile.financials.length >= 4) score += 15
  if (profile.kpis.length >= 3) score += 10
  if (isFiniteNumber(profile.derived.revenueCagr)) score += 5
  if (isFiniteNumber(profile.derived.avgEbitdaMargin)) score += 5
  return clampNumber(score, 50, 95, 60)
}

function estimateRiskScore(profile: CompanyProfile, financialHealth: number): number {
  const latest = profile.financials[0]
  let risk = 70 - financialHealth * 4

  if (latest) {
    if (isFiniteNumber(latest.revenueGrowth) && Number(latest.revenueGrowth) < 0) {
      risk += 10
    }
    if (isFiniteNumber(latest.ebitMargin) && Number(latest.ebitMargin) < 0) {
      risk += 15
    }
  }

  if (isFiniteNumber(profile.derived.debtToEquityLatest) && profile.derived.debtToEquityLatest! > 2) {
    risk += 10
  }
  if (isFiniteNumber(profile.derived.equityRatioLatest) && profile.derived.equityRatioLatest! < 0.2) {
    risk += 10
  }

  return clampNumber(risk, 0, 100, 70)
}

function deriveGrades(profile: CompanyProfile) {
  const latest = profile.financials[0]
  const latestRevenue = isFiniteNumber(latest?.revenue) ? Number(latest?.revenue) : 0
  const latestEmployees = isFiniteNumber(latest?.employees)
    ? Number(latest?.employees)
    : isFiniteNumber(profile.employees)
    ? Number(profile.employees)
    : null

  const latestEbitMargin =
    isFiniteNumber(latest?.ebitMargin) && latest?.ebitMargin !== null
      ? Number(latest.ebitMargin)
      : profile.kpis.find((kpi) => isFiniteNumber(kpi.ebitMargin))?.ebitMargin ?? null

  const latestNetMargin =
    profile.kpis.find((kpi) => isFiniteNumber(kpi.netMargin))?.netMargin ??
    (isFiniteNumber(latest?.netIncome) && latestRevenue > 0
      ? Number(latest!.netIncome) / latestRevenue
      : null)

  let financialGrade = 'D'
  if (latestEbitMargin !== null && latestNetMargin !== null) {
    if (latestEbitMargin > 0.1 && latestNetMargin > 0.05) financialGrade = 'A'
    else if (latestEbitMargin > 0.05 && latestNetMargin > 0.02) financialGrade = 'B'
    else if (latestEbitMargin > 0 && latestNetMargin > 0) financialGrade = 'C'
  }

  const revenueGrowth =
    profile.kpis.find((kpi) => isFiniteNumber(kpi.revenueGrowth))?.revenueGrowth ??
    profile.derived.revenueCagr ??
    0

  let commercialGrade = 'D'
  if (isFiniteNumber(revenueGrowth)) {
    const growthValue = Number(revenueGrowth)
    if (growthValue > 0.2 && latestRevenue > 50000) commercialGrade = 'A'
    else if (growthValue > 0.1 && latestRevenue > 25000) commercialGrade = 'B'
    else if (growthValue > 0.05) commercialGrade = 'C'
  }

  const revenuePerEmployee = profile.derived.revenuePerEmployee
  let operationalGrade = 'D'
  if (isFiniteNumber(revenuePerEmployee) && latestEmployees !== null) {
    if (revenuePerEmployee! > 5000 && latestEmployees > 5) operationalGrade = 'A'
    else if (revenuePerEmployee! > 3000 && latestEmployees > 3) operationalGrade = 'B'
    else if (revenuePerEmployee! > 2000) operationalGrade = 'C'
  }

  return { financialGrade, commercialGrade, operationalGrade }
}

function buildMetricsFromProfile(profile: CompanyProfile): MetricResult[] {
  const metrics: MetricResult[] = []

  const pushMetric = (
    name: string,
    value: number | null | undefined,
    unit: string,
    options: { year?: number | null; confidence?: number } = {}
  ) => {
    if (!isFiniteNumber(value)) return
    metrics.push({
      metric_name: name,
      metric_value: Number(value),
      metric_unit: unit,
      source: 'system',
      year: options.year ?? null,
      confidence: options.confidence ?? 80,
    })
  }

  const derived = profile.derived
  pushMetric('Revenue CAGR (4 år)', percentValue(derived.revenueCagr), '%')
  pushMetric('Genomsnittlig EBITDA-marginal', percentValue(derived.avgEbitdaMargin), '%')
  pushMetric('Genomsnittlig nettomarginal', percentValue(derived.avgNetMargin), '%')
  pushMetric('Soliditet (senaste)', percentValue(derived.equityRatioLatest), '%')
  pushMetric('Skuldsättningsgrad (senaste)', derived.debtToEquityLatest, 'x')
  pushMetric('Omsättning per anställd', derived.revenuePerEmployee, 'TSEK')

  const latest = profile.financials[0]
  if (latest) {
    pushMetric('Omsättning (senaste)', latest.revenue, 'TSEK', { year: latest.year, confidence: 90 })
    pushMetric('EBITDA (senaste)', latest.ebitda, 'TSEK', { year: latest.year, confidence: 85 })
    pushMetric('Nettoresultat (senaste)', latest.netIncome, 'TSEK', {
      year: latest.year,
      confidence: 85,
    })
  }

  return metrics
}

function buildFallbackResult(orgnr: string, companyName: string, base?: any): CompanyResult {
  const summary = `Det gick inte att skapa en djupanalys för ${companyName} (${orgnr}) på grund av begränsat dataunderlag. Komplettera de senaste fyra boksluten och kör analysen igen.`
  const sections: SectionResult[] = [
    {
      section_type: 'data_gap',
      title: 'Data saknas',
      content_md: summary,
      supporting_metrics: [],
      confidence: 30,
    },
  ]

  return {
    orgnr,
    orgNr: orgnr,
    companyName,
    name: companyName,
    segmentName: base?.segment_name || null,
    executiveSummary: summary,
    keyFindings: [summary],
    narrative: summary,
    strengths: [],
    weaknesses: [],
    opportunities: [],
    risks: [`Otillräckligt finansiellt dataunderlag för ${companyName}.`],
    recommendation: 'Avvakta',
    acquisitionInterest: 'Låg',
    financialHealth: 4,
    growthPotential: 'Låg',
    marketPosition: 'Följare',
    confidence: 40,
    riskScore: 70,
    targetPrice: null,
    nextSteps: [
      'Komplettera finansiell historik i Supabase',
      'Verifiera skuldsättning och marginaler',
      'Kör djupanalysen på nytt efter datakorrigering',
    ],
    summary,
    financialGrade: 'D',
    commercialGrade: 'D',
    operationalGrade: 'D',
    sections,
    metrics: [],
    audit: {
      prompt: '',
      response: summary,
      latency_ms: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      cost_usd: null,
    },
  }
}

async function persistCompanyResult(supabase: SupabaseClient, runId: string, result: CompanyResult) {
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

  const companyResults = (companies || []).map((company: any) => ({
    orgnr: company.orgnr,
    companyName: company.company_name,
    summary: company.summary,
    recommendation: company.recommendation,
    confidence: company.confidence,
    riskScore: company.risk_score,
    financialGrade: company.financial_grade,
    commercialGrade: company.commercial_grade,
    operationalGrade: company.operational_grade,
    nextSteps: company.next_steps || [],
    sections: groupedSections.get(company.orgnr) || [],
    metrics: groupedMetrics.get(company.orgnr) || [],
  }))

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

const deepAnalysisSystemPrompt = `Du är Nivos ledande företagsanalytiker med fokus på M&A i svenska små och medelstora bolag.
Din uppgift är att leverera handlingsbara beslutsunderlag till investeringskommittén. Svara alltid på svenska med professionell ton.

När du analyserar ska du:
- Utvärdera marginalstabilitet, kassaflödesprofil, skuldsättning och kapitalstruktur.
- Bedöma marknadsposition, skalpotential och integrationsmöjligheter efter förvärv.
- Lyfta fram konkreta risker och uppsidor, alltid kopplade till siffror i underlaget.
- Vara tydlig när något baseras på antaganden och ange hur det kan verifieras.

Utdata måste följa det specificerade JSON-schemat utan extra text.`

const screeningSystemPrompt = `You are a rapid M&A screening analyst. For each company, provide:
1. Screening Score (1-100): Based on financial health, growth trajectory, and market position
2. Risk Flag: (Low/Medium/High) - Key concerns if any
3. Brief Summary: 2-3 sentences highlighting key strengths/weaknesses

Focus on: Revenue trends, profitability, debt levels, growth consistency.
Use available financial data (4 years history). Flag missing critical data.

Be concise and direct. Prioritize red flags and high-potential opportunities.`

// Export functions for use in development server
export { handlePost, handleGet }
