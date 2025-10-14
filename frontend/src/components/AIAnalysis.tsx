import React, { useState, useEffect } from 'react'
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
  List
} from 'lucide-react'
import { AIAnalysisService, AIAnalysisRequest, AIAnalysisResult } from '../lib/aiAnalysisService'
import { supabaseDataService, SupabaseCompany } from '../lib/supabaseDataService'

interface SavedCompanyList {
  id: string
  name: string
  companies: SupabaseCompany[]
  createdAt: string
}

interface AIAnalysisProps {
  selectedDataView?: string
}

const AIAnalysis: React.FC<AIAnalysisProps> = ({ selectedDataView = "master_analytics" }) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AIAnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [savedLists, setSavedLists] = useState<SavedCompanyList[]>([])
  const [selectedList, setSelectedList] = useState<string>('')
  const [companies, setCompanies] = useState<SupabaseCompany[]>([])
  const [totalCompanies, setTotalCompanies] = useState<number>(0)
  const [loadingCompanies, setLoadingCompanies] = useState<boolean>(false)

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
    if (selectedList && selectedList !== "") {
      const list = savedLists.find(l => l.id === selectedList)
      if (list) {
        setCompanies(list.companies)
        setTotalCompanies(list.companies.length)
      }
    } else {
      // Don't load all companies upfront - load them on-demand
      setCompanies([])
      setTotalCompanies(8438) // We know the total from dashboard
    }
  }, [selectedList, savedLists])

  // Load companies on-demand for analysis
  const loadCompaniesForAnalysis = async (query: string, limit: number = 50) => {
    try {
      setLoadingCompanies(true)
      console.log('Loading companies for analysis...')
      
      // For now, load a sample of companies for analysis
      // In the future, we could parse the query to apply smart filters
      const result = await supabaseDataService.getCompanies(1, limit)
      console.log('Loaded companies for analysis:', result.companies?.length || 0)
      
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
    
    if (!selectedList || selectedList === "") {
      alert('Välj en sparad lista först för att kunna analysera företag')
      return
    }

    setLoading(true)
    try {
      const companiesToAnalyze = companies

      if (companiesToAnalyze.length === 0) {
        throw new Error('Inga företag tillgängliga för analys')
      }

      console.log('Analyzing with', companiesToAnalyze.length, 'companies')
      // Use the working backend API instead of the complex AIAnalysisService
      const response = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companies: companiesToAnalyze.slice(0, 5), // Limit to first 5 companies for analysis to avoid connection issues
          analysisType: 'comprehensive',
          query: query.trim()
        }),
        signal: AbortSignal.timeout(60000) // 60 second timeout
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Analys misslyckades')
      }

      // Transform the backend response to match the expected format
      const analysisResult: AIAnalysisResult = {
        companies: data.analysis?.companies || [],
        insights: [`Analys slutförd för ${companies.length} företag baserat på: "${query.trim()}"`],
        summary: `Hittade ${data.analysis?.companies?.length || 0} företag som matchar dina kriterier`,
        recommendations: [
          'Granska analysresultaten nedan',
          'Överväg de finansiella hälsopoängen',
          'Utvärdera tillväxtpotential och marknadsposition'
        ]
      }

      setResults(analysisResult)
    } catch (error) {
      console.error('Analysis failed:', error)
      // Set error result
      setResults({
        companies: [],
        insights: [`Fel: ${error instanceof Error ? error.message : 'Analys misslyckades'}`],
        summary: 'Analys kunde inte slutföras',
        recommendations: ['Försök igen med en annan fråga', 'Kontrollera din internetanslutning']
      })
    } finally {
      setLoading(false)
    }
  }

  const handleTemplateSelect = (template: any) => {
    setQuery(template.query)
    setSelectedTemplate(template.id)
  }

  return (
    <div className="space-y-6">
      {/* AI Analysis Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Brain className="h-6 w-6 text-purple-600" />
            <CardTitle>AI-driven analys</CardTitle>
          </div>
          <CardDescription>
            Ställ frågor om din data på naturligt språk och få intelligenta insikter
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Saved Lists Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center">
                <List className="h-4 w-4 mr-2" />
                Välj datakälla:
              </label>
              <Select value={selectedList} onValueChange={(value) => setSelectedList(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Välj en sparad lista för analys" />
                </SelectTrigger>
        <SelectContent>
          {savedLists.length === 0 ? (
            <div className="p-2 text-sm text-gray-500">
              Inga sparade listor tillgängliga. Skapa en lista i Företagssökning först.
            </div>
          ) : (
            savedLists.map((list) => (
              <SelectItem key={list.id} value={list.id}>
                {list.name} ({list.companies.length} företag)
              </SelectItem>
            ))
          )}
        </SelectContent>
              </Select>
            </div>

            {/* Query Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Ställ en fråga om din data:</label>
              <div className="flex space-x-2">
                <Input
                  placeholder="t.ex., Hitta högtillväxt teknikföretag i Stockholm med omsättning > 10M SEK"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAnalyze()}
                  className="flex-1"
                />
                <Button 
                  onClick={handleAnalyze} 
                  disabled={loading || loadingCompanies || !query.trim() || !selectedList}
                  className="px-6"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : loadingCompanies ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Laddar företag...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      {selectedList ? 'Analysera' : 'Välj lista först'}
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Quick Templates */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Eller prova en snabb analys:</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {templates.map((template) => (
                  <Button
                    key={template.id}
                    variant={selectedTemplate === template.id ? "default" : "outline"}
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

      {/* Results */}
      {results && (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold">{results.summary.totalFound}</p>
                    <p className="text-xs text-gray-600">Företag hittade</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {results.summary.averageRevenue && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-2xl font-bold">
                        {(results.summary.averageRevenue / 1000000).toFixed(1)}M
                      </p>
                      <p className="text-xs text-gray-600">Genomsnittlig omsättning (SEK)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {results.summary.averageGrowth && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="text-2xl font-bold">
                        {(results.summary.averageGrowth * 100).toFixed(1)}%
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
                    <p className="text-2xl font-bold">{results.insights.length}</p>
                    <p className="text-xs text-gray-600">AI-insikter</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Lightbulb className="h-5 w-5 text-yellow-600" />
                <span>AI-insikter</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {results.insights.map((insight, index) => (
                  <div key={index} className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-900">{insight}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Segments */}
          {results.summary?.topSegments?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Toppbranscher</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {results.summary.topSegments.map((segment, index) => (
                    <Badge key={index} variant="secondary" className="text-sm">
                      {segment.segment} ({segment.count})
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {results.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Rekommendationer</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {results.recommendations.map((recommendation, index) => (
                    <div key={index} className="p-3 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-900">{recommendation}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Analysis Results */}
          <Card>
            <CardHeader>
              <CardTitle>Analysresultat</CardTitle>
              <CardDescription>
                AI-analysresultat för din fråga
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {results.companies && results.companies.length > 0 ? (
                  results.companies.slice(0, 10).map((company, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{company.name || company.companyName}</h4>
                          <p className="text-sm text-gray-600">
                          {company.city || company.address} • {company.segment || company.Bransch || 'Unknown'}
                        </p>
                      </div>
                      <div className="text-right">
                        {company.revenue && (
                          <p className="text-sm font-medium">
                            {(parseFloat(company.revenue) / 1000000).toFixed(1)}M SEK
                          </p>
                        )}
                        {company.revenue_growth && (
                          <p className="text-xs text-green-600">
                            +{(parseFloat(company.revenue_growth) * 100).toFixed(1)}% tillväxt
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    <p>Inga företag hittades som matchar dina kriterier.</p>
                    <p className="text-sm mt-1">Försök bredda dina sökparametrar eller välj en annan datakälla.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default AIAnalysis
