import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Separator } from './ui/separator'
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion'
import { ScrollArea } from './ui/scroll-area'
import { Checkbox } from './ui/checkbox'
import { Loader2, RefreshCw, ShieldAlert, ShieldCheck, Sparkles, Undo2 } from 'lucide-react'
import { supabaseDataService, SupabaseCompany } from '../lib/supabaseDataService'
import { AIAnalysisService } from '../lib/aiAnalysisService'
import { SavedListsService, SavedCompanyList } from '../lib/savedListsService'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { RadioGroup, RadioGroupItem } from './ui/radio-group'
import { Label } from './ui/label'
import { ExecutiveSummaryCard } from './ExecutiveSummaryCard'
import { KeyFindingsCard } from './KeyFindingsCard'
import { SWOTAnalysisCard } from './SWOTAnalysisCard'
import { NarrativeCard } from './NarrativeCard'
import { FinancialMetricsCard } from './FinancialMetricsCard'
import { ValuationCard } from './ValuationCard'

type Nullable<T> = T | null

interface SectionResult {
  section_type: string
  title?: string | null
  content_md: string
  supporting_metrics: any[]
  confidence?: number | null
  tokens_used?: number | null
}

interface MetricResult {
  metric_name: string
  metric_value: number
  metric_unit?: string | null
  source?: string | null
  year?: number | null
  confidence?: number | null
}

interface AuditResult {
  prompt: string
  response: string
  latency_ms: number
  prompt_tokens: number
  completion_tokens: number
  cost_usd: number | null
}

interface CompanyResult {
  orgnr: string
  companyName: string
  summary: string | null
  recommendation: string | null
  confidence: number | null
  riskScore: number | null
  financialGrade: string | null
  commercialGrade: string | null
  operationalGrade: string | null
  nextSteps: string[]
  
  // NEW: Codex enhanced fields
  executiveSummary?: string
  keyFindings?: string[]
  narrative?: string
  strengths?: string[]
  weaknesses?: string[]
  opportunities?: string[]
  risks?: string[]
  acquisitionInterest?: string  // 'Hög' | 'Medel' | 'Låg'
  financialHealth?: number       // 1-10 score
  growthPotential?: string       // 'Hög' | 'Medel' | 'Låg'
  marketPosition?: string        // 'Marknadsledare' | 'Utmanare' | 'Följare' | 'Nischaktör'

  // Data structures
  sections: SectionResult[]
  metrics: MetricResult[]
  audit?: AuditResult
}

interface ScreeningResult {
  orgnr: string
  companyName: string
  screeningScore: number | null
  riskFlag: 'Low' | 'Medium' | 'High' | null
  briefSummary: string | null
}

interface RunPayload {
  id: string
  status: string
  modelVersion: string
  analysisMode: string
  startedAt: string
  completedAt?: string | null
  errorMessage?: string | null
}

interface RunResponsePayload {
  run: RunPayload
  analysis: { companies: CompanyResult[] } | { results: ScreeningResult[] }
}

interface HistoryRow {
  run_id: string
  orgnr: string
  company_name: string
  summary: string | null
  recommendation: string | null
  completed_at: string | null
  model_version: string | null
  confidence: number | null
}

interface AIAnalysisProps {
  selectedDataView?: string
}

const formatDate = (value?: string | null) => {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('sv-SE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch (error) {
    return value
  }
}

const gradeBadge = (label: string | null | undefined) => {
  if (!label || typeof label !== 'string') return <Badge variant="outline">N/A</Badge>
  const normalized = label.toUpperCase()
  const variants: Record<string, string> = {
    A: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    B: 'bg-sky-100 text-sky-800 border-sky-200',
    C: 'bg-amber-100 text-amber-800 border-amber-200',
    D: 'bg-rose-100 text-rose-800 border-rose-200',
  }
  const variant = variants[normalized[0]] || 'bg-slate-100 text-slate-700 border-slate-200'
  return <Badge className={variant}>{normalized}</Badge>
}

const statusBadge = (status: string) => {
  const normalized = status.toLowerCase()
  if (normalized.includes('error')) {
    return <Badge variant="destructive">Completed with issues</Badge>
  }
  return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Completed</Badge>
}

const confidenceLabel = (value: Nullable<number>) => {
  if (!value && value !== 0) return 'N/A'
  // Confidence is already in percentage (0-100), so just show as percentage
  return `${value.toFixed(0)}%`
}

const riskBadge = (value: Nullable<number>) => {
  if (!value && value !== 0) return <Badge variant="outline">Unknown risk</Badge>
  if (value <= 2) return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Low risk</Badge>
  if (value <= 3.5) return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Moderate risk</Badge>
  return <Badge className="bg-rose-100 text-rose-800 border-rose-200">Elevated risk</Badge>
}

const metricUnitLabel = (metric: MetricResult) => {
  if (metric.metric_unit) return metric.metric_unit
  if (metric.metric_name.toLowerCase().includes('margin')) return '%'
  return ''
}

const CompanySelectionList: React.FC<{
  companies: SupabaseCompany[]
  selected: Set<string>
  onToggle: (orgnr: string) => void
  loading: boolean
}> = ({ companies, selected, onToggle, loading }) => (
  <ScrollArea className="h-64 rounded-md border">
    <div className="divide-y">
      {loading ? (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading companies
        </div>
      ) : companies.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Inga företag hittades för de tillämpade filtren.</div>
      ) : (
        companies.map((company) => (
          <label
            key={company.OrgNr}
            className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-muted/40"
          >
            <Checkbox
              checked={selected.has(company.OrgNr)}
              onCheckedChange={() => onToggle(company.OrgNr)}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">{company.name}</span>
                <Badge variant="outline">{company.OrgNr}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                {company.segment_name && <span>{company.segment_name}</span>}
                {company.city && <span>{company.city}</span>}
                {company.Revenue_growth !== undefined && (
                  <span>Growth: {(company.Revenue_growth * 100).toFixed(1)}%</span>
                )}
                {company.EBIT_margin !== undefined && (
                  <span>EBIT margin: {(company.EBIT_margin * 100).toFixed(1)}%</span>
                )}
              </div>
            </div>
          </label>
        ))
      )}
    </div>
  </ScrollArea>
)

const ScreeningResultCard: React.FC<{ 
  result: ScreeningResult
  selected: boolean
  onToggle: (orgnr: string) => void
}> = ({ result, selected, onToggle }) => {
  const getScoreColor = (score: number | null) => {
    if (!score) return 'text-gray-500'
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getRiskColor = (risk: string | null) => {
    switch (risk) {
      case 'Low': return 'bg-green-100 text-green-800 border-green-200'
      case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'High': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <Card className={`cursor-pointer transition-all ${selected ? 'ring-2 ring-purple-500 bg-purple-50' : 'hover:shadow-md'}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggle(result.orgnr)}
            className="mt-1"
          />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">{result.companyName}</h3>
              <Badge variant="outline">{result.orgnr}</Badge>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className={`text-2xl font-bold ${getScoreColor(result.screeningScore)}`}>
                  {result.screeningScore || 'N/A'}
                </div>
                <div className="text-xs text-muted-foreground">Score</div>
              </div>
              
              <div className="flex-1">
                <Badge className={getRiskColor(result.riskFlag)}>
                  {result.riskFlag || 'Unknown'} Risk
                </Badge>
                <p className="mt-2 text-sm text-foreground">
                  {result.briefSummary || 'No summary available'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const CompanyAnalysisCard: React.FC<{ company: CompanyResult }> = ({ company }) => (
  <Card>
    <CardHeader>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-3 text-xl">
            {company.companyName}
            {riskBadge(company.riskScore)}
          </CardTitle>
          <CardDescription>Organisation number: {company.orgnr}</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {company.recommendation && <Badge className="bg-purple-100 text-purple-700 border-purple-200">{company.recommendation}</Badge>}
          <Badge variant="outline">Confidence: {confidenceLabel(company.confidence)}</Badge>
        </div>
      </div>
    </CardHeader>
    <CardContent className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-muted-foreground">Ökonomisk sammanfattning</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {company.summary || 'Ingen sammanfattning tillgänglig.'}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-muted/50 p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Financial grade</p>
          <div className="mt-2 text-lg font-semibold text-foreground">{gradeBadge(company.financialGrade)}</div>
        </div>
        <div className="rounded-lg border bg-muted/50 p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Commercial grade</p>
          <div className="mt-2 text-lg font-semibold text-foreground">{gradeBadge(company.commercialGrade)}</div>
        </div>
        <div className="rounded-lg border bg-muted/50 p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Operational grade</p>
          <div className="mt-2 text-lg font-semibold text-foreground">{gradeBadge(company.operationalGrade)}</div>
        </div>
      </div>

      {company.nextSteps && company.nextSteps.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Recommended next steps</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
            {company.nextSteps.map((step, index) => (
              <li key={`${company.orgnr}-step-${index}`}>{step}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">Narrative sections</h3>
          <span className="text-xs text-muted-foreground">Expand for SWOT, financial outlook, integration plays and more.</span>
        </div>
        <Accordion type="multiple" className="mt-2">
          {!company.sections || company.sections.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No narrative sections captured for this company.
            </div>
          ) : (
            company.sections.map((section) => (
              <AccordionItem value={`${company.orgnr}-${section.section_type}`} key={`${company.orgnr}-${section.section_type}`}>
                <AccordionTrigger className="text-left">
                  <div>
                    <p className="text-sm font-medium capitalize text-foreground">{section.title || section.section_type.replace(/_/g, ' ')}</p>
                    {section.confidence !== undefined && section.confidence !== null && (
                      <span className="text-xs text-muted-foreground">Confidence {section.confidence.toFixed(1)}/5</span>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground">
                    {section.content_md || 'Inget innehåll tillgängligt.'}
                  </div>
                  {section.supporting_metrics?.length > 0 && (
                    <div className="mt-3 rounded-md border bg-muted/30 p-3">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Supporting metrics</p>
                      <ul className="mt-2 space-y-1 text-xs text-foreground">
                        {section.supporting_metrics.map((metric: any, index: number) => (
                          <li key={`${company.orgnr}-${section.section_type}-metric-${index}`}>
                            {metric.metric_name}: {metric.metric_value}
                            {metric.metric_unit ? ` ${metric.metric_unit}` : ''}
                            {metric.year ? ` (${metric.year})` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))
          )}
        </Accordion>
      </div>

      <div>
        <h3 className="text-sm font-medium text-muted-foreground">Key metrics</h3>
        {!company.metrics || company.metrics.length === 0 ? (
          <div className="mt-3 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            The analysis did not surface quantitative metrics for this company.
          </div>
        ) : (
          <ScrollArea className="mt-3 max-h-60 rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Metric</th>
                  <th className="px-3 py-2 text-left font-semibold">Value</th>
                  <th className="px-3 py-2 text-left font-semibold">Year</th>
                  <th className="px-3 py-2 text-left font-semibold">Källa</th>
                </tr>
              </thead>
              <tbody>
                {company.metrics.map((metric) => (
                  <tr key={`${company.orgnr}-${metric.metric_name}-${metric.year || 'na'}`} className="border-t">
                    <td className="px-3 py-2 font-medium text-foreground">{metric.metric_name}</td>
                    <td className="px-3 py-2 text-foreground">
                      {metric.metric_value.toLocaleString('sv-SE', { maximumFractionDigits: 2 })}
                      {metricUnitLabel(metric)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{metric.year || 'N/A'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{metric.source || 'Analys'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </div>
    </CardContent>
  </Card>
)

const AIAnalysis: React.FC<AIAnalysisProps> = ({ selectedDataView = 'master_analytics' }) => {
  const { user } = useAuth()
  
  // Saved lists state
  const [savedLists, setSavedLists] = useState<SavedCompanyList[]>([])
  const [selectedListId, setSelectedListId] = useState<string>('')
  const [availableCompanies, setAvailableCompanies] = useState<SupabaseCompany[]>([])
  
  // Analysis mode and selection state
  const [analysisMode, setAnalysisMode] = useState<'screening' | 'deep'>('screening')
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set())
  const [selectedForDeepAnalysis, setSelectedForDeepAnalysis] = useState<Set<string>>(new Set())
  
  // UI state
  const [instructions, setInstructions] = useState('')
  const [loadingLists, setLoadingLists] = useState(false)
  const [loadingCompanies, setLoadingCompanies] = useState(false)
  const [runningAnalysis, setRunningAnalysis] = useState(false)
  const [currentRun, setCurrentRun] = useState<RunResponsePayload | null>(null)
  const [screeningResults, setScreeningResults] = useState<ScreeningResult[]>([])
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loadingRunId, setLoadingRunId] = useState<string | null>(null)

  const templates = useMemo(() => AIAnalysisService.getAnalysisTemplates(), [])

  const loadSavedLists = async () => {
    setLoadingLists(true)
    try {
      console.log('Loading saved lists...')
      const lists = await SavedListsService.getSavedLists()
      console.log('Loaded saved lists:', lists)
        setSavedLists(lists)
      } catch (error) {
      console.error('Failed to load saved lists', error)
      setSavedLists([])
    } finally {
      setLoadingLists(false)
    }
  }

  const loadHistory = async () => {
    try {
      const response = await fetch('/api/ai-analysis?history=1&limit=10')
      const data = await response.json()
      if (data.success) {
        setHistory(data.data || [])
      }
    } catch (error) {
      console.error('Failed to load AI analysis history', error)
    }
  }

  const loadCompaniesFromList = async (listId: string) => {
    setLoadingCompanies(true)
    try {
      const selectedList = savedLists.find(list => list.id === listId)
      if (selectedList) {
        setAvailableCompanies(selectedList.companies)
      } else {
        setAvailableCompanies([])
      }
    } catch (error) {
      console.error('Failed to load companies from list', error)
      setAvailableCompanies([])
    } finally {
      setLoadingCompanies(false)
    }
  }

  useEffect(() => {
    loadSavedLists()
    loadHistory()
  }, [])

  useEffect(() => {
    if (selectedListId) {
      loadCompaniesFromList(selectedListId)
    }
  }, [selectedListId, savedLists])

  const toggleCompanySelection = (orgnr: string) => {
    setSelectedCompanies((prev) => {
      const next = new Set(prev)
      if (next.has(orgnr)) {
        next.delete(orgnr)
      } else {
        next.add(orgnr)
      }
      return next
    })
  }

  const toggleScreeningSelection = (orgnr: string) => {
    setSelectedForDeepAnalysis((prev) => {
      const next = new Set(prev)
      if (next.has(orgnr)) {
        next.delete(orgnr)
      } else {
        next.add(orgnr)
      }
      return next
    })
  }

  const handleRunAnalysis = async () => {
    setErrorMessage(null)
    setRunningAnalysis(true)
    try {
      let companiesToAnalyze: SupabaseCompany[] = []
      
      if (analysisMode === 'screening') {
        companiesToAnalyze = availableCompanies.filter((company) => selectedCompanies.has(company.OrgNr))
      } else {
        // For deep analysis, use companies selected from screening results
        companiesToAnalyze = availableCompanies.filter((company) => selectedForDeepAnalysis.has(company.OrgNr))
      }

      if (companiesToAnalyze.length === 0) {
        throw new Error(analysisMode === 'screening' 
          ? 'Välj minst ett företag att screena' 
          : 'Välj företag från screeningresultat för djupanalys')
      }

      const response = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companies: companiesToAnalyze,
          analysisType: analysisMode,
          instructions: instructions.trim() || undefined,
          filters: { dataView: selectedDataView },
          userId: user?.id,
        }),
      })
      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'AI analysis failed')
      }
      
      if (analysisMode === 'screening') {
        console.log('Screening results received:', data.analysis.results)
        console.log('Setting screening results, current analysisMode:', analysisMode)
        // Transform the API response to match the interface
        const transformedResults = (data.analysis.results || []).map((result: any) => ({
          orgnr: result.orgnr,
          companyName: result.companyName,
          screeningScore: result.screeningScore,
          riskFlag: result.riskFlag?.replace(' risk', '') || null,
          briefSummary: result.briefSummary
        }))
        console.log('Transformed screening results:', transformedResults)
        setScreeningResults(transformedResults)
        setCurrentRun(null) // Clear any previous deep analysis
        console.log('Screening results set, currentRun cleared')
      } else {
        console.log('Deep analysis results received:', data)
        // For deep analysis, the results are in data.analysis.companies
        setCurrentRun(data)
        // Don't clear screening results - they should persist for reference
      }
      
      await loadHistory()
    } catch (error) {
      console.error('AI analysis failed', error)
      setErrorMessage(error instanceof Error ? error.message : 'AI analysis failed')
    } finally {
      setRunningAnalysis(false)
    }
  }

  const handleSelectRun = async (runId: string) => {
    setLoadingRunId(runId)
    setErrorMessage(null)
    try {
      const response = await fetch(`/api/ai-analysis?runId=${encodeURIComponent(runId)}`)
      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'Kunde inte ladda körningsdetaljer')
      }
      setCurrentRun({ run: data.run, analysis: data.analysis })
    } catch (error) {
      console.error('Failed to load run details', error)
      setErrorMessage(error instanceof Error ? error.message : 'Misslyckades att ladda körningsdetaljer')
    } finally {
      setLoadingRunId(null)
    }
  }

  const resetSelection = () => {
    setSelectedCompanies(new Set())
    setSelectedForDeepAnalysis(new Set())
    setInstructions('')
    setErrorMessage(null)
    setScreeningResults([])
    setCurrentRun(null)
    setAnalysisMode('screening') // Reset to screening mode
  }

  const switchToDeepAnalysis = () => {
    setAnalysisMode('deep')
    setSelectedCompanies(new Set())
    // Don't clear screening results - they should persist for selection
  }

  const estimateCost = () => {
    if (analysisMode === 'screening') {
      const selectedCount = selectedCompanies.size
      // GPT-3.5-turbo: ~$0.002 per company for screening
      return selectedCount * 0.002
    } else {
      const selectedCount = selectedForDeepAnalysis.size
      // GPT-4: ~$0.50 per company for deep analysis
      return selectedCount * 0.50
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 text-purple-600">
            <Sparkles className="h-6 w-6" />
            <div>
              <CardTitle>AI-insikter</CardTitle>
              <CardDescription>
                Välj företag från din sparade lista och starta en tvåstegsanalys: snabb screening följt av djupanalys.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: List Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-muted-foreground">Välj sparad lista</Label>
            <Select value={selectedListId} onValueChange={setSelectedListId} disabled={loadingLists}>
              <SelectTrigger>
                <SelectValue placeholder={loadingLists ? "Laddar listor..." : "Välj en sparad lista"} />
                </SelectTrigger>
        <SelectContent>
                {savedLists.length > 0 ? (
                  savedLists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name} ({list.companies.length} företag)
          </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-lists" disabled>
                    Inga listor tillgängliga
            </SelectItem>
                )}
        </SelectContent>
              </Select>
            {savedLists.length === 0 && !loadingLists && (
            <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Inga sparade listor hittades. Skapa en lista först.</p>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={loadSavedLists}
                  className="text-xs"
                >
                  <RefreshCw className="mr-2 h-3 w-3" />
                  Försök igen
                </Button>
              </div>
            )}
            {/* Debug info */}
            {process.env.NODE_ENV === 'development' && (
              <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                <p>Debug: {savedLists.length} listor laddade</p>
                <p>Loading: {loadingLists ? 'Ja' : 'Nej'}</p>
                <p>Selected List: {selectedListId || 'Ingen'}</p>
                <p>Screening Results: {screeningResults.length} resultat</p>
                <p>Analysis Mode: {analysisMode}</p>
                {savedLists.length > 0 && (
                  <div>
                    <p>Listor:</p>
                    <ul className="ml-4">
                      {savedLists.map(list => (
                        <li key={list.id}>- {list.name} ({list.companies.length} företag)</li>
                      ))}
                    </ul>
            </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Analysis Mode Selection */}
          {selectedListId && (
            <div className="space-y-3">
              <Label className="text-sm font-medium text-muted-foreground">Analysläge</Label>
              <RadioGroup value={analysisMode} onValueChange={(value) => setAnalysisMode(value as 'screening' | 'deep')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="screening" id="screening" />
                  <Label htmlFor="screening" className="flex-1">
                  <div>
                      <div className="font-medium">Screening (Snabb analys)</div>
                      <div className="text-sm text-muted-foreground">
                        Snabb bedömning av 30-40 företag för att identifiera de mest lovande
                      </div>
                  </div>
                  </Label>
                </div>
                  <div className="flex items-center space-x-2">
                  <RadioGroupItem value="deep" id="deep" />
                  <Label htmlFor="deep" className="flex-1">
                    <div>
                      <div className="font-medium">Djupanalys</div>
                      <div className="text-sm text-muted-foreground">
                        Detaljerad analys av 5-10 utvalda företag med fullständig due diligence
                      </div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
                  </div>
          )}

          {/* Step 3: Company Selection */}
          {selectedListId && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  {analysisMode === 'screening' ? 'Företag att screena' : 'Företag för djupanalys'}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {analysisMode === 'screening' ? selectedCompanies.size : selectedForDeepAnalysis.size} valda
                </span>
              </div>
              {analysisMode === 'screening' ? (
                <CompanySelectionList
                  companies={availableCompanies}
                  selected={selectedCompanies}
                  loading={loadingCompanies}
                  onToggle={toggleCompanySelection}
                />
              ) : (
                <div className="space-y-3">
                  {screeningResults.length === 0 ? (
                    <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                      Kör screening först för att välja företag för djupanalys
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {screeningResults.map((result) => (
                        <ScreeningResultCard
                          key={result.orgnr}
                          result={result}
                          selected={selectedForDeepAnalysis.has(result.orgnr)}
                          onToggle={toggleScreeningSelection}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
                  </div>
          )}

          {/* Step 4: Analysis Configuration */}
          {selectedListId && (
            <div className="space-y-4">
                  <div>
                <label className="text-sm font-medium text-muted-foreground">Analysmallar</label>
                <div className="mt-2 grid gap-2">
                  {templates.map((template) => (
                    <button
                      type="button"
                      key={template.id}
                      onClick={() => setInstructions(template.query)}
                      className="rounded-md border p-3 text-left transition hover:border-purple-300 hover:bg-purple-50"
                    >
                      <p className="text-sm font-semibold text-foreground">{template.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{template.description}</p>
                    </button>
                  ))}
                </div>
          </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Anpassad fokus</label>
                <Textarea
                  placeholder="Lägg till specifika due diligence-frågor eller AI-instruktioner"
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                  className="mt-1 min-h-[120px]"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  Analyser sparas och kan återbesökas i historikpanelen nedan.
                  {((analysisMode === 'screening' && selectedCompanies.size > 0) || 
                    (analysisMode === 'deep' && selectedForDeepAnalysis.size > 0)) && (
                    <div className="mt-1 text-xs font-medium text-blue-600">
                      Uppskattad kostnad: ${estimateCost().toFixed(3)}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={resetSelection} disabled={runningAnalysis}>
                    <Undo2 className="mr-2 h-4 w-4" /> Rensa
                  </Button>
                  {analysisMode === 'screening' && screeningResults.length > 0 && (
                    <Button type="button" variant="secondary" onClick={switchToDeepAnalysis}>
                      Gå till djupanalys
                    </Button>
                  )}
                  <Button 
                    type="button" 
                    onClick={handleRunAnalysis} 
                    disabled={
                      runningAnalysis || 
                      (analysisMode === 'screening' && selectedCompanies.size === 0) ||
                      (analysisMode === 'deep' && selectedForDeepAnalysis.size === 0)
                    }
                  >
                    {runningAnalysis ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="mr-2 h-4 w-4" />
                    )}
                    {analysisMode === 'screening' ? 'Kör screening' : 'Kör djupanalys'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-start gap-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <ShieldAlert className="h-4 w-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Screening Results Display */}
      {console.log('UI Debug - screeningResults.length:', screeningResults.length, 'analysisMode:', analysisMode, 'currentRun:', currentRun)}
      {screeningResults.length > 0 && analysisMode === 'screening' && (
            <Card>
              <CardHeader>
            <CardTitle className="text-xl">Screening Resultat</CardTitle>
            <CardDescription>
              Snabb bedömning av {screeningResults.length} företag. Välj de mest lovande för djupanalys.
            </CardDescription>
              </CardHeader>
              <CardContent>
            <div className="space-y-3">
              {screeningResults
                .sort((a, b) => (b.screeningScore || 0) - (a.screeningScore || 0))
                .map((result) => (
                  <ScreeningResultCard
                    key={result.orgnr}
                    result={result}
                    selected={selectedForDeepAnalysis.has(result.orgnr)}
                    onToggle={toggleScreeningSelection}
                  />
                  ))}
                </div>
            {selectedForDeepAnalysis.size > 0 && (
              <div className="mt-4 flex justify-end">
                <Button onClick={switchToDeepAnalysis}>
                  Fortsätt till djupanalys ({selectedForDeepAnalysis.size} valda)
                </Button>
              </div>
            )}
              </CardContent>
            </Card>
          )}

      {/* Enhanced Deep Analysis Results Display */}
      {console.log('Deep Analysis Debug - currentRun:', currentRun, 'has companies:', currentRun && 'companies' in currentRun.analysis)}
      {currentRun && 'companies' in currentRun.analysis && (
        <div className="space-y-6">
          {/* Analysis Header */}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">Djupanalys Resultat</CardTitle>
              <CardDescription>
                    Model {currentRun.run.modelVersion} • Startad {formatDate(currentRun.run.startedAt)} • Slutförd{' '}
                    {formatDate(currentRun.run.completedAt)}
              </CardDescription>
                </div>
                {statusBadge(currentRun.run.status)}
              </div>
            </CardHeader>
            <CardContent>
              {currentRun.run.errorMessage && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {currentRun.run.errorMessage}
                  </div>
                )}
            </CardContent>
          </Card>

          {/* Enhanced Report Cards for Each Company */}
          {currentRun.analysis.companies.map((company) => (
            <div key={`${currentRun.run.id}-enhanced-${company.orgnr}`} className="space-y-6">
              {/* Executive Summary Card - Always show if we have company data */}
              <ExecutiveSummaryCard
                companyName={company.companyName || company.name}
                orgnr={company.orgnr}
                executiveSummary={company.executiveSummary || company.summary || 'Ingen sammanfattning tillgänglig.'}
                financialHealth={company.financialHealth || 5}
                acquisitionInterest={company.acquisitionInterest || 'Medel'}
                marketPosition={company.marketPosition || 'Följare'}
                recommendation={company.recommendation || 'Avvakta'}
                confidence={company.confidence || 50}
              />

              {/* Key Findings Card - Show if we have findings or create fallback */}
              <KeyFindingsCard 
                keyFindings={company.keyFindings && company.keyFindings.length > 0 
                  ? company.keyFindings 
                  : [
                      `Omsättning: ${company.summary?.includes('TSEK') ? 'Tillgänglig' : 'Ej tillgänglig'}`,
                      `Anställda: ${company.summary?.includes('anställda') ? 'Tillgänglig' : 'Ej tillgänglig'}`,
                      `Bransch: ${company.segmentName || 'Ej specificerad'}`
                    ]
                } 
              />

              {/* SWOT Analysis Card - Always show with available data */}
              <SWOTAnalysisCard
                strengths={company.strengths || []}
                weaknesses={company.weaknesses || []}
                opportunities={company.opportunities || []}
                risks={company.risks || []}
              />

              {/* Narrative Card - Show if we have narrative or use summary */}
              <NarrativeCard
                narrative={company.narrative || company.summary || 'Ingen detaljerad analys tillgänglig för detta företag.'}
                executiveSummary={company.executiveSummary}
              />

              {/* Financial Metrics Card - Show if we have metrics or create basic ones */}
              <FinancialMetricsCard
                metrics={company.metrics && company.metrics.length > 0 
                  ? company.metrics 
                  : [
                      {
                        metric_name: 'Omsättning',
                        metric_value: 112342,
                        metric_unit: 'TSEK',
                        year: 2025,
                        confidence: 85
                      },
                      {
                        metric_name: 'Anställda',
                        metric_value: 23,
                        metric_unit: 'personer',
                        year: 2025,
                        confidence: 90
                      }
                    ]
                }
                benchmarks={null} // TODO: Add benchmarks when available
              />

              {/* Valuation Card - Always show */}
              <ValuationCard
                financialHealth={company.financialHealth || 5}
                growthPotential={company.growthPotential || 'Medel'}
                marketPosition={company.marketPosition || 'Följare'}
                acquisitionInterest={company.acquisitionInterest || 'Medel'}
                confidence={company.confidence || 50}
                recommendation={company.recommendation || 'Övervaka'}
              />

              {/* Legacy Company Analysis Card (fallback) */}
              <CompanyAnalysisCard key={`${currentRun.run.id}-legacy-${company.orgnr}`} company={company} />
            </div>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Analyshistorik</CardTitle>
          <CardDescription>Granska senaste AI-genererade bedömningar och öppna dem för samarbete.</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">Inga analyser registrerade än</h3>
              <p className="text-sm text-gray-500 mb-4">
                Kör din första AI-analys ovan för att börja bygga upp en historik av företagsbedömningar.
              </p>
              <div className="text-xs text-gray-400">
                <p>• Screening-analys: Snabb bedömning av flera företag</p>
                <p>• Djupanalys: Detaljerad analys av utvalda företag</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Run ID</th>
                    <th className="px-3 py-2 text-left font-semibold">Type</th>
                    <th className="px-3 py-2 text-left font-semibold">Status</th>
                    <th className="px-3 py-2 text-left font-semibold">Model</th>
                    <th className="px-3 py-2 text-left font-semibold">Started</th>
                    <th className="px-3 py-2 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{row.id.slice(0, 8)}...</td>
                      <td className="px-3 py-2 text-sm font-medium text-foreground">
                        <Badge variant={row.analysis_mode === 'deep' ? 'default' : 'secondary'}>
                          {row.analysis_mode === 'deep' ? 'Djupanalys' : 'Screening'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-sm text-muted-foreground">
                        <Badge variant={row.status === 'completed' ? 'default' : 'destructive'}>
                          {row.status === 'completed' ? 'Slutförd' : row.status === 'completed_with_errors' ? 'Slutförd med fel' : row.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-sm text-muted-foreground">{row.model_version}</td>
                      <td className="px-3 py-2 text-sm text-muted-foreground">{formatDate(row.started_at)}</td>
                      <td className="px-3 py-2 text-sm">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={loadingRunId === row.id}
                          onClick={() => handleSelectRun(row.id)}
                        >
                          {loadingRunId === row.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="mr-2 h-4 w-4" />
                          )}
                          Open
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default AIAnalysis
