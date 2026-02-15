import type { VercelRequest, VercelResponse } from '@vercel/node'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const FALLBACK_MODEL = 'gpt-4o-mini'

function resolveModel(preferredModel?: string) {
  const candidate = preferredModel?.trim()

  if (!candidate) {
    return FALLBACK_MODEL
  }

  if (candidate === 'gpt-4o') {
    console.warn(
      `Requested OpenAI model "${candidate}" is not supported by the chat completions API. Falling back to ${FALLBACK_MODEL}.`
    )
    return FALLBACK_MODEL
  }

  return candidate
}

interface CompanyData {
  name: string
  OrgNr: string
  SDI?: number
  Revenue_growth?: number
  EBIT_margin?: number
  NetProfit_margin?: number
  segment_name?: string
  employees?: string
  digital_presence?: number
  address?: string
  city?: string
  homepage?: string
  incorporation_date?: string
}

type AnalysisType = 'financial' | 'comprehensive' | 'investment' | 'market' | 'risk'

interface AIAnalysisRequest {
  companies: CompanyData[]
  analysisType?: AnalysisType
  query?: string
  focusAreas?: string[]
  timeHorizon?: 'short' | 'medium' | 'long'
}

interface DatasetSummary {
  averageRevenue?: number
  averageGrowth?: number
  medianEBITMargin?: number
  medianNetMargin?: number
  averageDigitalPresence?: number
  totalEmployees?: number
  topIndustries: { name: string; count: number }[]
}

interface AIAnalysisResponse {
  success: boolean
  analysis?: any
  error?: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  datasetSummary?: DatasetSummary
  rawText?: string | null
}

function buildAnalysisInstruction(analysisType: AnalysisType, focusAreas: string[] = []): string {
  const baseFocus = focusAreas.length
    ? `Fokusera extra på följande områden: ${focusAreas.join(', ')}.`
    : ''

  switch (analysisType) {
    case 'financial':
      return `Leverera en djupgående finansiell analys med fokus på kassaflöde, marginaler, kapitalstruktur och lönsamhetstrender. ${baseFocus}`.trim()
    case 'investment':
      return `Bedöm investeringscase, värderingsmultiplar, exit-scenarier och förväntad avkastning. Ge tydliga rekommendationer kopplat till riskjusterad avkastning. ${baseFocus}`.trim()
    case 'market':
      return `Analysera marknadsposition, kundsegment, konkurrenslandskap och tillväxtdrivare på den svenska marknaden. Identifiera makrotrender att bevaka. ${baseFocus}`.trim()
    case 'risk':
      return `Identifiera och kvantifiera risker inklusive finansiell motståndskraft, operativa risker, beroenden och regulatoriska aspekter. Föreslå riskmitigeringar. ${baseFocus}`.trim()
    default:
      return `Skapa en heltäckande analys som kombinerar finansiella, marknads- och strategiska perspektiv. ${baseFocus}`.trim()
  }
}

function summarizeCompanies(companies: CompanyData[]): DatasetSummary {
  if (!companies.length) {
    return { topIndustries: [] }
  }

  const numeric = <T extends keyof CompanyData>(key: T): number[] =>
    companies
      .map((company) => company[key])
      .filter((value): value is number => typeof value === 'number' && !Number.isNaN(value))

  const employees = companies
    .map((company) =>
      typeof company.employees === 'string' ? parseInt(company.employees, 10) : company.employees
    )
    .filter((value): value is number => typeof value === 'number' && !Number.isNaN(value))

  const average = (values: number[]) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined

  const median = (values: number[]) => {
    if (!values.length) return undefined
    const sorted = [...values].sort((a, b) => a - b)
    const middle = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle]
  }

  const industriesCount = companies.reduce<Record<string, number>>((acc, company) => {
    const segment = company.segment_name?.trim() || 'Okänd'
    acc[segment] = (acc[segment] || 0) + 1
    return acc
  }, {})

  return {
    averageRevenue: average(numeric('SDI')),
    averageGrowth: average(numeric('Revenue_growth')),
    medianEBITMargin: median(numeric('EBIT_margin')),
    medianNetMargin: median(numeric('NetProfit_margin')),
    averageDigitalPresence: average(numeric('digital_presence')),
    totalEmployees: employees.length ? employees.reduce((sum, value) => sum + value, 0) : undefined,
    topIndustries: Object.entries(industriesCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count })),
  }
}

function safeJsonParse(text?: string | null) {
  if (!text) return undefined

  try {
    return JSON.parse(text)
  } catch (error) {
    // Attempt to extract JSON block from markdown or text
    const jsonMatch = text.match(/```(?:json)?\n([\s\S]*?)```/i)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1])
      } catch (innerError) {
        console.warn('Failed to parse JSON from code block', innerError)
      }
    }

    // Try to find first JSON object in the string
    const startIndex = text.indexOf('{')
    const endIndex = text.lastIndexOf('}')
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      const possibleJson = text.slice(startIndex, endIndex + 1)
      try {
        return JSON.parse(possibleJson)
      } catch (innerError) {
        console.warn('Failed to parse JSON from substring', innerError)
      }
    }

    console.warn('Unable to parse OpenAI response as JSON')
    return undefined
  }
}

function buildTimeHorizonInstruction(timeHorizon?: 'short' | 'medium' | 'long') {
  switch (timeHorizon) {
    case 'short':
      return 'Fokusera på 6-12 månaders perspektiv och snabba åtgärder.'
    case 'medium':
      return 'Analysera möjligheter och risker på 12-24 månaders sikt.'
    case 'long':
      return 'Inkludera ett långsiktigt perspektiv (24+ månader) och strukturella förändringar.'
    default:
      return ''
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const {
      companies,
      analysisType = 'comprehensive',
      query,
      focusAreas = [],
      timeHorizon,
    }: AIAnalysisRequest = req.body

    if (!companies || companies.length === 0) {
      return res.status(400).json({ success: false, error: 'No companies provided' })
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ success: false, error: 'OpenAI API key not configured' })
    }

    const model = resolveModel(process.env.OPENAI_MODEL)

    const datasetSummary = summarizeCompanies(companies)
    const analysisInstruction = buildAnalysisInstruction(analysisType, focusAreas)
    const timeHorizonInstruction = buildTimeHorizonInstruction(timeHorizon)

    const systemPrompt = `Du är en prisbelönt finansiell analytiker specialiserad på svenska tillväxtföretag.
Du arbetar för ett investmentbolag och levererar datadrivna beslutsunderlag.

Mål:
- Tolka kvantitativa nyckeltal och kvalitativa signaler
- Identifiera konkreta åtgärder och investeringscases
- Kommunicera insikter på professionell svenska utan överdrifter`

    const companyDataString = companies
      .map((company) => `
Företag: ${company.name}
Organisationsnummer: ${company.OrgNr}
Bransch: ${company.segment_name || 'Okänd'}
Omsättning (TSEK): ${typeof company.SDI === 'number' ? company.SDI.toLocaleString('sv-SE') : 'Ej tillgänglig'}
Tillväxt: ${typeof company.Revenue_growth === 'number' ? `${(company.Revenue_growth * 100).toFixed(1)}%` : 'Ej tillgänglig'}
EBIT-marginal: ${typeof company.EBIT_margin === 'number' ? `${(company.EBIT_margin * 100).toFixed(1)}%` : 'Ej tillgänglig'}
Nettoresultat-marginal: ${typeof company.NetProfit_margin === 'number' ? `${(company.NetProfit_margin * 100).toFixed(1)}%` : 'Ej tillgänglig'}
Digital närvaro: ${typeof company.digital_presence === 'number' ? `${(company.digital_presence * 100).toFixed(0)}%` : 'Ej tillgänglig'}
Anställda: ${company.employees || 'Ej tillgängligt'}
Stad: ${company.city || 'Ej tillgänglig'}
Webbplats: ${company.homepage || 'Ej tillgänglig'}
Grundat: ${company.incorporation_date || 'Ej tillgänglig'}
  `)
      .join('\n---\n')

    const datasetSummaryLines = [
      `- Antal företag: ${companies.length}`,
      `- Genomsnittlig omsättning (TSEK): ${datasetSummary.averageRevenue ? datasetSummary.averageRevenue.toFixed(0) : 'Ej tillgänglig'}`,
      `- Genomsnittlig tillväxt: ${datasetSummary.averageGrowth ? `${(datasetSummary.averageGrowth * 100).toFixed(1)}%` : 'Ej tillgänglig'}`,
      `- Median EBIT-marginal: ${datasetSummary.medianEBITMargin ? `${(datasetSummary.medianEBITMargin * 100).toFixed(1)}%` : 'Ej tillgänglig'}`,
      `- Median nettomarginal: ${datasetSummary.medianNetMargin ? `${(datasetSummary.medianNetMargin * 100).toFixed(1)}%` : 'Ej tillgänglig'}`,
      `- Total antal anställda: ${datasetSummary.totalEmployees ?? 'Ej tillgängligt'}`,
      `- Top 3 branscher: ${datasetSummary.topIndustries
        .slice(0, 3)
        .map((industry) => `${industry.name} (${industry.count})`)
        .join(', ') || 'Ej tillgängligt'}`,
    ]

    const datasetSummaryPrompt = `Dataset-sammanfattning:\n${datasetSummaryLines.join('\n')}${
      timeHorizonInstruction ? `\n${timeHorizonInstruction}` : ''
    }`

    const userPrompt = `Utforma en ${analysisType}-analys för investmentteamet.
${analysisInstruction}

Aktuell frågeställning: ${query || 'Ingen specifik frågeställning angavs.'}

${datasetSummaryPrompt}

Bolagsdata:
${companyDataString}

Svara ENDAST i strikt JSON-format enligt följande struktur:
{
  "meta": {
    "analysisType": "string",
    "generatedAt": "ISO-date",
    "companyCount": number,
    "focusAreas": string[],
    "timeHorizon": "short|medium|long|unspecified",
    "summaryInsights": string[],
    "datasetSummary": {
      "averageRevenue": number | null,
      "averageGrowth": number | null,
      "medianEBITMargin": number | null,
      "medianNetMargin": number | null,
      "averageDigitalPresence": number | null,
      "totalEmployees": number | null,
      "topIndustries": { "name": "string", "count": number }[]
    }
  },
  "portfolioInsights": {
    "themes": string[],
    "signals": string[],
    "benchmarks": string[]
  },
  "companies": [
    {
      "orgNr": "string",
      "name": "string",
      "executiveSummary": "string",
      "financialHealth": number,
      "growthPotential": "Hög|Medel|Låg",
      "marketPosition": "Ledare|Utmanare|Följare|Nisch",
      "strengths": string[],
      "weaknesses": string[],
      "opportunities": string[],
      "risks": string[],
      "recommendation": "Prioritera förvärv|Fördjupa DD|Övervaka|Avstå",
      "confidence": number
    }
  ],
  "actionPlan": {
    "quickWins": string[],
    "strategicMoves": string[],
    "riskMitigations": string[],
    "nextSteps": string[]
  }
}`

    // Add a safety timeout for the OpenAI request (45s)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 45000)

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 1500
    }, { signal: controller.signal })

    clearTimeout(timeout)

    const responseText = response.choices?.[0]?.message?.content

    const parsedAnalysis = safeJsonParse(responseText)

    const fallbackMeta = {
      analysisType,
      generatedAt: new Date().toISOString(),
      companyCount: companies.length,
      focusAreas,
      timeHorizon: timeHorizon || 'unspecified',
      summaryInsights: [
        'Kunde inte tolka JSON-svar. Visar råtext i stället.',
      ],
      datasetSummary,
    }

    const fallbackAnalysis = {
      meta: fallbackMeta,
      portfolioInsights: {
        themes: [],
        signals: [],
        benchmarks: [],
      },
      companies: [],
      actionPlan: {
        quickWins: [],
        strategicMoves: [],
        riskMitigations: [],
        nextSteps: [],
      },
      rawResponse: responseText,
    }

    const analysis: any =
      parsedAnalysis && typeof parsedAnalysis === 'object' ? parsedAnalysis : fallbackAnalysis

    if (!analysis.meta || typeof analysis.meta !== 'object') {
      analysis.meta = { ...fallbackMeta, summaryInsights: [] }
    }

    analysis.meta.analysisType = analysis.meta.analysisType || analysisType
    analysis.meta.generatedAt = analysis.meta.generatedAt || new Date().toISOString()
    analysis.meta.companyCount =
      typeof analysis.meta.companyCount === 'number' ? analysis.meta.companyCount : companies.length
    analysis.meta.focusAreas = Array.isArray(analysis.meta.focusAreas) ? analysis.meta.focusAreas : focusAreas
    analysis.meta.timeHorizon = analysis.meta.timeHorizon || timeHorizon || 'unspecified'
    analysis.meta.datasetSummary = analysis.meta.datasetSummary || datasetSummary
    if (!Array.isArray(analysis.meta.summaryInsights)) {
      analysis.meta.summaryInsights = []
    }

    if (!Array.isArray(analysis.companies)) {
      analysis.companies = []
    }

    if (!analysis.portfolioInsights || typeof analysis.portfolioInsights !== 'object') {
      analysis.portfolioInsights = { themes: [], signals: [], benchmarks: [] }
    } else {
      analysis.portfolioInsights.themes = Array.isArray(analysis.portfolioInsights.themes)
        ? analysis.portfolioInsights.themes
        : []
      analysis.portfolioInsights.signals = Array.isArray(analysis.portfolioInsights.signals)
        ? analysis.portfolioInsights.signals
        : []
      analysis.portfolioInsights.benchmarks = Array.isArray(analysis.portfolioInsights.benchmarks)
        ? analysis.portfolioInsights.benchmarks
        : []
    }

    if (!analysis.actionPlan || typeof analysis.actionPlan !== 'object') {
      analysis.actionPlan = {
        quickWins: [],
        strategicMoves: [],
        riskMitigations: [],
        nextSteps: [],
      }
    } else {
      analysis.actionPlan.quickWins = Array.isArray(analysis.actionPlan.quickWins)
        ? analysis.actionPlan.quickWins
        : []
      analysis.actionPlan.strategicMoves = Array.isArray(analysis.actionPlan.strategicMoves)
        ? analysis.actionPlan.strategicMoves
        : []
      analysis.actionPlan.riskMitigations = Array.isArray(analysis.actionPlan.riskMitigations)
        ? analysis.actionPlan.riskMitigations
        : []
      analysis.actionPlan.nextSteps = Array.isArray(analysis.actionPlan.nextSteps)
        ? analysis.actionPlan.nextSteps
        : []
    }

    if (responseText && !analysis.rawResponse) {
      analysis.rawResponse = responseText
    }

    res.status(200).json({
      success: true,
      analysis,
      rawText: responseText,
      datasetSummary,
      usage: response.usage
        ? {
            prompt_tokens: response.usage.prompt_tokens,
            completion_tokens: response.usage.completion_tokens,
            total_tokens: response.usage.total_tokens,
          }
        : undefined,
    })

  } catch (error) {
    console.error('OpenAI API Error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    })
  }
}
