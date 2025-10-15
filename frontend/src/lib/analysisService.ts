export interface AnalyzedCompany {
  runId: string
  companyName: string
  orgnr: string
  analysisDate: string
  recommendation: string
  screeningScore: number
  riskLevel: string
  summary: string
  financialGrade: string
  commercialGrade: string
  operationalGrade: string
  confidence: number
  modelVersion: string
  nextSteps: string[]
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
  metrics: Array<{
    metric_name: string
    metric_value: string
    metric_unit: string
  }>
}

export interface AnalysisFilters {
  search?: string
  recommendation?: string
  riskLevel?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface AnalysisResult {
  companies: AnalyzedCompany[]
  total: number
  page: number
  totalPages: number
}

export class AnalysisService {
  private static baseUrl = '/api'

  /**
   * Get all analyzed companies with filtering and pagination
   */
  static async getAnalyzedCompanies(filters: AnalysisFilters = {}): Promise<AnalysisResult> {
    try {
      const params = new URLSearchParams()
      
      if (filters.search) params.append('search', filters.search)
      if (filters.recommendation) params.append('recommendation', filters.recommendation)
      if (filters.riskLevel) params.append('riskLevel', filters.riskLevel)
      if (filters.sortBy) params.append('sortBy', filters.sortBy)
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder)
      if (filters.page) params.append('page', filters.page.toString())
      if (filters.limit) params.append('limit', filters.limit.toString())

      const response = await fetch(`${this.baseUrl}/analyzed-companies?${params}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error fetching analyzed companies:', error)
      // Return mock data for development
      return this.getMockAnalyzedCompanies(filters)
    }
  }

  /**
   * Get detailed analysis by run ID
   */
  static async getAnalysisById(runId: string): Promise<AnalyzedCompany | null> {
    try {
      const response = await fetch(`${this.baseUrl}/analyzed-companies/${runId}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error fetching analysis by ID:', error)
      return null
    }
  }

  /**
   * Delete an analysis
   */
  static async deleteAnalysis(runId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/analyzed-companies/${runId}`, {
        method: 'DELETE'
      })
      
      return response.ok
    } catch (error) {
      console.error('Error deleting analysis:', error)
      return false
    }
  }

  /**
   * Export analysis as PDF
   */
  static async exportAnalysisAsPDF(runId: string): Promise<Blob | null> {
    try {
      const response = await fetch(`${this.baseUrl}/analyzed-companies/${runId}/export`, {
        method: 'GET'
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.blob()
    } catch (error) {
      console.error('Error exporting analysis:', error)
      return null
    }
  }

  /**
   * Mock data for development/testing
   */
  private static getMockAnalyzedCompanies(filters: AnalysisFilters): AnalysisResult {
    const mockCompanies: AnalyzedCompany[] = [
      {
        runId: 'mock-1',
        companyName: 'Tullkurvan AB',
        orgnr: '5591747166',
        analysisDate: new Date().toISOString(),
        recommendation: 'Sälj',
        screeningScore: 73,
        riskLevel: 'Medium risk',
        summary: 'Tullkurvan AB är ett Bilreservdelar företag med stark tillväxt och låg lönsamhet. Företaget har 6 anställda och en omsättning på 23,128 SEK.',
        financialGrade: 'C',
        commercialGrade: 'C',
        operationalGrade: 'B',
        confidence: 95,
        modelVersion: 'gpt-4',
        nextSteps: [
          'Genomför detaljerad finansiell analys',
          'Utvärdera marknadspotential',
          'Analysera konkurrensläge',
          'Bedöm operativa förbättringsmöjligheter'
        ],
        sections: [
          {
            section_type: 'financial_analysis',
            title: 'Finansiell Analys',
            content_md: '**Omsättningstillväxt**: 14.4% - Stark tillväxt som indikerar god marknadsposition\n\n**Lönsamhet**: EBIT-marginal på 4.8% - God lönsamhet med utrymme för förbättring\n\n**Finansiell hälsa**: Företaget har positiv vinst vilket stärker dess finansiella ställning.',
            supporting_metrics: [
              {
                metric_name: 'Omsättningstillväxt',
                metric_value: 14,
                metric_unit: '%'
              },
              {
                metric_name: 'EBIT-marginal',
                metric_value: 5,
                metric_unit: '%'
              }
            ],
            confidence: 80
          },
          {
            section_type: 'market_analysis',
            title: 'Marknadsanalys',
            content_md: '**Branschkontext**: Bilreservdelar - Analysera marknadens tillväxtpotential och konkurrensläge.\n\n**Marknadsposition**: Företagets storlek (Micro) och tillväxt (Medium Growth) indikerar dess position på marknaden.\n\n**Konkurrensfördelar**: Utvärdera företagets unika värdeerbjudande och konkurrensfördelar.',
            supporting_metrics: [
              {
                metric_name: 'Omsättning per anställd',
                metric_value: 3855,
                metric_unit: 'SEK'
              }
            ],
            confidence: 70
          }
        ],
        metrics: [
          {
            metric_name: 'Omsättning',
            metric_value: '23,128',
            metric_unit: 'SEK'
          },
          {
            metric_name: 'Anställda',
            metric_value: '6',
            metric_unit: 'personer'
          }
        ]
      },
      {
        runId: 'mock-2',
        companyName: 'Wildlife Studios Sweden AB',
        orgnr: '5593152019',
        analysisDate: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        recommendation: 'Köp',
        screeningScore: 85,
        riskLevel: 'Low risk',
        summary: 'Wildlife Studios Sweden AB är ett Data- och TV-spel företag med stark tillväxt och god lönsamhet. Företaget har 17 anställda och en omsättning på 40,148 SEK.',
        financialGrade: 'B',
        commercialGrade: 'A',
        operationalGrade: 'A',
        confidence: 92,
        modelVersion: 'gpt-4',
        nextSteps: [
          'Genomför detaljerad finansiell analys',
          'Utvärdera marknadspotential',
          'Analysera konkurrensläge',
          'Bedöm operativa förbättringsmöjligheter'
        ],
        sections: [
          {
            section_type: 'financial_analysis',
            title: 'Finansiell Analys',
            content_md: '**Omsättningstillväxt**: 40.5% - Exceptionell tillväxt som indikerar stark marknadsposition\n\n**Lönsamhet**: EBIT-marginal på 5.7% - God lönsamhet som visar effektiv verksamhet\n\n**Finansiell hälsa**: Företaget har stark vinsttillväxt vilket stärker dess finansiella ställning.',
            supporting_metrics: [
              {
                metric_name: 'Omsättningstillväxt',
                metric_value: 41,
                metric_unit: '%'
              },
              {
                metric_name: 'EBIT-marginal',
                metric_value: 6,
                metric_unit: '%'
              }
            ],
            confidence: 90
          }
        ],
        metrics: [
          {
            metric_name: 'Omsättning',
            metric_value: '40,148',
            metric_unit: 'SEK'
          },
          {
            metric_name: 'Anställda',
            metric_value: '17',
            metric_unit: 'personer'
          }
        ]
      }
    ]

    // Apply filters
    let filtered = mockCompanies

    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter(company => 
        company.companyName.toLowerCase().includes(searchLower) ||
        company.orgnr.includes(searchLower)
      )
    }

    if (filters.recommendation) {
      filtered = filtered.filter(company => company.recommendation === filters.recommendation)
    }

    if (filters.riskLevel) {
      filtered = filtered.filter(company => company.riskLevel === filters.riskLevel)
    }

    // Apply sorting
    if (filters.sortBy) {
      filtered.sort((a, b) => {
        let aValue: any, bValue: any

        switch (filters.sortBy) {
          case 'date':
            aValue = new Date(a.analysisDate).getTime()
            bValue = new Date(b.analysisDate).getTime()
            break
          case 'score':
            aValue = a.screeningScore
            bValue = b.screeningScore
            break
          case 'company':
            aValue = a.companyName.toLowerCase()
            bValue = b.companyName.toLowerCase()
            break
          default:
            return 0
        }

        if (filters.sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1
        } else {
          return aValue < bValue ? 1 : -1
        }
      })
    }

    // Apply pagination
    const page = filters.page || 1
    const limit = filters.limit || 20
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginated = filtered.slice(startIndex, endIndex)

    return {
      companies: paginated,
      total: filtered.length,
      page,
      totalPages: Math.ceil(filtered.length / limit)
    }
  }
}

// Export singleton instance
export const analysisService = new AnalysisService()
