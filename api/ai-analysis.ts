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
}

interface RunPayload {
  id: string
  status: string
  modelVersion: string
  startedAt: string
  completedAt?: string | null
  errorMessage?: string | null
}

interface RunResponsePayload {
  run: RunPayload
  analysis: { companies: CompanyResult[] }
}

interface CompanySnapshot {
  orgnr: string
  companyName: string
  segmentName?: string | null
  industry?: string | null
  city?: string | null
  employees?: number | null
  metrics: Record<string, any>
  financials: Array<Record<string, any>>
}

const MODEL_DEFAULT = process.env.OPENAI_MODEL || 'gpt-4.1-mini'
const PROMPT_COST_PER_1K = 0.15
const COMPLETION_COST_PER_1K = 0.6

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

  const { companies, instructions, filters, initiatedBy } = req.body || {}
  if (!Array.isArray(companies) || companies.length === 0) {
    return res.status(400).json({ success: false, error: 'No companies provided' })
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

  await insertRunRecord(supabase, {
    id: runId,
    status: 'running',
    modelVersion: MODEL_DEFAULT,
    startedAt,
    initiatedBy: typeof initiatedBy === 'string' ? initiatedBy : null,
    filters,
  })

  const companiesResults: CompanyResult[] = []
  const errors: string[] = []

  for (const selection of uniqueSelections) {
    const orgnr = String(selection?.OrgNr || selection?.orgnr || '').trim()
    if (!orgnr) {
      errors.push('Missing organisation number for selection')
      continue
    }
    try {
      const snapshot = await fetchCompanySnapshot(supabase, orgnr)
      const prompt = buildPrompt(snapshot, instructions)
      const { parsed, rawText, usage, latency } = await invokeModel(openai, prompt)
      const result = buildCompanyResult(orgnr, snapshot.companyName, parsed, usage, latency, prompt, rawText)
      companiesResults.push(result)
      await persistCompanyResult(supabase, runId, result)
    } catch (error: any) {
      console.error('AI analysis failed', error)
      errors.push(`${orgnr}: ${error?.message || 'Unknown error'}`)
    }
  }

  const completedAt = new Date().toISOString()
  await updateRunRecord(supabase, {
    id: runId,
    status: errors.length > 0 ? 'completed_with_errors' : 'completed',
    completedAt,
    errorMessage: errors.length > 0 ? errors.join('; ') : null,
  })

  const run: RunResponse = {
    id: runId,
    status: errors.length > 0 ? 'completed_with_errors' : 'completed',
    modelVersion: MODEL_DEFAULT,
    startedAt,
    completedAt,
    errorMessage: errors.length > 0 ? errors.join('; ') : null,
  }

  const runPayload: RunPayload = {
    id: run.id,
    status: run.status,
    modelVersion: run.modelVersion,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    errorMessage: run.errorMessage,
  }
  
  res.status(200).json({ success: true, run: runPayload, analysis: { companies: companiesResults } })
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

async function insertRunRecord(
  supabase: SupabaseClient,
  payload: {
    id: string
    status: string
    modelVersion: string
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

async function fetchCompanySnapshot(supabase: SupabaseClient, orgnr: string): Promise<CompanySnapshot> {
  const { data: base, error: baseError } = await supabase
    .from('master_analytics')
    .select(
      'OrgNr, name, segment_name, industry_name, city, employees, SDI, DR, ORS, Revenue_growth, EBIT_margin, NetProfit_margin'
    )
    .eq('OrgNr', orgnr)
    .maybeSingle()

  if (baseError) throw baseError
  if (!base) throw new Error('Company not found in master_analytics')

  const { data: accounts, error: accountsError } = await supabase
    .from('company_accounts_by_id')
    .select('year, SDI, RG, DR, EBITDA, EBIT, NetIncome, Employees')
    .eq('organisationNumber', orgnr)
    .order('year', { ascending: false })
    .limit(5)

  if (accountsError) throw accountsError

  const financials = (accounts || []).map((row: any) => ({
    year: parseInt(row?.year, 10) || null,
    revenue: safeNumber(row?.SDI),
    revenueGrowth: safeNumber(row?.RG),
    operatingProfit: safeNumber(row?.EBIT ?? row?.EBITDA),
    profitAfterTax: safeNumber(row?.NetIncome ?? row?.DR),
    employees: safeNumber(row?.Employees),
  }))

  const metrics: Record<string, any> = {
    revenue: safeNumber(base?.SDI),
    profit: safeNumber(base?.DR),
    operating_cashflow: safeNumber(base?.ORS),
    revenue_growth: safeNumber(base?.Revenue_growth),
    ebit_margin: safeNumber(base?.EBIT_margin),
    net_margin: safeNumber(base?.NetProfit_margin),
  }

  return {
    orgnr,
    companyName: base?.name || 'Unknown company',
    segmentName: base?.segment_name || null,
    industry: base?.industry_name || null,
    city: base?.city || null,
    employees: safeNumber(base?.employees),
    metrics,
    financials,
  }
}

function buildPrompt(snapshot: CompanySnapshot, instructions?: string) {
  const payload = {
    orgnr: snapshot.orgnr,
    company_name: snapshot.companyName,
    segment_name: snapshot.segmentName,
    industry: snapshot.industry,
    city: snapshot.city,
    employees: snapshot.employees,
    metrics: snapshot.metrics,
    financials: snapshot.financials,
  }
  const contextJson = JSON.stringify(payload, null, 2)
  const instructionText = instructions ? String(instructions) : ''
  return `Company profile and engineered metrics (JSON):\n${contextJson}\n\nProduce a comprehensive acquisition due diligence brief. Include quantitative references where possible. ${instructionText}`
}

async function invokeModel(openai: OpenAI, prompt: string) {
  const started = Date.now()
  const response = await openai.responses.create({
    model: MODEL_DEFAULT,
    temperature: 0.2,
    max_output_tokens: 1400,
    input: [
      { role: 'system', content: [{ type: 'text', text: defaultSystemPrompt }] },
      { role: 'user', content: [{ type: 'text', text: prompt }] },
    ],
    response_format: { type: 'json_schema', json_schema: analysisSchema },
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
  } catch (error) {
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
  orgnr: string,
  companyName: string,
  payload: any,
  usage: UsageSummary,
  latencyMs: number,
  prompt: string,
  rawText: string
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

const defaultSystemPrompt = `You are Nivo's lead corporate development strategist. Your task is to produce
concise yet actionable analysis for potential SME acquisitions in Sweden.
Assess each target's financial health, commercial opportunity, and post-acquisition
value creation levers. Incorporate any engineered insights such as risk flags or
segment information when relevant.

Respond in professional English even if source data is Swedish. If information is
missing, acknowledge the gap explicitly and infer carefully using comparable metrics.`

