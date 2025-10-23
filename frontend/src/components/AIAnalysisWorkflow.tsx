import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Checkbox } from './ui/checkbox'
import { Alert, AlertDescription } from './ui/alert'
import { 
  Brain, 
  Play, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  DollarSign,
  Users,
  Building2,
  Target,
  Zap,
  ArrowRight,
  Info
} from 'lucide-react'
import { SupabaseCompany } from '../lib/supabaseDataService'
import { SavedCompanyList } from '../lib/savedListsService'

interface AIAnalysisResult {
  orgNr: string
  name: string
  executiveSummary: string
  financialHealth: number
  growthPotential: string
  marketPosition: string
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]
  risks: string[]
  recommendation: string
  confidence: number
}

interface AIAnalysisWorkflowProps {
  savedLists: SavedCompanyList[]
  selectedList: SavedCompanyList | null
  onSelectList: (listId: string) => void
  onAnalysisComplete?: (results: AIAnalysisResult[]) => void
}

const AIAnalysisWorkflow: React.FC<AIAnalysisWorkflowProps> = ({
  savedLists,
  selectedList,
  onSelectList,
  onAnalysisComplete
}) => {
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set())
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [analysisResults, setAnalysisResults] = useState<AIAnalysisResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [estimatedCost, setEstimatedCost] = useState<number>(0)

  useEffect(() => {
    if (selectedList?.companies?.length) {
      setSelectedCompanies(new Set(selectedList.companies.map((company) => company.OrgNr)))
    } else {
      setSelectedCompanies(new Set())
    }
  }, [selectedList])

  // Calculate estimated cost when companies are selected
  useEffect(() => {
    if (selectedCompanies.size > 0) {
      // Rough estimate: $0.01-0.03 per company analysis
      const costPerCompany = 0.02
      setEstimatedCost(selectedCompanies.size * costPerCompany)
    } else {
      setEstimatedCost(0)
    }
  }, [selectedCompanies])

  const handleCompanySelection = (orgNr: string, checked: boolean) => {
    const newSelection = new Set(selectedCompanies)
    if (checked) {
      newSelection.add(orgNr)
    } else {
      newSelection.delete(orgNr)
    }
    setSelectedCompanies(newSelection)
  }

  const handleSelectAll = () => {
    if (!selectedList?.companies?.length) {
      setSelectedCompanies(new Set())
      return
    }

    if (selectedCompanies.size === selectedList.companies.length) {
      setSelectedCompanies(new Set())
    } else {
      const allOrgNrs = new Set(selectedList.companies.map((company) => company.OrgNr))
      setSelectedCompanies(allOrgNrs)
    }
  }

  const runAIAnalysis = async () => {
    if (selectedCompanies.size === 0) {
      setError('Välj minst ett företag att analysera')
      return
    }

    setIsAnalyzing(true)
    setAnalysisProgress(0)
    setError(null)

    try {
      const companiesToAnalyze = selectedList?.companies.filter(c => 
        selectedCompanies.has(c.OrgNr)
      ) || []

      setAnalysisProgress(20)

      const response = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companies: companiesToAnalyze,
          analysisType: 'comprehensive'
        }),
      })

      setAnalysisProgress(60)

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Analysis failed')
      }

      setAnalysisProgress(90)

      // Process the results
      const results = data.analysis?.companies || []
      setAnalysisResults(results)

      setAnalysisProgress(100)

      if (onAnalysisComplete) {
        onAnalysisComplete(results)
      }

      // Reset selection after successful analysis
      setSelectedCompanies(new Set())

    } catch (err) {
      console.error('AI Analysis Error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setIsAnalyzing(false)
      setTimeout(() => setAnalysisProgress(0), 2000)
    }
  }

  const formatCurrency = (value: number) => {
    return `${value.toLocaleString('sv-SE', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    })} TSEK`
  }

  const getRecommendationColor = (recommendation: string) => {
    if (recommendation.toLowerCase().includes('köp')) return 'text-green-600 bg-green-100'
    if (recommendation.toLowerCase().includes('håll')) return 'text-yellow-600 bg-yellow-100'
    if (recommendation.toLowerCase().includes('sälj')) return 'text-red-600 bg-red-100'
    return 'text-gray-600 bg-gray-100'
  }

  if (savedLists.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Brain className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Inga sparade listor hittades</h3>
          <p className="text-gray-600 mb-4">
            Skapa en sparad företagslista i "Företagssökning" för att köra AI-analys
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">AI-analys Workflow</h2>
          <p className="text-gray-600">Stegvis process för att välja företag, köra analys och spara insikter</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600 bg-[#E6E6E6] px-3 py-2 rounded-md">
          <Info className="h-4 w-4 text-[#596152]" />
          <span>Beräknad OpenAI-kostnad: ~${estimatedCost.toFixed(2)}</span>
        </div>
      </div>

      {/* List Selection */}
      <Card>
        <CardHeader>
          <CardTitle>1. Välj företagslista</CardTitle>
          <CardDescription>
            Välj en sparad lista att analysera
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedLists.map((list) => (
              <button
                key={list.id}
                type="button"
                className={`text-left p-4 border rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#596152] ${
                  selectedList?.id === list.id
                    ? 'border-[#596152] bg-[#E6E6E6]'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => onSelectList(list.id)}
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-[#2E2A2B]">{list.name}</h4>
                  <Badge variant="secondary">{list.companies.length} bolag</Badge>
                </div>
                {list.description && (
                  <p className="text-xs text-gray-500 mt-2">{list.description}</p>
                )}
                {list.filters?.name && (
                  <p className="mt-3 text-xs text-gray-500">Filter: {list.filters.name}</p>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Company Selection */}
      {selectedList && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>2. Välj företag att analysera</span>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={isAnalyzing}
                >
                  {selectedCompanies.size === selectedList.companies.length ? 'Avmarkera alla' : 'Markera alla'}
                </Button>
                <Badge variant="secondary">
                  {selectedCompanies.size} av {selectedList.companies.length} valda
                </Badge>
              </div>
            </CardTitle>
            <CardDescription>
              Välj de företag du vill köra AI-analys på
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              {selectedList.companies.map((company) => (
                <div
                  key={company.OrgNr}
                  className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50"
                >
                  <Checkbox
                    checked={selectedCompanies.has(company.OrgNr)}
                    onCheckedChange={(checked) => 
                      handleCompanySelection(company.OrgNr, checked as boolean)
                    }
                    disabled={isAnalyzing}
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{company.name}</h4>
                    <p className="text-sm text-gray-600">
                      {company.segment_name} • {formatCurrency(company.SDI || 0)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(company.Revenue_growth || 0) * 100}% tillväxt • {company.employees} anställda
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis Controls */}
      {selectedList && selectedCompanies.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>3. Kör AI-analys</CardTitle>
            <CardDescription>
              Starta omfattande AI-analys med OpenAI
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {isAnalyzing && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Analyserar företag...</span>
                  <span className="text-sm text-gray-600">{analysisProgress}%</span>
                </div>
                <Progress value={analysisProgress} className="w-full" />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                <div className="flex items-center space-x-4">
                  <span className="flex items-center">
                    <Brain className="h-4 w-4 mr-1" />
                    {selectedCompanies.size} företag valda
                  </span>
                  <span className="flex items-center">
                    <DollarSign className="h-4 w-4 mr-1" />
                    ~${estimatedCost.toFixed(2)} kostnad
                  </span>
                </div>
              </div>
              <Button
                onClick={runAIAnalysis}
                disabled={isAnalyzing || selectedCompanies.size === 0}
                className="flex items-center space-x-2"
              >
                {isAnalyzing ? (
                  <>
                    <Clock className="h-4 w-4 animate-spin" />
                    <span>Analyserar...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    <span>Starta AI-analys</span>
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis Results */}
      {analysisResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
              AI-analys Resultat
            </CardTitle>
            <CardDescription>
              {analysisResults.length} företag analyserade
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analysisResults.map((result, index) => (
                <div key={result.orgNr} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold">{result.name}</h4>
                      <p className="text-sm text-gray-600">{result.executiveSummary}</p>
                    </div>
                    <Badge className={getRecommendationColor(result.recommendation)}>
                      {result.recommendation}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div className="text-center p-2 bg-blue-50 rounded">
                      <div className="text-lg font-bold text-blue-600">
                        {result.financialHealth}/10
                      </div>
                      <div className="text-xs text-blue-800">Finansiell hälsa</div>
                    </div>
                    <div className="text-center p-2 bg-green-50 rounded">
                      <div className="text-lg font-bold text-green-600">
                        {result.growthPotential}
                      </div>
                      <div className="text-xs text-green-800">Tillväxtpotential</div>
                    </div>
                    <div className="text-center p-2 bg-purple-50 rounded">
                      <div className="text-lg font-bold text-purple-600">
                        {result.marketPosition}
                      </div>
                      <div className="text-xs text-purple-800">Marknadsposition</div>
                    </div>
                    <div className="text-center p-2 bg-orange-50 rounded">
                      <div className="text-lg font-bold text-orange-600">
                        {result.confidence}%
                      </div>
                      <div className="text-xs text-orange-800">Konfidens</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="font-medium text-green-700 mb-2">Styrkor</h5>
                      <ul className="text-sm space-y-1">
                        {result.strengths.map((strength, i) => (
                          <li key={i} className="flex items-start">
                            <CheckCircle className="h-3 w-3 text-green-500 mt-1 mr-2 flex-shrink-0" />
                            {strength}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-medium text-red-700 mb-2">Svagheter</h5>
                      <ul className="text-sm space-y-1">
                        {result.weaknesses.map((weakness, i) => (
                          <li key={i} className="flex items-start">
                            <AlertTriangle className="h-3 w-3 text-red-500 mt-1 mr-2 flex-shrink-0" />
                            {weakness}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default AIAnalysisWorkflow
