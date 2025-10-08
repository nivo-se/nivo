import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Badge } from './ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import {
  Brain,
  Search,
  TrendingUp,
  Building2,
  Lightbulb,
  Loader2,
  Sparkles,
  List,
  Target,
  ShieldCheck,
  ClipboardList,
  BarChart3
} from 'lucide-react'
import { AIAnalysisService, type AnalysisTemplate } from '../lib/aiAnalysisService'
import { supabaseDataService, type SupabaseCompany } from '../lib/supabaseDataService'

interface SavedCompanyList {
  id: string
  name: string
  companies: SupabaseCompany[]
  createdAt: string
}

type AnalysisType = 'financial' | 'comprehensive' | 'investment' | 'market' | 'risk'
type TimeHorizon = 'short' | 'medium' | 'long'

interface TokenUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

interface DatasetSummary {
  averageRevenue?: number
  averageGrowth?: number
  medianEBITMargin?: number
  medianNetMargin?: number
  averageDigitalPresence?: number
  totalEmployees?: number
  topIndustries?: { name: string; count: number }[]
}

interface AICompanyInsight {
  orgNr?: string
  name: string
  executiveSummary?: string
  financialHealth?: number
  growthPotential?: string
  marketPosition?: string
  strengths?: string[]
  weaknesses?: string[]
  opportunities?: string[]
  risks?: string[]
  recommendation?: string
  targetPrice?: number | null
  confidence?: number
}

interface AIPortfolioInsights {
  themes?: string[]
  signals?: string[]
  benchmarks?: string[]
}

interface AIActionPlan {
  quickWins?: string[]
  strategicMoves?: string[]
  riskMitigations?: string[]
  nextSteps?: string[]
}

interface AIAnalysisMeta {
  analysisType: AnalysisType | string
  generatedAt: string
  companyCount: number
  focusAreas?: string[]
  timeHorizon?: TimeHorizon | 'unspecified'
  summaryInsights?: string[]
  datasetSummary?: DatasetSummary
}

interface AIAnalysisPayload {
  meta: AIAnalysisMeta
  portfolioInsights?: AIPortfolioInsights
  companies: AICompanyInsight[]
  actionPlan?: AIActionPlan
  rawResponse?: string
}

interface AIAnalysisProps {
  selectedDataView?: string
}

const focusAreaOptions: { id: string; label: string; description: string }[] = [
  { id: 'profitability', label: 'Lönsamhet', description: 'Marginaler, kassaflöde, kapitalstruktur' },
  { id: 'growth', label: 'Tillväxt', description: 'Omsättningstillväxt och skalbarhet' },
  { id: 'risk', label: 'Risk', description: 'Riskjusterad avkastning och motståndskraft' },
  { id: 'digitalization', label: 'Digitalisering', description: 'Digital närvaro och automatisering' },
  { id: 'expansion', label: 'Expansion', description: 'Marknadsexpansion och internationalisering' }
]

const analysisTypeLabels: Record<AnalysisType, string> = {
  comprehensive: 'Helhetsanalys',
  financial: 'Finansiell due diligence',
  investment: 'Investeringscase',
  market: 'Marknadsposition',
  risk: 'Riskdiagnos'
}

const timeHorizonLabels: Record<TimeHorizon | 'unspecified', string> = {
  short: '0-12 månader',
  medium: '12-24 månader',
  long: '24+ månader',
  unspecified: 'Ej angivet'
}

const getFocusAreaLabel = (id: string) => focusAreaOptions.find((option) => option.id === id)?.label || id

const AIAnalysis: React.FC<AIAnalysisProps> = ({ selectedDataView = 'master_analytics' }) => {
  const [query, setQuery] = useState('')
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisPayload | null>(null)
  const [usage, setUsage] = useState<TokenUsage | undefined>()
  const [rawResponse, setRawResponse] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [savedLists, setSavedLists] = useState<SavedCompanyList[]>([])
  const [selectedList, setSelectedList] = useState<string>('')
  const [companies, setCompanies] = useState<SupabaseCompany[]>([])
  const [totalCompanies, setTotalCompanies] = useState<number>(0)
  const [loadingCompanies, setLoadingCompanies] = useState<boolean>(false)
  const [analysisType, setAnalysisType] = useState<AnalysisType>('comprehensive')
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<string[]>([])
  const [selectedTimeHorizon, setSelectedTimeHorizon] = useState<TimeHorizon>('medium')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const templates = AIAnalysisService.getAnalysisTemplates()

  // Load saved lists on mount
  useEffect(() => {
    const saved = localStorage.getItem('savedCompanyLists')
    if (saved) {
      try {
        const lists = JSON.parse(saved)
        setSavedLists(lists)
      } catch (error) {
        console.error('Error loading saved lists:', error)
      }
    }
  }, [])

  // Load companies when list is selected or when "All companies" is chosen
  useEffect(() => {
    if (selectedList && selectedList !== '') {
      const list = savedLists.find((l) => l.id === selectedList)
      if (list) {
        setCompanies(list.companies)
        setTotalCompanies(list.companies.length)
      }
    } else {
      setCompanies([])
      setTotalCompanies(8438) // Known dataset size
    }
  }, [selectedList, savedLists])

  // Load companies on-demand for analysis
  const loadCompaniesForAnalysis = async (currentQuery: string, limit: number = 50) => {
    try {
      setLoadingCompanies(true)
      const result = await supabaseDataService.getCompanies(1, limit)
      setCompanies(result.companies || [])
      return result.companies || []
    } catch (error) {
      console.error('Error loading companies for analysis:', error)
      setCompanies([])
      return []
    } finally {
      setLoadingCompanies(false)
    }
  }

  const handleAnalyze = async () => {
    if (!query.trim()) return

    setLoading(true)
    setErrorMessage(null)
    try {
      let companiesToAnalyze: SupabaseCompany[] = []

      if (selectedList && selectedList !== '') {
        companiesToAnalyze = companies
      } else {
        companiesToAnalyze = await loadCompaniesForAnalysis(query.trim(), 50)
      }

      if (companiesToAnalyze.length === 0) {
        throw new Error('No companies available for analysis')
      }

      const response = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          companies: companiesToAnalyze.slice(0, 5),
          analysisType,
          query: query.trim(),
          focusAreas: selectedFocusAreas,
          timeHorizon: selectedTimeHorizon
        }),
        signal: AbortSignal.timeout(60000)
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Analysis failed')
      }

      const parsedAnalysis: AIAnalysisPayload | null = data.analysis
        ? {
            ...data.analysis,
            meta: {
              ...data.analysis.meta,
              datasetSummary:
                data.analysis.meta?.datasetSummary || data.datasetSummary || undefined
            }
          }
        : null

      setAnalysisResult(parsedAnalysis)
      setUsage(data.usage)
      setRawResponse(data.rawText)
    } catch (error) {
      console.error('Analysis failed:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Analysis failed')
      setAnalysisResult(null)
    } finally {
      setLoading(false)
    }
  }

  const handleTemplateSelect = (template: AnalysisTemplate) => {
    setQuery(template.query)
    setSelectedTemplate(template.id)
    if (template.analysisType) {
      setAnalysisType(template.analysisType)
    }
    if (template.focusAreas) {
      setSelectedFocusAreas(template.focusAreas)
    }
    if (template.timeHorizon) {
      setSelectedTimeHorizon(template.timeHorizon)
    }
  }

  const toggleFocusArea = (id: string) => {
    setSelectedFocusAreas((prev) =>
      prev.includes(id) ? prev.filter((area) => area !== id) : [...prev, id]
    )
  }

  const datasetSummary = analysisResult?.meta?.datasetSummary
  const actionPlan = analysisResult?.actionPlan
  const focusAreas = Array.isArray(analysisResult?.meta?.focusAreas)
    ? (analysisResult.meta?.focusAreas as string[])
    : []

  return (
    <div className="space-y-6">
      {/* AI Analysis Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Brain className="h-6 w-6 text-purple-600" />
            <CardTitle>AI-Powered Analysis</CardTitle>
          </div>
          <CardDescription>
            Ask questions about your data in natural language and get intelligent insights
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Saved Lists Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center">
                <List className="h-4 w-4 mr-2" />
                Choose data source:
              </label>
              <Select value={selectedList || 'all'} onValueChange={(value) => setSelectedList(value === 'all' ? '' : value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All companies (or select a saved list)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    All companies ({selectedList === '' ? totalCompanies : companies.length})
                    {selectedList === '' && ' - Loaded on-demand'}
                  </SelectItem>
                  {savedLists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name} ({list.companies.length} companies)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Query Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Ask a question about your data:</label>
              <div className="flex space-x-2">
                <Input
                  placeholder="e.g., Find high-growth tech companies in Stockholm with revenue > 10M SEK"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                  className="flex-1"
                />
                <Button
                  onClick={handleAnalyze}
                  disabled={loading || loadingCompanies || !query.trim()}
                  className="px-6"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : loadingCompanies ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading companies...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Analyze
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Analysis Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Analysis profile</label>
                <Select value={analysisType} onValueChange={(value) => setAnalysisType(value as AnalysisType)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select analysis type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comprehensive">Helhetsanalys</SelectItem>
                    <SelectItem value="financial">Finansiell due diligence</SelectItem>
                    <SelectItem value="investment">Investeringscase</SelectItem>
                    <SelectItem value="market">Marknadsposition</SelectItem>
                    <SelectItem value="risk">Riskdiagnos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Tids horisont</label>
                <Select value={selectedTimeHorizon} onValueChange={(value) => setSelectedTimeHorizon(value as TimeHorizon)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select horizon" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">0-12 månader</SelectItem>
                    <SelectItem value="medium">12-24 månader</SelectItem>
                    <SelectItem value="long">24+ månader</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Fokusområden</label>
                <div className="flex flex-wrap gap-2">
                  {focusAreaOptions.map((option) => (
                    <Button
                      key={option.id}
                      size="sm"
                      type="button"
                      variant={selectedFocusAreas.includes(option.id) ? 'default' : 'outline'}
                      onClick={() => toggleFocusArea(option.id)}
                      title={option.description}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Templates */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Or try a quick analysis:</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {templates.map((template) => (
                  <Button
                    key={template.id}
                    variant={selectedTemplate === template.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleTemplateSelect(template)}
                    className="h-auto p-3 text-left justify-start"
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{template.name}</span>
                      <span className="text-xs opacity-70">{template.description}</span>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {errorMessage && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <p className="text-sm text-red-700">{errorMessage}</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {analysisResult && (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold">{analysisResult.meta?.companyCount ?? 0}</p>
                    <p className="text-xs text-gray-600">Analyserade bolag</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {datasetSummary?.averageRevenue && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-2xl font-bold">
                        {(datasetSummary.averageRevenue / 1000).toFixed(1)}M
                      </p>
                      <p className="text-xs text-gray-600">Genomsnittlig omsättning (MSEK)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {datasetSummary?.averageGrowth && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="text-2xl font-bold">
                        {(datasetSummary.averageGrowth * 100).toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-600">Genomsnittlig tillväxt</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Sparkles className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="text-2xl font-bold">{analysisResult.meta.summaryInsights?.length ?? 0}</p>
                    <p className="text-xs text-gray-600">Strategiska insikter</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Meta Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <span>Analysöversikt</span>
              </CardTitle>
              <CardDescription>
                {analysisResult.meta?.generatedAt
                  ? new Date(analysisResult.meta.generatedAt).toLocaleString('sv-SE')
                  : 'Okänt genereringsdatum'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    Profil:{' '}
                    {analysisTypeLabels[analysisResult.meta?.analysisType as AnalysisType] ||
                      analysisResult.meta?.analysisType ||
                      'Okänd'}
                  </Badge>
                  <Badge variant="secondary">
                    Tidshorisont:{' '}
                    {timeHorizonLabels[(analysisResult.meta?.timeHorizon as TimeHorizon | undefined) || 'unspecified']}
                  </Badge>
                {focusAreas.map((area) => (
                  <Badge key={area} variant="outline">
                    {getFocusAreaLabel(area)}
                  </Badge>
                ))}
              </div>
              {analysisResult.meta.summaryInsights && analysisResult.meta.summaryInsights.length > 0 && (
                <div className="grid gap-2">
                  {analysisResult.meta.summaryInsights.map((insight, index) => (
                    <div key={index} className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-900">{insight}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Portfolio Insights */}
          {(analysisResult.portfolioInsights?.themes?.length ||
            analysisResult.portfolioInsights?.signals?.length ||
            analysisResult.portfolioInsights?.benchmarks?.length) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Lightbulb className="h-5 w-5 text-yellow-600" />
                  <span>Portföljinsikter</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-3 gap-4">
                {analysisResult.portfolioInsights?.themes && (
                  <div>
                    <h4 className="font-semibold mb-2">Teman</h4>
                    <ul className="space-y-2 text-sm">
                      {analysisResult.portfolioInsights?.themes?.map((theme, index) => (
                        <li key={index} className="p-2 bg-purple-50 rounded">{theme}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysisResult.portfolioInsights?.signals && (
                  <div>
                    <h4 className="font-semibold mb-2">Signaler</h4>
                    <ul className="space-y-2 text-sm">
                      {analysisResult.portfolioInsights?.signals?.map((signal, index) => (
                        <li key={index} className="p-2 bg-green-50 rounded">{signal}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysisResult.portfolioInsights?.benchmarks && (
                  <div>
                    <h4 className="font-semibold mb-2">Benchmark</h4>
                    <ul className="space-y-2 text-sm">
                      {analysisResult.portfolioInsights?.benchmarks?.map((benchmark, index) => (
                        <li key={index} className="p-2 bg-orange-50 rounded">{benchmark}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Top Segments */}
          {datasetSummary?.topIndustries && datasetSummary.topIndustries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top Industries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {datasetSummary.topIndustries.map((segment, index) => (
                    <Badge key={index} variant="secondary" className="text-sm">
                      {segment.name} ({segment.count})
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Plan */}
          {actionPlan &&
            (actionPlan.quickWins?.length ||
              actionPlan.strategicMoves?.length ||
              actionPlan.riskMitigations?.length ||
              actionPlan.nextSteps?.length) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <ClipboardList className="h-5 w-5 text-emerald-600" />
                  <span>Handlingsplan</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                {actionPlan?.quickWins && actionPlan.quickWins.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Snabba vinster</h4>
                    <ul className="space-y-2 text-sm">
                      {actionPlan.quickWins.map((item, index) => (
                        <li key={index} className="p-2 bg-green-50 rounded">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {actionPlan?.strategicMoves && actionPlan.strategicMoves.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Strategiska initiativ</h4>
                    <ul className="space-y-2 text-sm">
                      {actionPlan.strategicMoves.map((item, index) => (
                        <li key={index} className="p-2 bg-blue-50 rounded">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {actionPlan?.riskMitigations && actionPlan.riskMitigations.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Riskmitigering</h4>
                    <ul className="space-y-2 text-sm">
                      {actionPlan.riskMitigations.map((item, index) => (
                        <li key={index} className="p-2 bg-red-50 rounded">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {actionPlan?.nextSteps && actionPlan.nextSteps.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Nästa steg</h4>
                    <ul className="space-y-2 text-sm">
                      {actionPlan.nextSteps.map((item, index) => (
                        <li key={index} className="p-2 bg-gray-100 rounded">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Token usage */}
          {usage && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="h-5 w-5 text-indigo-600" />
                  <span>Tokenanvändning</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="p-3 border rounded-md">
                  <p className="text-xs text-gray-500">Prompt tokens</p>
                  <p className="text-lg font-semibold">{usage.prompt_tokens}</p>
                </div>
                <div className="p-3 border rounded-md">
                  <p className="text-xs text-gray-500">Completion tokens</p>
                  <p className="text-lg font-semibold">{usage.completion_tokens}</p>
                </div>
                <div className="p-3 border rounded-md">
                  <p className="text-xs text-gray-500">Totalt</p>
                  <p className="text-lg font-semibold">{usage.total_tokens}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Analysis Results */}
          <Card>
            <CardHeader>
              <CardTitle>Analysis Results</CardTitle>
              <CardDescription>AI analysis results for your query</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analysisResult.companies && analysisResult.companies.length > 0 ? (
                  analysisResult.companies.slice(0, 10).map((company, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{company.name}</h4>
                          {company.orgNr && (
                            <p className="text-xs text-gray-500">Org.nr: {company.orgNr}</p>
                          )}
                          {company.executiveSummary && (
                            <p className="text-sm text-gray-700 mt-2">{company.executiveSummary}</p>
                          )}
                        </div>
                        <div className="text-right space-y-1">
                          {typeof company.financialHealth === 'number' && (
                            <p className="text-sm font-semibold text-emerald-600">
                              Finansiell styrka: {company.financialHealth.toFixed(1)}/10
                            </p>
                          )}
                          {company.growthPotential && (
                            <Badge variant="outline">Tillväxt: {company.growthPotential}</Badge>
                          )}
                          {company.marketPosition && (
                            <Badge variant="secondary">Position: {company.marketPosition}</Badge>
                          )}
                          {company.recommendation && (
                            <Badge variant="default" className="bg-purple-600">
                              Råd: {company.recommendation}
                            </Badge>
                          )}
                          {typeof company.targetPrice === 'number' && (
                            <p className="text-xs text-gray-500">Målvärde: {company.targetPrice} TSEK</p>
                          )}
                          {typeof company.confidence === 'number' && (
                            <p className="text-xs text-gray-500">Säkerhet: {company.confidence}%</p>
                          )}
                        </div>
                      </div>
                      <div className="grid md:grid-cols-2 gap-3 mt-4 text-sm">
                        {company.strengths && company.strengths.length > 0 && (
                          <div>
                            <h5 className="font-semibold text-emerald-700 mb-1">Styrkor</h5>
                            <ul className="list-disc list-inside space-y-1 text-emerald-900">
                              {company.strengths.map((item, idx) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {company.weaknesses && company.weaknesses.length > 0 && (
                          <div>
                            <h5 className="font-semibold text-amber-700 mb-1">Svagheter</h5>
                            <ul className="list-disc list-inside space-y-1 text-amber-900">
                              {company.weaknesses.map((item, idx) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {company.opportunities && company.opportunities.length > 0 && (
                          <div>
                            <h5 className="font-semibold text-blue-700 mb-1">Möjligheter</h5>
                            <ul className="list-disc list-inside space-y-1 text-blue-900">
                              {company.opportunities.map((item, idx) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {company.risks && company.risks.length > 0 && (
                          <div>
                            <h5 className="font-semibold text-red-700 mb-1">Risker</h5>
                            <ul className="list-disc list-inside space-y-1 text-red-900">
                              {company.risks.map((item, idx) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    <p>No companies found matching your criteria.</p>
                    <p className="text-sm mt-1">
                      Try broadening your search parameters or select a different data source.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Raw Response */}
          {rawResponse && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <ShieldCheck className="h-5 w-5 text-slate-600" />
                  <span>Rått modelsvar (felsökning)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea value={rawResponse} readOnly rows={6} className="font-mono text-xs" />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

export default AIAnalysis
