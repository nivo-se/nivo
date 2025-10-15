import { supabase } from './supabase'

export interface AIAnalysisRequest {
  query: string
  dataView: string
  filters?: {
    segment?: string
    city?: string
    minRevenue?: number
    maxRevenue?: number
    minEmployees?: number
    maxEmployees?: number
  }
}

export interface AIAnalysisResult {
  companies: any[]
  insights: string[]
  summary: {
    totalFound: number
    averageRevenue?: number
    averageGrowth?: number
    topSegments: { segment: string, count: number }[]
  }
  recommendations: string[]
}

export type AnalysisTemplate = {
  id: string
  name: string
  query: string
  description: string
  analysisType?: 'financial' | 'comprehensive' | 'investment' | 'market' | 'risk'
  focusAreas?: string[]
  timeHorizon?: 'short' | 'medium' | 'long'
}

export class AIAnalysisService {
  // Natural language query processing
  static async analyzeWithAI(request: AIAnalysisRequest): Promise<AIAnalysisResult> {
    try {
      // Step 1: Parse the natural language query
      const parsedQuery = await this.parseNaturalLanguageQuery(request.query)
      
      // Step 2: Build SQL query based on parsed intent
      const sqlQuery = await this.buildSQLFromIntent(parsedQuery, request.dataView, request.filters)
      
      // Step 3: Execute query and get results
      const rawResults = await this.executeQuery(sqlQuery)
      
      // Step 4: Generate AI insights
      const insights = await this.generateInsights(rawResults, request.query)
      
      // Step 5: Create summary and recommendations
      const summary = this.createSummary(rawResults)
      const recommendations = await this.generateRecommendations(rawResults, request.query)
      
      return {
        companies: rawResults,
        insights,
        summary,
        recommendations
      }
    } catch (error) {
      console.error('AI Analysis error:', error)
      throw new Error('Failed to analyze data with AI')
    }
  }

  // Parse natural language into structured intent
  private static async parseNaturalLanguageQuery(query: string): Promise<any> {
    // This would integrate with OpenAI or similar AI service
    // For now, we'll use pattern matching as a fallback
    
    const patterns = {
      highGrowth: /high.?growth|growing.?fast|growth.?rate/i,
      revenue: /revenue|turnover|sales/i,
      location: /stockholm|gothenburg|malmö|city|location/i,
      industry: /tech|ecommerce|retail|manufacturing|sector|industry/i,
      size: /large|small|medium|employees|size/i,
      profitability: /profit|profitable|margin|ebit/i
    }

    const intent = {
      criteria: [],
      filters: {},
      sortBy: 'revenue',
      limit: 50
    }

    // Extract criteria
    if (patterns.highGrowth.test(query)) {
      intent.criteria.push({ type: 'growth', operator: '>', value: 0.15 })
    }
    
    if (patterns.revenue.test(query)) {
      if (query.includes('>') || query.includes('more than')) {
        const match = query.match(/(\d+)\s*(million|m|billion|b)/i)
        if (match) {
          const value = parseFloat(match[1])
          const unit = match[2].toLowerCase()
          const multiplier = unit.includes('b') ? 1000000000 : 1000000
          intent.criteria.push({ type: 'revenue', operator: '>', value: value * multiplier })
        }
      }
    }

    if (patterns.location.test(query)) {
      const cityMatch = query.match(/(stockholm|gothenburg|malmö)/i)
      if (cityMatch) {
        intent.filters.city = cityMatch[1]
      }
    }

    if (patterns.industry.test(query)) {
      if (query.includes('tech')) {
        intent.filters.segment = 'tech'
      } else if (query.includes('ecommerce')) {
        intent.filters.segment = 'ecommerce'
      }
    }

    return intent
  }

  // Build SQL query from parsed intent
  private static async buildSQLFromIntent(intent: any, dataView: string, filters?: any): Promise<string> {
    let baseQuery = `SELECT * FROM ${dataView}`
    const conditions = []
    
    // Apply intent criteria
    intent.criteria.forEach((criterion: any) => {
      switch (criterion.type) {
        case 'growth':
          conditions.push(`revenue_growth ${criterion.operator} ${criterion.value}`)
          break
        case 'revenue':
          conditions.push(`revenue ${criterion.operator} ${criterion.value}`)
          break
      }
    })

    // Apply filters
    if (filters?.city) {
      conditions.push(`city ILIKE '%${filters.city}%'`)
    }
    if (filters?.segment) {
      conditions.push(`segment ILIKE '%${filters.segment}%'`)
    }
    if (filters?.minRevenue) {
      conditions.push(`revenue >= ${filters.minRevenue}`)
    }
    if (filters?.maxRevenue) {
      conditions.push(`revenue <= ${filters.maxRevenue}`)
    }

    // Apply intent filters
    if (intent.filters.city) {
      conditions.push(`city ILIKE '%${intent.filters.city}%'`)
    }
    if (intent.filters.segment) {
      conditions.push(`segment ILIKE '%${intent.filters.segment}%'`)
    }

    if (conditions.length > 0) {
      baseQuery += ` WHERE ${conditions.join(' AND ')}`
    }

    // Add ordering and limit
    baseQuery += ` ORDER BY ${intent.sortBy} DESC LIMIT ${intent.limit}`

    return baseQuery
  }

  // Execute the built query
  private static async executeQuery(sqlQuery: string): Promise<any[]> {
    try {
      // For now, we'll use Supabase's query builder
      // In production, you might want to use raw SQL execution
      
      // Parse the query to extract table and conditions
      const tableMatch = sqlQuery.match(/FROM (\w+)/i)
      const whereMatch = sqlQuery.match(/WHERE (.+?) ORDER/i)
      const orderMatch = sqlQuery.match(/ORDER BY (\w+)/i)
      const limitMatch = sqlQuery.match(/LIMIT (\d+)/i)

      if (!tableMatch) throw new Error('Invalid query format')

      let query = supabase.from(tableMatch[1]).select('*')

      if (whereMatch) {
        // This is simplified - in production you'd need a proper SQL parser
        const conditions = whereMatch[1].split(' AND ')
        conditions.forEach(condition => {
          if (condition.includes('ILIKE')) {
            const [field, , value] = condition.split(' ')
            query = query.ilike(field, value.replace(/'/g, ''))
          } else if (condition.includes('>=')) {
            const [field, , value] = condition.split(' ')
            query = query.gte(field, parseFloat(value))
          } else if (condition.includes('<=')) {
            const [field, , value] = condition.split(' ')
            query = query.lte(field, parseFloat(value))
          } else if (condition.includes('>')) {
            const [field, , value] = condition.split(' ')
            query = query.gt(field, parseFloat(value))
          }
        })
      }

      if (orderMatch) {
        query = query.order(orderMatch[1], { ascending: false })
      }

      if (limitMatch) {
        query = query.limit(parseInt(limitMatch[1]))
      }

      const { data, error } = await query

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Query execution error:', error)
      return []
    }
  }

  // Generate AI insights from results
  private static async generateInsights(results: any[], originalQuery: string): Promise<string[]> {
    const insights = []

    if (results.length === 0) {
      insights.push("No companies found matching your criteria. Try broadening your search parameters.")
      return insights
    }

    // Calculate basic statistics
    const revenues = results.map(r => parseFloat(r.revenue || r.Revenue || '0')).filter(r => r > 0)
    const avgRevenue = revenues.length > 0 ? revenues.reduce((a, b) => a + b, 0) / revenues.length : 0

    // Generate insights based on data
    insights.push(`Found ${results.length} companies matching your criteria.`)

    if (avgRevenue > 0) {
      insights.push(`Average revenue: ${(avgRevenue / 1000000).toFixed(1)}M SEK`)
    }

    // Industry distribution
    const segments = results.map(r => r.segment || r.Bransch || 'Unknown').filter(s => s !== 'Unknown')
    if (segments.length > 0) {
      const segmentCounts = segments.reduce((acc, seg) => {
        acc[seg] = (acc[seg] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      const topSegment = Object.entries(segmentCounts).sort(([,a], [,b]) => b - a)[0]
      if (topSegment) {
        insights.push(`Most common industry: ${topSegment[0]} (${topSegment[1]} companies)`)
      }
    }

    // Growth insights
    const growthRates = results.map(r => parseFloat(r.revenue_growth || r.Revenue_growth || '0')).filter(g => g > 0)
    if (growthRates.length > 0) {
      const avgGrowth = growthRates.reduce((a, b) => a + b, 0) / growthRates.length
      insights.push(`Average growth rate: ${(avgGrowth * 100).toFixed(1)}%`)
    }

    return insights
  }

  // Create summary statistics
  private static createSummary(results: any[]): any {
    const revenues = results.map(r => parseFloat(r.revenue || r.Revenue || '0')).filter(r => r > 0)
    const growthRates = results.map(r => parseFloat(r.revenue_growth || r.Revenue_growth || '0')).filter(g => g > 0)
    
    const segments = results.map(r => r.segment || r.Bransch || 'Unknown').filter(s => s !== 'Unknown')
    const segmentCounts = segments.reduce((acc, seg) => {
      acc[seg] = (acc[seg] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      totalFound: results.length,
      averageRevenue: revenues.length > 0 ? revenues.reduce((a, b) => a + b, 0) / revenues.length : 0,
      averageGrowth: growthRates.length > 0 ? growthRates.reduce((a, b) => a + b, 0) / growthRates.length : 0,
      topSegments: Object.entries(segmentCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([segment, count]) => ({ segment, count }))
    }
  }

  // Generate recommendations
  private static async generateRecommendations(results: any[], originalQuery: string): Promise<string[]> {
    const recommendations = []

    if (results.length > 10) {
      recommendations.push("Consider adding more specific filters to narrow down your results.")
    } else if (results.length < 5) {
      recommendations.push("Try broadening your search criteria to find more companies.")
    }

    // Industry-specific recommendations
    const segments = results.map(r => r.segment || r.Bransch || '').filter(s => s)
    if (segments.some(s => s.toLowerCase().includes('tech'))) {
      recommendations.push("Tech companies often benefit from digital transformation initiatives.")
    }
    if (segments.some(s => s.toLowerCase().includes('retail'))) {
      recommendations.push("Retail companies may be good candidates for e-commerce expansion.")
    }

    return recommendations
  }

  // Pre-built analysis templates
  static getAnalysisTemplates(): AnalysisTemplate[] {
    return [
      {
        id: 'investment-ready-tech',
        name: 'Investment Ready Tech',
        query: 'Identify SaaS or digital service companies with recurring revenue growth above 25% and solid margins',
        description: 'Find tech companies with stark skalbarhet',
        analysisType: 'investment',
        focusAreas: ['growth', 'profitability', 'digitalization'],
        timeHorizon: 'medium'
      },
      {
        id: 'resilient-industrials',
        name: 'Resilient Industrials',
        query: 'Show industrial companies in Sweden with EBIT margins above 12% and diversified customer base',
        description: 'Balans mellan motståndskraft och marginaler',
        analysisType: 'financial',
        focusAreas: ['profitability', 'risk'],
        timeHorizon: 'long'
      },
      {
        id: 'expansion-ready-retail',
        name: 'Expansion Ready Retail',
        query: 'Find retail and ecommerce companies primed for expansion outside Nordic region',
        description: 'Fokuserar på internationalisering',
        analysisType: 'market',
        focusAreas: ['expansion', 'digitalization'],
        timeHorizon: 'short'
      },
      {
        id: 'risk-audit',
        name: 'Risk Audit Focus',
        query: 'Run a concentrated risk analysis on mid-sized companies with high leverage',
        description: 'Identifiera riskprofil och mitigering',
        analysisType: 'risk',
        focusAreas: ['risk', 'profitability'],
        timeHorizon: 'short'
      }
    ]
  }
}
