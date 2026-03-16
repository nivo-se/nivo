import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Building2,
  Filter,
} from 'lucide-react'
import { listRuns, type AnalysisStatus } from '@/lib/services/deepResearchService'
import { isAdminLinkVisible } from '@/lib/isAdmin'
import { useAuth } from '@/contexts/AuthContext'

type PilotFilter = 'all' | 'degraded' | 'valuation_skipped' | 'blocked'

function matchesPilotFilter(run: AnalysisStatus, filter: PilotFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'degraded') return run.diagnostics?.report_degraded === true
  if (filter === 'valuation_skipped') return run.diagnostics?.valuation_skipped === true
  if (filter === 'blocked') return run.report_quality_status === 'blocked'
  return true
}

function computeReasonCodeCounts(runs: AnalysisStatus[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const run of runs) {
    const codes = run.diagnostics?.report_quality_reason_codes ?? []
    for (const code of codes) {
      counts[code] = (counts[code] ?? 0) + 1
    }
  }
  return counts
}

const STAGE_LABELS: Record<string, string> = {
  identity: 'Identity',
  market_research: 'Market Research',
  competitor_discovery: 'Competitor Discovery',
  financial_analysis: 'Financial Analysis',
  strategy_analysis: 'Strategy Analysis',
  report_generation: 'Report Ready',
  verification: 'Verification',
  pending: 'Queued',
}

const STATUS_CONFIG: Record<AnalysisStatus['status'], { label: string; className: string; icon: typeof CheckCircle }> = {
  pending: { label: 'Queued', className: 'bg-muted text-muted-foreground', icon: Clock },
  running: { label: 'Running', className: 'bg-amber-500/15 text-amber-600 border-amber-500/30', icon: Loader2 },
  completed: { label: 'Completed', className: 'bg-green-500/15 text-green-600 border-green-500/30', icon: CheckCircle },
  failed: { label: 'Failed', className: 'bg-red-500/15 text-red-600 border-red-500/30', icon: XCircle },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground', icon: XCircle },
}

function humanStage(stage: string): string {
  return STAGE_LABELS[stage] ?? stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function RunListPage() {
  const [runs, setRuns] = useState<AnalysisStatus[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedAdmin, setExpandedAdmin] = useState<string | null>(null)
  const [pilotFilter, setPilotFilter] = useState<PilotFilter>('all')
  const { user, userRole } = useAuth()
  const isAdmin = isAdminLinkVisible(userRole, user?.email, !!user)

  useEffect(() => {
    listRuns().then((data) => {
      setRuns(data ?? [])
      setLoading(false)
    })
  }, [])

  const filteredRuns = runs?.filter((r) => matchesPilotFilter(r, pilotFilter)) ?? []
  const reasonCodeCounts = computeReasonCodeCounts(runs ?? [])

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
      <h1 className="text-2xl font-semibold tracking-tight">Analysis Runs</h1>

      {isAdmin && runs && runs.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs font-medium text-muted-foreground">Filter:</span>
            {(['all', 'degraded', 'valuation_skipped', 'blocked'] as PilotFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setPilotFilter(f)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  pilotFilter === f
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {f === 'all' ? 'All' : f === 'valuation_skipped' ? 'Val. skipped' : f.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
          {Object.keys(reasonCodeCounts).length > 0 && (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium">Reason-code counts (recent):</span>{' '}
              {Object.entries(reasonCodeCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([code, n]) => `${code}: ${n}`)
                .join(', ')}
            </div>
          )}
        </div>
      )}

      {filteredRuns.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {runs && runs.length > 0 ? 'No runs match the filter.' : 'No analysis runs found.'}
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {filteredRuns.map((run) => {
          const cfg = STATUS_CONFIG[run.status]
          const Icon = cfg.icon
          const companyName = run.company_name || 'Unknown Company'
          const linkTarget = run.status === 'completed' && run.company_id
            ? `/deep-research/company/${run.company_id}/report/latest?runId=${run.run_id}`
            : `/deep-research/runs/${run.run_id}`

          return (
            <Card key={run.run_id} className="transition-colors hover:border-primary/40">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-4">
                  <Link to={linkTarget} className="flex items-center gap-2 min-w-0 group">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors truncate">
                      {companyName}
                    </CardTitle>
                  </Link>
                  <Badge className={cfg.className}>
                    <Icon className={`h-3 w-3 mr-1 ${run.status === 'running' ? 'animate-spin' : ''}`} />
                    {cfg.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {humanStage(run.current_stage)}
                  </span>

                  <div className="flex items-center gap-2">
                    {run.status === 'completed' && run.company_id && (
                      <Link to={`/deep-research/company/${run.company_id}/report/latest?runId=${run.run_id}`}>
                        <Button variant="outline" size="sm">View Report</Button>
                      </Link>
                    )}
                    {run.status !== 'completed' && (
                      <Link to={`/deep-research/runs/${run.run_id}`}>
                        <Button variant="ghost" size="sm">Details</Button>
                      </Link>
                    )}
                  </div>
                </div>

                {isAdmin && (
                  <div className="mt-3 pt-3 border-t">
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setExpandedAdmin(expandedAdmin === run.run_id ? null : run.run_id)}
                    >
                      {expandedAdmin === run.run_id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      Technical details
                    </button>
                    {expandedAdmin === run.run_id && (
                      <div className="mt-2 space-y-2 text-xs text-muted-foreground font-mono">
                        <div>Run ID: {run.run_id}</div>
                        <div>Company: {run.company_name ?? '—'}</div>
                        <div>Stage: {run.current_stage}</div>
                        {run.report_quality_status && (
                          <div>Quality: <span className="text-foreground">{run.report_quality_status}</span></div>
                        )}
                        {run.diagnostics?.valuation_skipped && (
                          <div>Valuation skipped: yes</div>
                        )}
                        {run.diagnostics?.report_degraded && (
                          <div>Degraded: yes</div>
                        )}
                        {(run.diagnostics?.report_degraded_reasons?.length ?? 0) > 0 && (
                          <div>Degraded reasons: {run.diagnostics!.report_degraded_reasons!.join('; ')}</div>
                        )}
                        {(run.diagnostics?.assumption_blocked_reasons?.length ?? 0) > 0 && (
                          <div>Assumption blockers: {run.diagnostics!.assumption_blocked_reasons!.join('; ')}</div>
                        )}
                        {(run.diagnostics?.evidence_accepted_count != null || run.diagnostics?.evidence_rejected_count != null) && (
                          <div>Evidence: accepted={run.diagnostics?.evidence_accepted_count ?? '—'}, rejected={run.diagnostics?.evidence_rejected_count ?? '—'}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
