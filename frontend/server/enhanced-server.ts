import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import OpenAI from 'openai'

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

// Codex AI Analysis Constants and Schemas
const MODEL_DEFAULT = process.env.OPENAI_MODEL || 'gpt-4o-mini'
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

// Utility functions from Codex
function safeNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function formatNumber(value: number | null): string {
  if (value === null || value === undefined) return 'N/A'
  return new Intl.NumberFormat('sv-SE').format(value)
}

function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return 'N/A'
  return `${(value * 100).toFixed(1)}%`
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return 'N/A'
  return `${formatNumber(value)} TSEK`
}

function formatRatio(value: number | null): string {
  if (value === null || value === undefined) return 'N/A'
  return value.toFixed(2)
}

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, value))
}

function ensureStringArray(value: any): string[] {
  if (Array.isArray(value)) {
    return value.filter(item => typeof item === 'string' && item.trim().length > 0)
  }
  return []
}

function calculateCost(promptTokens: number, completionTokens: number): number {
  const promptCost = (promptTokens / 1000) * PROMPT_COST_PER_1K
  const completionCost = (completionTokens / 1000) * COMPLETION_COST_PER_1K
  return promptCost + completionCost
}

function computeDerivedMetrics(financials: any[], kpis: any[], employees: number | null) {
  if (financials.length === 0) {
    return {
      revenueCagr: null,
      avgEbitdaMargin: null,
      avgNetMargin: null,
      equityRatioLatest: null,
      debtToEquityLatest: null,
      revenuePerEmployee: null,
    }
  }

  const latest = financials[0]
  const oldest = financials[financials.length - 1]
  
  // Calculate CAGR
  let revenueCagr = null
  if (latest.revenue && oldest.revenue && latest.revenue > 0 && oldest.revenue > 0) {
    const years = latest.year - oldest.year
    if (years > 0) {
      revenueCagr = Math.pow(latest.revenue / oldest.revenue, 1 / years) - 1
    }
  }

  // Calculate average margins
  const validMargins = financials.filter(f => f.ebitMargin !== null && f.ebitMargin !== undefined)
  const avgEbitdaMargin = validMargins.length > 0 
    ? validMargins.reduce((sum, f) => sum + f.ebitMargin, 0) / validMargins.length 
    : null

  const validNetMargins = financials.filter(f => f.netIncome && f.revenue)
  const avgNetMargin = validNetMargins.length > 0
    ? validNetMargins.reduce((sum, f) => sum + (f.netIncome / f.revenue), 0) / validNetMargins.length
    : null

  // Latest ratios
  const equityRatioLatest = latest.totalEquity && latest.totalDebt 
    ? latest.totalEquity / (latest.totalEquity + latest.totalDebt)
    : null

  const debtToEquityLatest = latest.totalDebt && latest.totalEquity
    ? latest.totalDebt / latest.totalEquity
    : null

  const revenuePerEmployee = latest.revenue && employees
    ? latest.revenue / employees
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

function estimateConfidenceFromProfile(profile: any): number {
  let confidence = 50
  if (profile.financials.length >= 3) confidence += 20
  if (profile.financials.length >= 4) confidence += 10
  if (profile.derived.revenueCagr !== null) confidence += 10
  if (profile.derived.avgEbitdaMargin !== null) confidence += 10
  return Math.min(95, confidence)
}

function estimateRiskScore(profile: any, financialHealth: number): number {
  let riskScore = 50
  riskScore -= (financialHealth - 5) * 5 // Better health = lower risk
  if (profile.derived.debtToEquityLatest && profile.derived.debtToEquityLatest > 1) riskScore += 20
  if (profile.derived.revenueCagr && profile.derived.revenueCagr < 0) riskScore += 15
  return Math.max(0, Math.min(100, riskScore))
}

function deriveGrades(profile: any) {
  const derived = profile.derived
  
  const financialGrade = derived.avgEbitdaMargin && derived.avgEbitdaMargin > 0.08 ? 'A' :
                        derived.avgEbitdaMargin && derived.avgEbitdaMargin > 0.05 ? 'B' :
                        derived.avgEbitdaMargin && derived.avgEbitdaMargin > 0.02 ? 'C' : 'D'
  
  const commercialGrade = derived.revenueCagr && derived.revenueCagr > 0.1 ? 'A' :
                         derived.revenueCagr && derived.revenueCagr > 0.05 ? 'B' :
                         derived.revenueCagr && derived.revenueCagr > 0 ? 'C' : 'D'
  
  const operationalGrade = profile.employees && profile.employees > 20 ? 'A' :
                          profile.employees && profile.employees > 10 ? 'B' :
                          profile.employees && profile.employees > 5 ? 'C' : 'D'
  
  return { financialGrade, commercialGrade, operationalGrade }
}

function buildMetricsFromProfile(profile: any) {
  const derived = profile.derived
  const latest = profile.financials[0]
  
  return [
    {
      metric_name: 'Omsättningstillväxt (CAGR)',
      metric_value: derived.revenueCagr || 0,
      metric_unit: '%',
      source: 'Beräknad',
      year: latest?.year,
      confidence: 85
    },
    {
      metric_name: 'Genomsnittlig EBITDA-marginal',
      metric_value: derived.avgEbitdaMargin || 0,
      metric_unit: '%',
      source: 'Beräknad',
      year: latest?.year,
      confidence: 80
    },
    {
      metric_name: 'Soliditet',
      metric_value: derived.equityRatioLatest || 0,
      metric_unit: '%',
      source: 'Beräknad',
      year: latest?.year,
      confidence: 90
    },
    {
      metric_name: 'Omsättning per anställd',
      metric_value: derived.revenuePerEmployee || 0,
      metric_unit: 'TSEK',
      source: 'Beräknad',
      year: latest?.year,
      confidence: 75
    }
  ]
}

const app = express()
const port = process.env.PORT ? Number(process.env.PORT) : 3001

app.use(cors())
app.use(express.json({ limit: '2mb' }))

// Codex AI Analysis Functions

function buildDeepAnalysisPrompt(profile: any, instructions?: string) {
  const financialLines = profile.financials.length
    ? profile.financials
        .map(
          (row: any) =>
            `${row.year} | ${formatNumber(row.revenue)} | ${formatNumber(row.ebitda)} | ${formatNumber(row.netIncome)} | ${formatNumber(row.totalDebt)} | ${formatNumber(row.totalEquity)} | ${formatNumber(row.employees)} | ${formatPercent(row.revenueGrowth)}`
        )
        .join('\n')
    : 'Ingen historik tillgänglig'

  const kpiLines = profile.kpis && profile.kpis.length
    ? profile.kpis
        .map(
          (row: any) =>
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
  const response = await openai.chat.completions.create({
    model: MODEL_DEFAULT,
    temperature: 0.25,
    max_tokens: 1600,
    messages: [
      { role: 'system', content: deepAnalysisSystemPrompt },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_schema', json_schema: deepAnalysisSchema },
  })
  const latency = Date.now() - started

  let rawText = response.choices[0]?.message?.content || '{}'
  let parsed: any = {}
  try {
    parsed = JSON.parse(rawText)
  } catch {
    parsed = {}
  }

  const usage = response.usage || {}
  return { parsed, rawText, usage, latency }
}

function buildCompanyResult(
  profile: any,
  payload: any,
  usage: any,
  latencyMs: number,
  prompt: string,
  rawText: string
): any {
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

  const sections = [
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

  const promptTokens = usage.prompt_tokens || 0
  const completionTokens = usage.completion_tokens || 0
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
          // Generate deep analysis result using full Codex AI logic
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
          const prompt = buildDeepAnalysisPrompt(profile, instructions)
          const { parsed, rawText, usage, latency } = await invokeDeepAnalysisModel(openai, prompt)
          const deepResult = buildCompanyResult(profile, parsed, usage, latency, prompt, rawText)
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

// Database persistence functions

// Enhanced database persistence with all Codex fields
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
    next_steps: result.nextSteps,
    
    // NEW: Codex enhanced fields
    executive_summary: result.executiveSummary,
    key_findings: result.keyFindings,
    narrative: result.narrative,
    strengths: result.strengths,
    weaknesses: result.weaknesses,
    opportunities: result.opportunities,
    risks: result.risks,
    acquisition_interest: result.acquisitionInterest,
    financial_health_score: result.financialHealth,
    growth_outlook: result.growthPotential,
    market_position: result.marketPosition,
    target_price_msek: result.targetPrice
  }

  const { data: insertedData, error: companyError } = await supabase
    .from('ai_company_analysis')
    .insert(companyRow)
    .select('id')
    .single()

  if (companyError) {
    console.error('Error inserting company analysis:', companyError)
    throw companyError
  }

  // Save audit information if available
  if (result.audit && insertedData?.id) {
    const auditRow = {
      analysis_id: insertedData.id,
      prompt_text: result.audit.prompt,
      response_text: result.audit.response,
      prompt_tokens: result.audit.prompt_tokens,
      completion_tokens: result.audit.completion_tokens,
      total_tokens: result.audit.prompt_tokens + result.audit.completion_tokens,
      cost_usd: result.audit.cost_usd,
      latency_ms: result.audit.latency_ms
    }

    const { error: auditError } = await supabase
      .from('ai_analysis_audit')
      .insert(auditRow)

    if (auditError) {
      console.error('Error inserting audit record:', auditError)
      // Don't throw here, as the main analysis was saved successfully
    }
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

// AI Analysis history endpoint
app.get('/api/ai-analysis', async (req, res) => {
  try {
    const { history, limit = 10 } = req.query
    
    if (history) {
      // Return analysis history
      const { data, error } = await supabase
        .from('ai_analysis_runs')
        .select(`
          id,
          model_version,
          started_at,
          completed_at,
          status,
          analysis_mode,
          initiated_by
        `)
        .order('started_at', { ascending: false })
        .limit(Number(limit))
      
      if (error) {
        console.error('Error fetching analysis history:', error)
        return res.status(500).json({ success: false, error: error.message })
      }
      
      return res.json({ success: true, data: data || [] })
    }
    
    // If not history request, return 404
    res.status(404).json({ success: false, error: 'Endpoint not found' })
  } catch (error: any) {
    console.error('AI analysis history error:', error)
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
        target_price_msek,
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
      modelVersion: item.ai_analysis_runs?.model_version,
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

// Migration endpoint to add enhanced columns
app.post('/api/migrate-enhanced-fields', async (req, res) => {
  try {
    console.log('🔧 Applying enhanced fields migration...')
    
    // Test if columns already exist by trying to select them
    const { data: testData, error: testError } = await supabase
      .from('ai_company_analysis')
      .select('executive_summary, key_findings, narrative')
      .limit(1)
    
    if (!testError) {
      console.log('✅ Enhanced columns already exist')
      return res.json({ 
        success: true, 
        message: 'Enhanced columns already exist',
        timestamp: new Date().toISOString()
      })
    }
    
    // If columns don't exist, we need to apply the migration manually
    // For now, let's just return a message that manual migration is needed
    console.log('⚠️ Enhanced columns need to be added manually to the database')
    res.json({ 
      success: false, 
      message: 'Enhanced columns need to be added manually to the database. Please run the migration script in Supabase SQL editor.',
      migration_sql: `
        ALTER TABLE public.ai_company_analysis 
        ADD COLUMN IF NOT EXISTS executive_summary TEXT,
        ADD COLUMN IF NOT EXISTS key_findings JSONB,
        ADD COLUMN IF NOT EXISTS narrative TEXT,
        ADD COLUMN IF NOT EXISTS strengths JSONB,
        ADD COLUMN IF NOT EXISTS weaknesses JSONB,
        ADD COLUMN IF NOT EXISTS opportunities JSONB,
        ADD COLUMN IF NOT EXISTS risks JSONB,
        ADD COLUMN IF NOT EXISTS acquisition_interest TEXT,
        ADD COLUMN IF NOT EXISTS financial_health_score NUMERIC,
        ADD COLUMN IF NOT EXISTS growth_outlook TEXT,
        ADD COLUMN IF NOT EXISTS market_position TEXT,
        ADD COLUMN IF NOT EXISTS target_price_msek NUMERIC;
      `,
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('Migration error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Start server
app.listen(port, () => {
  console.log(`🚀 Enhanced AI Analysis Server running on http://localhost:${port}`)
  console.log('✨ Features: Enhanced Codex AI analysis with Swedish localization')
})
