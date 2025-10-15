import OpenAI from 'openai'

// Initialize OpenAI client (only if API key is available)
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null

export interface CompanyFinancialData {
  revenue: number
  profit: number
  employees: number
  revenueGrowth: number
  ebitMargin: number
  netProfitMargin: number
  segmentName?: string
  companySizeCategory?: string
  growthCategory?: string
  profitabilityCategory?: string
}

export interface AINarrativeInsights {
  summary: string
  sections: Array<{
    section_type: string
    title: string
    content_md: string
    supporting_metrics: Array<{
      metric_name: string
      metric_value: number
      metric_unit: string
    }>
    confidence: number
  }>
}

export class OpenAIService {
  /**
   * Generate comprehensive deep analysis using OpenAI GPT-4
   */
  static async generateDeepAnalysis(
    companyName: string,
    orgnr: string,
    financialData: CompanyFinancialData
  ): Promise<AINarrativeInsights> {
    try {
      // Check if OpenAI is available
      if (!openai) {
        console.log('OpenAI API key not available, using fallback analysis')
        return this.generateFallbackAnalysis(companyName, orgnr, financialData)
      }

      const prompt = this.buildAnalysisPrompt(companyName, orgnr, financialData)
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "Du är en expert på företagsanalys och M&A (förvärv och fusioner). Analysera svenska företag med fokus på investeringsmöjligheter, riskbedömning och tillväxtpotential. Svara alltid på svenska och använd professionell terminologi."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })

      const response = completion.choices[0]?.message?.content
      if (!response) {
        throw new Error('No response from OpenAI')
      }

      return this.parseAIResponse(response, financialData)
    } catch (error) {
      console.error('OpenAI API error:', error)
      // Return fallback analysis if OpenAI fails
      return this.generateFallbackAnalysis(companyName, orgnr, financialData)
    }
  }

  /**
   * Build comprehensive analysis prompt
   */
  private static buildAnalysisPrompt(
    companyName: string,
    orgnr: string,
    data: CompanyFinancialData
  ): string {
    return `
Analysera följande svenska företag för potentiell investering/förvärv:

**Företagsinformation:**
- Namn: ${companyName}
- Organisationsnummer: ${orgnr}
- Bransch: ${data.segmentName || 'Okänd'}
- Företagsstorlek: ${data.companySizeCategory || 'Okänd'}

**Finansiella nyckeltal:**
- Omsättning: ${data.revenue.toLocaleString()} SEK
- Vinst: ${data.profit.toLocaleString()} SEK
- Antal anställda: ${data.employees}
- Omsättningstillväxt: ${(data.revenueGrowth * 100).toFixed(1)}%
- EBIT-marginal: ${(data.ebitMargin * 100).toFixed(1)}%
- Nettoresultatmarginal: ${(data.netProfitMargin * 100).toFixed(1)}%
- Tillväxtkategori: ${data.growthCategory || 'Okänd'}
- Lönsamhetskategori: ${data.profitabilityCategory || 'Okänd'}

**Uppdrag:**
Generera en omfattande analys med följande sektioner:

1. **Sammanfattning** (2-3 meningar): Övergripande bedömning av företagets investeringspotential
2. **Finansiell Analys**: Detaljerad analys av lönsamhet, tillväxt och finansiell hälsa
3. **Marknadsanalys**: Branschkontext, konkurrensläge och marknadspotential
4. **Operativ Analys**: Effektivitet, skalbarhet och operativa förbättringsmöjligheter
5. **Riskbedömning**: Identifierade risker och hur de kan hanteras
6. **Investeringsrekommendation**: Slutlig rekommendation med motivering

Svara i JSON-format med följande struktur:
{
  "summary": "Kort sammanfattning...",
  "sections": [
    {
      "section_type": "financial_analysis",
      "title": "Finansiell Analys",
      "content_md": "Detaljerad analys...",
      "supporting_metrics": [
        {
          "metric_name": "Omsättningstillväxt",
          "metric_value": 15,
          "metric_unit": "%"
        }
      ],
      "confidence": 85
    }
  ]
}
`
  }

  /**
   * Parse AI response and structure it properly
   */
  private static parseAIResponse(
    response: string,
    financialData: CompanyFinancialData
  ): AINarrativeInsights {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          summary: parsed.summary || 'Analys genererad av AI',
          sections: parsed.sections || []
        }
      }
    } catch (error) {
      console.error('Failed to parse AI response as JSON:', error)
    }

    // Fallback: create structured response from text
    return {
      summary: response.substring(0, 200) + '...',
      sections: [
        {
          section_type: 'ai_analysis',
          title: 'AI Analys',
          content_md: response,
          supporting_metrics: [
            {
              metric_name: 'Omsättning',
              metric_value: Math.round(financialData.revenue / 1000),
              metric_unit: 'TSEK'
            },
            {
              metric_name: 'Anställda',
              metric_value: financialData.employees,
              metric_unit: 'personer'
            }
          ],
          confidence: 75
        }
      ]
    }
  }

  /**
   * Generate fallback analysis if OpenAI fails
   */
  private static generateFallbackAnalysis(
    companyName: string,
    orgnr: string,
    data: CompanyFinancialData
  ): AINarrativeInsights {
    const growthText = data.revenueGrowth > 0.1 ? 'stark tillväxt' : 
                      data.revenueGrowth > 0 ? 'måttlig tillväxt' : 'stagnation'
    
    const profitabilityText = data.ebitMargin > 0.1 ? 'hög lönsamhet' :
                             data.ebitMargin > 0.05 ? 'god lönsamhet' :
                             data.ebitMargin > 0 ? 'låg lönsamhet' : 'förluster'

    return {
      summary: `${companyName} är ett ${data.segmentName || 'svenskt'} företag med ${growthText} och ${profitabilityText}. Företaget har ${data.employees} anställda och en omsättning på ${data.revenue.toLocaleString()} SEK.`,
      sections: [
        {
          section_type: 'financial_analysis',
          title: 'Finansiell Analys',
          content_md: `**Omsättningstillväxt**: ${(data.revenueGrowth * 100).toFixed(1)}% - ${data.revenueGrowth > 0.1 ? 'Stark tillväxt som indikerar god marknadsposition' : data.revenueGrowth > 0 ? 'Måttlig tillväxt som kräver förbättring' : 'Stagnation som kräver omedelbar åtgärd'}

**Lönsamhet**: EBIT-marginal på ${(data.ebitMargin * 100).toFixed(1)}% - ${data.ebitMargin > 0.1 ? 'Hög lönsamhet som visar effektiv verksamhet' : data.ebitMargin > 0.05 ? 'God lönsamhet med utrymme för förbättring' : 'Låg lönsamhet som kräver kostnadsoptimering'}

**Finansiell hälsa**: Företaget har ${data.profit > 0 ? 'positiv vinst' : 'förluster'} vilket ${data.profit > 0 ? 'stärker' : 'försvagar'} dess finansiella ställning.`,
          supporting_metrics: [
            {
              metric_name: 'Omsättningstillväxt',
              metric_value: Math.round(data.revenueGrowth * 100),
              metric_unit: '%'
            },
            {
              metric_name: 'EBIT-marginal',
              metric_value: Math.round(data.ebitMargin * 100),
              metric_unit: '%'
            }
          ],
          confidence: 80
        },
        {
          section_type: 'market_analysis',
          title: 'Marknadsanalys',
          content_md: `**Branschkontext**: ${data.segmentName || 'Okänd bransch'} - Analysera marknadens tillväxtpotential och konkurrensläge.

**Marknadsposition**: Företagets storlek (${data.companySizeCategory || 'okänd'}) och tillväxt (${data.growthCategory || 'okänd'}) indikerar dess position på marknaden.

**Konkurrensfördelar**: Utvärdera företagets unika värdeerbjudande och konkurrensfördelar.`,
          supporting_metrics: [
            {
              metric_name: 'Omsättning per anställd',
              metric_value: Math.round(data.revenue / data.employees),
              metric_unit: 'SEK'
            }
          ],
          confidence: 70
        }
      ]
    }
  }
}
