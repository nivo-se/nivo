export interface AnalysisRun {
  id: string
  startedAt: string
  completedAt: string | null
  analysisMode: 'screening' | 'deep'
  templateName: string | null
  customInstructions: string | null
  companyCount: number
  companies: Array<{ orgnr: string; name: string }>
  status: 'completed' | 'failed' | 'running'
  modelVersion: string
  initiatedBy: string
}

export interface AnalysisRunFilters {
  search?: string
  analysisMode?: 'screening' | 'deep' | 'all'
  templateId?: string
  dateFrom?: string
  dateTo?: string
  status?: string
  sortBy?: 'date' | 'companies' | 'template'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface AnalysisRunsResult {
  runs: AnalysisRun[]
  total: number
  page: number
  totalPages: number
}

export class AnalysisRunsService {
  private static baseUrl = '/api'

  /**
   * Get all analysis runs with filtering and pagination
   */
  static async getAnalysisRuns(filters: AnalysisRunFilters = {}): Promise<AnalysisRunsResult> {
    try {
      const params = new URLSearchParams()
      
      if (filters.search) params.append('search', filters.search)
      if (filters.analysisMode && filters.analysisMode !== 'all') params.append('analysis_mode', filters.analysisMode)
      if (filters.templateId && filters.templateId !== 'all') params.append('template_id', filters.templateId)
      if (filters.dateFrom) params.append('date_from', filters.dateFrom)
      if (filters.dateTo) params.append('date_to', filters.dateTo)
      if (filters.status && filters.status !== 'all') params.append('status', filters.status)
      if (filters.sortBy) params.append('sort_by', filters.sortBy)
      if (filters.sortOrder) params.append('sort_order', filters.sortOrder)
      if (filters.page) params.append('page', filters.page.toString())
      if (filters.limit) params.append('limit', filters.limit.toString())

      const response = await fetch(`${this.baseUrl}/analysis-runs?${params}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch analysis runs')
      }

      return {
        runs: data.runs || [],
        total: data.total || 0,
        page: data.page || 1,
        totalPages: data.totalPages || 0
      }
    } catch (error) {
      console.error('Error fetching analysis runs:', error)
      // Return mock data for development
      return this.getMockAnalysisRuns(filters)
    }
  }

  /**
   * Get detailed analysis run by ID
   */
  static async getRunDetails(runId: string): Promise<AnalysisRun | null> {
    try {
      const response = await fetch(`${this.baseUrl}/analysis-runs/${runId}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch run details')
      }

      return data.run || null
    } catch (error) {
      console.error('Error fetching run details:', error)
      return null
    }
  }

  /**
   * Delete an analysis run
   */
  static async deleteRun(runId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/analysis-runs/${runId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data.success === true
    } catch (error) {
      console.error('Error deleting run:', error)
      return false
    }
  }

  /**
   * Re-run an analysis with the same parameters
   */
  static async reRunAnalysis(runId: string): Promise<{ success: boolean; newRunId?: string; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/analysis-runs/${runId}/rerun`, {
        method: 'POST'
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return {
        success: data.success === true,
        newRunId: data.newRunId,
        error: data.error
      }
    } catch (error) {
      console.error('Error re-running analysis:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Mock data for development
   */
  private static getMockAnalysisRuns(filters: AnalysisRunFilters): AnalysisRunsResult {
    const mockRuns: AnalysisRun[] = [
      {
        id: 'mock-run-1',
        startedAt: '2024-01-15T10:30:00Z',
        completedAt: '2024-01-15T10:35:00Z',
        analysisMode: 'deep',
        templateName: 'Högväxande Teknikföretag',
        customInstructions: null,
        companyCount: 3,
        companies: [
          { orgnr: '5561234567', name: 'TechCorp AB' },
          { orgnr: '5562345678', name: 'Innovation Ltd' },
          { orgnr: '5563456789', name: 'Digital Solutions AB' }
        ],
        status: 'completed',
        modelVersion: 'gpt-4o-mini',
        initiatedBy: 'user-123'
      },
      {
        id: 'mock-run-2',
        startedAt: '2024-01-14T14:20:00Z',
        completedAt: '2024-01-14T14:25:00Z',
        analysisMode: 'screening',
        templateName: null,
        customInstructions: 'Analysera företag inom tillverkningssektorn med fokus på lönsamhet',
        companyCount: 8,
        companies: [
          { orgnr: '5564567890', name: 'Manufacturing Co' },
          { orgnr: '5565678901', name: 'Industrial AB' },
          { orgnr: '5566789012', name: 'Production Ltd' }
        ],
        status: 'completed',
        modelVersion: 'gpt-4o-mini',
        initiatedBy: 'user-123'
      },
      {
        id: 'mock-run-3',
        startedAt: '2024-01-13T09:15:00Z',
        completedAt: null,
        analysisMode: 'deep',
        templateName: 'Förvärvsmål',
        customInstructions: null,
        companyCount: 2,
        companies: [
          { orgnr: '5567890123', name: 'Target Corp' },
          { orgnr: '5568901234', name: 'Acquisition AB' }
        ],
        status: 'running',
        modelVersion: 'gpt-4o-mini',
        initiatedBy: 'user-123'
      }
    ]

    // Apply filters to mock data
    let filteredRuns = mockRuns

    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filteredRuns = filteredRuns.filter(run => 
        run.templateName?.toLowerCase().includes(searchLower) ||
        run.customInstructions?.toLowerCase().includes(searchLower) ||
        run.id.toLowerCase().includes(searchLower) ||
        run.companies.some(company => 
          company.name.toLowerCase().includes(searchLower) ||
          company.orgnr.includes(searchLower)
        )
      )
    }

    if (filters.analysisMode && filters.analysisMode !== 'all') {
      filteredRuns = filteredRuns.filter(run => run.analysisMode === filters.analysisMode)
    }

    if (filters.status && filters.status !== 'all') {
      filteredRuns = filteredRuns.filter(run => run.status === filters.status)
    }

    if (filters.templateId && filters.templateId !== 'all') {
      if (filters.templateId === 'custom') {
        filteredRuns = filteredRuns.filter(run => run.templateName === null)
      } else {
        filteredRuns = filteredRuns.filter(run => run.templateName !== null)
      }
    }

    // Apply sorting
    if (filters.sortBy) {
      filteredRuns.sort((a, b) => {
        let aValue: any, bValue: any
        
        switch (filters.sortBy) {
          case 'date':
            aValue = new Date(a.startedAt).getTime()
            bValue = new Date(b.startedAt).getTime()
            break
          case 'companies':
            aValue = a.companyCount
            bValue = b.companyCount
            break
          case 'template':
            aValue = a.templateName || a.customInstructions || ''
            bValue = b.templateName || b.customInstructions || ''
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
    const paginatedRuns = filteredRuns.slice(startIndex, endIndex)

    return {
      runs: paginatedRuns,
      total: filteredRuns.length,
      page,
      totalPages: Math.ceil(filteredRuns.length / limit)
    }
  }
}
