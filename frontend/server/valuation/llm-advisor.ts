/**
 * LLM Advisor for Valuation Assumptions
 * Provides AI-powered suggestions for valuation multiples and parameters
 */

import OpenAI from 'openai'
import { ValuationAssumptions } from './engine.js'
import { IndustryBenchmarks } from '../industry-benchmarks.js'

export interface LLMSuggestion {
  modelKey: string
  suggestedMultiples: {
    revenueMultiple?: number
    ebitdaMultiple?: number
    earningsMultiple?: number
    discountRate?: number
    terminalMultiple?: number
  }
  reasoning: string
  confidence: number
  source: 'llm_suggestion'
}

export interface CompanyContext {
  name: string
  industry: string
  sizeBucket: string
  growthBucket: string
  revenue: number
  netProfit: number
  ebitda?: number
  revenueGrowth: number
  ebitMargin: number
  netProfitMargin: number
  employees: number
  benchmarks: IndustryBenchmarks
}

/**
 * Get LLM suggestions for valuation assumptions
 */
export async function getLLMSuggestions(
  openai: OpenAI,
  context: CompanyContext
): Promise<LLMSuggestion[]> {
  try {
    const prompt = createSuggestionPrompt(context)
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Du är en expert på företagsvärdering för svenska små och medelstora företag. 
          Din uppgift är att föreslå lämpliga värderingsmultipler baserat på företagets finansiella profil och branschjämförelser.
          
          Svara ENDAST med giltig JSON utan markdown-formatering.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response content from LLM')
    }

    const parsed = JSON.parse(content)
    return parseLLMSuggestions(parsed, context)
  } catch (error) {
    console.error('Error getting LLM suggestions:', error)
    return []
  }
}

/**
 * Create prompt for LLM suggestions
 */
function createSuggestionPrompt(context: CompanyContext): string {
  const { name, industry, sizeBucket, growthBucket, revenue, netProfit, ebitda, revenueGrowth, ebitMargin, netProfitMargin, employees, benchmarks } = context

  return `Analysera detta svenska företag och föreslå lämpliga värderingsmultipler:

FÖRETAG: ${name}
Bransch: ${industry}
Storlek: ${sizeBucket} (${(revenue/1000000).toFixed(1)}M SEK omsättning)
Tillväxt: ${growthBucket} (${(revenueGrowth*100).toFixed(1)}% tillväxt)
Anställda: ${employees}

FINANSIELLA NYCKLETAL:
- Omsättning: ${(revenue/1000000).toFixed(1)}M SEK
- Nettoresultat: ${(netProfit/1000000).toFixed(1)}M SEK
- EBITDA: ${ebitda ? (ebitda/1000000).toFixed(1) : 'Okänt'}M SEK
- EBIT-marginal: ${(ebitMargin*100).toFixed(1)}%
- Nettovinstmarginal: ${(netProfitMargin*100).toFixed(1)}%
- Tillväxt: ${(revenueGrowth*100).toFixed(1)}%

BRANSCHJÄMFÖRELSE:
- Genomsnittlig EBIT-marginal: ${benchmarks.avgEbitMargin.toFixed(1)}%
- Genomsnittlig tillväxt: ${benchmarks.avgGrowthRate.toFixed(1)}%
- Genomsnittlig skuldsättningsgrad: ${benchmarks.avgDebtToEquity.toFixed(2)}
- Genomsnittlig produktivitet: ${benchmarks.avgEmployeeProductivity.toFixed(0)} TSEK per anställd
- Antal företag i bransch: ${benchmarks.count}

FÖRESLÅ VÄRDERINGSMULTIPLER för:
1. Revenue Multiple (omsättningsmultipel)
2. EBITDA Multiple (EBITDA-multipel) 
3. Earnings Multiple (vinstmultipel/PER)
4. DCF parametrar (diskontränta, terminal multiple)

Basera förslagen på:
- Företagets lönsamhet och tillväxt
- Branschjämförelser
- Storlek och mognadsgrad
- Marknadsläge för svenska SME

Svara med JSON i detta format:
{
  "suggestions": [
    {
      "modelKey": "revenue_multiple",
      "suggestedMultiples": {
        "revenueMultiple": 1.8
      },
      "reasoning": "Företaget har stark tillväxt och god lönsamhet, men är relativt litet. Omsättningsmultipel på 1.8x är lämplig för denna bransch och storlek.",
      "confidence": 85
    },
    {
      "modelKey": "ebitda_multiple",
      "suggestedMultiples": {
        "ebitdaMultiple": 8.5
      },
      "reasoning": "EBIT-marginalen är ${(ebitMargin*100).toFixed(1)}%, vilket är ${ebitMargin > benchmarks.avgEbitMargin/100 ? 'bättre än' : 'sämre än'} branschsnittet. EBITDA-multipel på 8.5x reflekterar denna lönsamhet.",
      "confidence": 80
    },
    {
      "modelKey": "earnings_multiple",
      "suggestedMultiples": {
        "earningsMultiple": 12.0
      },
      "reasoning": "Nettovinstmarginalen på ${(netProfitMargin*100).toFixed(1)}% och tillväxten på ${(revenueGrowth*100).toFixed(1)}% stöder en högre vinstmultipel för detta stabila företag.",
      "confidence": 75
    },
    {
      "modelKey": "dcf_lite",
      "suggestedMultiples": {
        "discountRate": 0.095,
        "terminalMultiple": 9.0
      },
      "reasoning": "Diskontränta på 9.5% reflekterar företagets riskprofil som ${sizeBucket} företag i ${industry}. Terminal multiple på 9.0x är konservativt baserat på branschjämförelser.",
      "confidence": 70
    }
  ]
}`
}

/**
 * Parse LLM response into structured suggestions
 */
function parseLLMSuggestions(parsed: any, context: CompanyContext): LLMSuggestion[] {
  if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
    return []
  }

  return parsed.suggestions.map((suggestion: any) => ({
    modelKey: suggestion.modelKey || '',
    suggestedMultiples: {
      revenueMultiple: suggestion.suggestedMultiples?.revenueMultiple,
      ebitdaMultiple: suggestion.suggestedMultiples?.ebitdaMultiple,
      earningsMultiple: suggestion.suggestedMultiples?.earningsMultiple,
      discountRate: suggestion.suggestedMultiples?.discountRate,
      terminalMultiple: suggestion.suggestedMultiples?.terminalMultiple
    },
    reasoning: suggestion.reasoning || '',
    confidence: Math.min(100, Math.max(0, suggestion.confidence || 50)),
    source: 'llm_suggestion' as const
  }))
}

/**
 * Convert LLM suggestions to ValuationAssumptions format
 */
export function convertSuggestionsToAssumptions(suggestions: LLMSuggestion[]): ValuationAssumptions[] {
  return suggestions.map(suggestion => ({
    modelKey: suggestion.modelKey,
    revenueMultiple: suggestion.suggestedMultiples.revenueMultiple,
    ebitdaMultiple: suggestion.suggestedMultiples.ebitdaMultiple,
    earningsMultiple: suggestion.suggestedMultiples.earningsMultiple,
    discountRate: suggestion.suggestedMultiples.discountRate,
    terminalMultiple: suggestion.suggestedMultiples.terminalMultiple,
    netDebtMethod: 'ratio_revenue' as const,
    netDebtK: 0.2
  }))
}

/**
 * Validate LLM suggestions against reasonable ranges
 */
export function validateSuggestions(suggestions: LLMSuggestion[]): LLMSuggestion[] {
  return suggestions.map(suggestion => {
    const validated = { ...suggestion }
    
    // Validate revenue multiple (0.5x - 5.0x)
    if (validated.suggestedMultiples.revenueMultiple) {
      validated.suggestedMultiples.revenueMultiple = Math.max(0.5, Math.min(5.0, validated.suggestedMultiples.revenueMultiple))
    }
    
    // Validate EBITDA multiple (2.0x - 20.0x)
    if (validated.suggestedMultiples.ebitdaMultiple) {
      validated.suggestedMultiples.ebitdaMultiple = Math.max(2.0, Math.min(20.0, validated.suggestedMultiples.ebitdaMultiple))
    }
    
    // Validate earnings multiple (3.0x - 25.0x)
    if (validated.suggestedMultiples.earningsMultiple) {
      validated.suggestedMultiples.earningsMultiple = Math.max(3.0, Math.min(25.0, validated.suggestedMultiples.earningsMultiple))
    }
    
    // Validate discount rate (5% - 20%)
    if (validated.suggestedMultiples.discountRate) {
      validated.suggestedMultiples.discountRate = Math.max(0.05, Math.min(0.20, validated.suggestedMultiples.discountRate))
    }
    
    // Validate terminal multiple (5.0x - 15.0x)
    if (validated.suggestedMultiples.terminalMultiple) {
      validated.suggestedMultiples.terminalMultiple = Math.max(5.0, Math.min(15.0, validated.suggestedMultiples.terminalMultiple))
    }
    
    return validated
  })
}
