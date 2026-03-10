import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  Building2,
  Plus,
  FileText,
  ArrowRight,
} from 'lucide-react'
import {
  listRuns,
  listCompaniesWithReports,
  type AnalysisStatus,
  type CompanyWithReport,
  type ResearchRunSummary,
} from '@/lib/services/deepResearchService'
import { NewReportWizard } from './NewReportWizard'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Not started',
  running: 'Running',
  completed: 'Complete',
  failed: 'Blocked',
  cancelled: 'Cancelled',
}

const STATUS_CONFIG: Record<
  AnalysisStatus['status'],
  { label: string; className: string; icon: typeof CheckCircle }
> = {
  pending: { label: 'Not started', className: 'bg-muted text-muted-foreground', icon: Clock },
  running: {
    label: 'Running',
    className: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
    icon: Loader2,
  },
  completed: {
    label: 'Complete',
    className: 'bg-green-500/15 text-green-600 border-green-500/30',
    icon: CheckCircle,
  },
  failed: { label: 'Blocked', className: 'bg-red-500/15 text-red-600 border-red-500/30', icon: XCircle },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground', icon: XCircle },
}

const STAGE_LABELS: Record<string, string> = {
  identity: 'Company resolution',
  company_profile: 'Company understanding',
  web_retrieval: 'Web intelligence',
  market_analysis: 'Market synthesis',
  competitor_discovery: 'Competitors',
  strategy: 'Strategy / value creation',
  value_creation: 'Strategy / value creation',
  financial_model: 'Financial grounding',
  valuation: 'Valuation',
  verification: 'Verification',
  report_generation: 'Final report',
}

function humanStage(stage: string): string {
  return STAGE_LABELS[stage] ?? stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDate(ts: string | null): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function buildMergedList(
  runs: AnalysisStatus[] | null,
  companies: CompanyWithReport[] | null
): ResearchRunSummary[] {
  const items: ResearchRunSummary[] = []
  const companyIds = new Set<string>()

  if (runs) {
    for (const run of runs) {
      items.push({
        run_id: run.run_id,
        company_id: run.company_id,
        company_name: run.company_name,
        orgnr: run.orgnr ?? undefined,
        created_at: run.created_at ?? null,
        status: run.status,
        current_stage: run.current_stage,
      })
      if (run.company_id) companyIds.add(run.company_id)
    }
  }

  if (companies) {
    for (const c of companies) {
      if (companyIds.has(c.company_id)) continue
      items.push({
        run_id: '',
        company_id: c.company_id,
        company_name: c.company_name,
        created_at: c.updated_at,
        status: 'completed',
        current_stage: 'report_generation',
      })
    }
  }

  items.sort((a, b) => {
    const da = a.created_at ? new Date(a.created_at).getTime() : 0
    const db = b.created_at ? new Date(b.created_at).getTime() : 0
    return db - da
  })

  return items
}

export default function DeepResearchHomePage() {
  const [runs, setRuns] = useState<AnalysisStatus[] | null>(null)
  const [companies, setCompanies] = useState<CompanyWithReport[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)

  useEffect(() => {
    Promise.all([listRuns(), listCompaniesWithReports()]).then(([runsData, companiesData]) => {
      setRuns(runsData ?? [])
      setCompanies(companiesData ?? [])
      setLoading(false)
    })
  }, [])

  const merged = useMemo(() => buildMergedList(runs, companies), [runs, companies])

  const filtered = useMemo(() => {
    let list = merged
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (item) =>
          item.company_name?.toLowerCase().includes(q) ||
          item.orgnr?.toLowerCase().includes(q)
      )
    }
    if (statusFilter) {
      list = list.filter((item) => item.status === statusFilter)
    }
    return list
  }, [merged, search, statusFilter])

  const statusOptions = [
    { value: null, label: 'All' },
    { value: 'pending', label: 'Not started' },
    { value: 'running', label: 'Running' },
    { value: 'completed', label: 'Complete' },
    { value: 'failed', label: 'Blocked' },
  ]

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <Skeleton className="h-8 w-56" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deep Research</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Evidence-first research and investment analysis. Launch reports, monitor progress, and access completed analysis.
          </p>
        </div>
        <Button variant="primary" onClick={() => setWizardOpen(true)}>
          <Plus className="h-4 w-4" />
          New report
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search by company name or org nr…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((opt) => (
            <button
              key={opt.value ?? 'all'}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                statusFilter === opt.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {merged.length === 0
              ? 'No reports or runs yet. Start an analysis run to generate a report.'
              : 'No matching reports or runs.'}
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {filtered.map((item) => {
          const cfg = STATUS_CONFIG[item.status]
          const Icon = cfg.icon
          const companyName = item.company_name || 'Unknown Company'
          const hasRun = !!item.run_id
          const linkTarget =
            item.status === 'completed' && item.company_id
              ? `/deep-research/company/${item.company_id}/report/latest${hasRun ? `?runId=${item.run_id}` : ''}`
              : hasRun
                ? `/deep-research/runs/${item.run_id}`
                : `/deep-research/company/${item.company_id}/report/latest`

          return (
            <Card key={hasRun ? item.run_id : item.company_id!} className="transition-colors hover:border-primary/40">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-4">
                  <Link to={linkTarget} className="flex items-center gap-2 min-w-0 group">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors truncate">
                      {companyName}
                    </CardTitle>
                  </Link>
                  <Badge className={cfg.className}>
                    <Icon className={`h-3 w-3 mr-1 ${item.status === 'running' ? 'animate-spin' : ''}`} />
                    {cfg.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {item.orgnr && <span>{item.orgnr}</span>}
                    <span>{formatDate(item.created_at)}</span>
                    <span>{humanStage(item.current_stage)}</span>
                  </div>
                  <Link to={linkTarget}>
                    <Button variant="outline" size="sm">
                      {item.status === 'completed' ? (
                        <>
                          <FileText className="h-3.5 w-3.5 mr-1" />
                          Open report
                        </>
                      ) : (
                        <>
                          <ArrowRight className="h-3.5 w-3.5 mr-1" />
                          Details
                        </>
                      )}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <NewReportWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onSuccess={() => setWizardOpen(false)} />
    </div>
  )
}
