import React, { useEffect, useMemo, useState } from 'react'
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
  sections: SectionResult[]
  metrics: MetricResult[]
}

interface RunPayload {
  id: string
  status: string
  modelVersion: string
  startedAt: string
  completedAt?: string | null
  errorMessage?: string | null
}

interface RunResponsePayload {
  run: RunPayload
  analysis: { companies: CompanyResult[] }
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

const gradeBadge = (label: string | null) => {
  if (!label) return <Badge variant="outline">N/A</Badge>
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
  return `${value.toFixed(1)} / 5`
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

      {company.nextSteps.length > 0 && (
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
          {company.sections.length === 0 ? (
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
        {company.metrics.length === 0 ? (
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
  const [availableCompanies, setAvailableCompanies] = useState<SupabaseCompany[]>([])
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [instructions, setInstructions] = useState('')
  const [loadingCompanies, setLoadingCompanies] = useState(false)
  const [runningAnalysis, setRunningAnalysis] = useState(false)
  const [currentRun, setCurrentRun] = useState<RunResponsePayload | null>(null)
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loadingRunId, setLoadingRunId] = useState<string | null>(null)

  const templates = useMemo(() => AIAnalysisService.getAnalysisTemplates(), [])

  const loadHistory = async () => {
    try {
      const response = await fetch('/api/ai-analysis?history=1&limit=10')
      const data = await response.json()
      if (data.success) {
        setHistory(data.history || [])
      }
    } catch (error) {
      console.error('Failed to load AI analysis history', error)
    }
  }

  const loadCompanies = async (term?: string) => {
    setLoadingCompanies(true)
    try {
      const filters = term?.trim()
        ? {
            name: term.trim(),
          }
        : {}
      const result = await supabaseDataService.getCompanies(1, 50, filters)
      setAvailableCompanies(result.companies || [])
    } catch (error) {
      console.error('Failed to load companies', error)
      setAvailableCompanies([])
    } finally {
      setLoadingCompanies(false)
    }
  }

  useEffect(() => {
    loadCompanies()
    loadHistory()
  }, [])

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

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await loadCompanies(searchTerm)
  }

  const handleRunAnalysis = async () => {
    setErrorMessage(null)
    setRunningAnalysis(true)
    try {
      const selected = availableCompanies.filter((company) => selectedCompanies.has(company.OrgNr))
      if (selected.length === 0) {
        throw new Error('Välj minst ett företag att analysera')
      }
      const response = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companies: selected,
          analysisType: 'comprehensive',
          instructions: instructions.trim() || undefined,
          filters: { dataView: selectedDataView },
        }),
      })
      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'AI analysis failed')
      }
      setCurrentRun(data)
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
    setInstructions('')
    setErrorMessage(null)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 text-purple-600">
            <Sparkles className="h-6 w-6" />
            <div>
              <CardTitle>AI Deal Room</CardTitle>
              <CardDescription>
                Select shortlisted companies and trigger a full commercial, financial and integration analysis powered by GPT.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSearch} className="flex flex-col gap-3 md:flex-row">
            <div className="flex-1">
              <label className="text-sm font-medium text-muted-foreground">Sök företag</label>
              <Input
                placeholder="Filtrera på namn, stad eller segment"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" disabled={loadingCompanies}>
                {loadingCompanies && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Search
              </Button>
              <Button type="button" variant="outline" onClick={() => loadCompanies()} disabled={loadingCompanies}>
                <RefreshCw className="mr-2 h-4 w-4" /> Reset
              </Button>
            </div>
          </form>

          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground">Tillgängliga företag</h3>
                <span className="text-xs text-muted-foreground">{selectedCompanies.size} valda</span>
              </div>
              <CompanySelectionList
                companies={availableCompanies}
                selected={selectedCompanies}
                loading={loadingCompanies}
                onToggle={toggleCompanySelection}
              />
            </div>

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
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={resetSelection} disabled={runningAnalysis}>
                    <Undo2 className="mr-2 h-4 w-4" /> Rensa
                  </Button>
                  <Button type="button" onClick={handleRunAnalysis} disabled={runningAnalysis || selectedCompanies.size === 0}>
                    {runningAnalysis ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Kör analys
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="flex items-start gap-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <ShieldAlert className="h-4 w-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {currentRun && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">Analyskörning sammanfattning</CardTitle>
                  <CardDescription>
                    Model {currentRun.run.modelVersion} • Started {formatDate(currentRun.run.startedAt)} • Completed{' '}
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
              <Separator className="my-4" />
              <div className="grid gap-4 md:grid-cols-2">
                {currentRun.analysis.companies.map((company) => (
                  <div key={`${currentRun.run.id}-${company.orgnr}`} className="rounded-lg border bg-muted/40 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">{company.companyName}</span>
                      {riskBadge(company.riskScore)}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">Recommendation: {company.recommendation || '—'}</p>
                    <p className="text-xs text-muted-foreground">Confidence: {confidenceLabel(company.confidence)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {currentRun.analysis.companies.map((company) => (
              <CompanyAnalysisCard key={`${currentRun.run.id}-detail-${company.orgnr}`} company={company} />
            ))}
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Analyshistorik</CardTitle>
          <CardDescription>Granska senaste AI-genererade bedömningar och öppna dem för samarbete.</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No analyses have been recorded yet. Run your first batch above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Run ID</th>
                    <th className="px-3 py-2 text-left font-semibold">Company</th>
                    <th className="px-3 py-2 text-left font-semibold">Recommendation</th>
                    <th className="px-3 py-2 text-left font-semibold">Confidence</th>
                    <th className="px-3 py-2 text-left font-semibold">Completed</th>
                    <th className="px-3 py-2 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={`${row.run_id}-${row.orgnr}`} className="border-t">
                      <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{row.run_id}</td>
                      <td className="px-3 py-2 text-sm font-medium text-foreground">{row.company_name}</td>
                      <td className="px-3 py-2 text-sm text-muted-foreground">{row.recommendation || '—'}</td>
                      <td className="px-3 py-2 text-sm text-muted-foreground">{confidenceLabel(row.confidence)}</td>
                      <td className="px-3 py-2 text-sm text-muted-foreground">{formatDate(row.completed_at)}</td>
                      <td className="px-3 py-2 text-sm">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={loadingRunId === row.run_id}
                          onClick={() => handleSelectRun(row.run_id)}
                        >
                          {loadingRunId === row.run_id ? (
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

