import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft,
  CheckCircle,
  Info,
  Loader2,
  XCircle,
  SkipForward,
  Circle,
  ChevronDown,
  ChevronUp,
  FileText,
} from 'lucide-react'
import {
  getRunStatus,
  getDeepResearchHealth,
  restartRun,
  type AnalysisStatus,
  type RunStage,
} from '@/lib/services/deepResearchService'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { isAdminLinkVisible } from '@/lib/isAdmin'
import { useAuth } from '@/contexts/AuthContext'

const POLL_INTERVAL = 3000

const STAGE_LABELS: Record<string, string> = {
  identity: 'Company resolution',
  company_understanding: 'Company understanding',
  report_spec: 'Report spec',
  company_profile: 'Company profile',
  web_retrieval: 'Web intelligence',
  evidence_validation: 'Evidence validation',
  market_analysis: 'Market synthesis',
  competitor_discovery: 'Competitors',
  product_research: 'Product research',
  transaction_research: 'Transaction research',
  strategy: 'Strategy / value creation',
  value_creation: 'Strategy / value creation',
  financial_model: 'Financial grounding',
  assumption_registry: 'Assumption registry',
  valuation: 'Valuation',
  verification: 'Verification',
  report_generation: 'Final report',
}

const STAGE_STATUS_LABELS: Record<RunStage['status'], string> = {
  pending: 'Queued',
  running: 'Running',
  completed: 'Passed',
  failed: 'Blocked',
  skipped: 'Skipped',
}

const STATUS_ICON: Record<RunStage['status'], { icon: typeof CheckCircle; color: string }> = {
  completed: { icon: CheckCircle, color: 'text-green-500' },
  running: { icon: Loader2, color: 'text-amber-500' },
  pending: { icon: Circle, color: 'text-muted-foreground' },
  failed: { icon: XCircle, color: 'text-red-500' },
  skipped: { icon: SkipForward, color: 'text-muted-foreground' },
}

const RUN_STATUS_VARIANT: Record<AnalysisStatus['status'], string> = {
  pending: 'bg-muted text-muted-foreground',
  running: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  completed: 'bg-green-500/15 text-green-600 border-green-500/30',
  failed: 'bg-red-500/15 text-red-600 border-red-500/30',
  cancelled: 'bg-muted text-muted-foreground',
}

const SUGGESTED_ACTIONS: Record<string, string[]> = {
  identity: ['Add company website', 'Verify org nr'],
  company_profile: ['Broaden search', 'Lower strictness'],
  web_retrieval: ['Check Tavily key', 'Add company website'],
  evidence_validation: ['Add more sources', 'Lower evidence thresholds'],
  market_analysis: ['Broaden search', 'Lower strictness'],
  competitor_discovery: ['Broaden search', 'Lower strictness'],
  assumption_registry: ['Verify financial model', 'Add evidence for key metrics'],
  valuation: ['Verify assumption registry', 'Check financial model completeness'],
  default: ['Rerun with more context', 'Add company website'],
}

function humanStage(stage: string): string {
  return STAGE_LABELS[stage] ?? stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function getSuggestedActions(stage: string): string[] {
  return SUGGESTED_ACTIONS[stage] ?? SUGGESTED_ACTIONS.default
}

function StageRail({ stages, currentStage }: { stages: RunStage[]; currentStage: string }) {
  const displayStages = stages.filter((s) => s.stage !== 'value_creation')

  return (
    <nav className="space-y-0">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Pipeline
      </p>
      {displayStages.map((stage, idx) => {
        const cfg = STATUS_ICON[stage.status]
        const Icon = cfg.icon
        const isLast = idx === displayStages.length - 1
        const isActive = stage.stage === currentStage

        return (
          <div key={stage.stage} className="relative flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`mt-0.5 shrink-0 ${cfg.color} ${isActive ? 'ring-2 ring-offset-2 ring-primary/30 rounded-full' : ''}`}
              >
                <Icon className={`h-4 w-4 ${stage.status === 'running' ? 'animate-spin' : ''}`} />
              </div>
              {!isLast && <div className="w-px flex-1 bg-border min-h-[20px]" />}
            </div>
            <div className="pb-4 flex-1 min-w-0">
              <p
                className={`text-sm font-medium ${stage.status === 'skipped' ? 'line-through text-muted-foreground' : ''}`}
              >
                {humanStage(stage.stage)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {STAGE_STATUS_LABELS[stage.status]}
              </p>
            </div>
          </div>
        )
      })}
    </nav>
  )
}

function BlockedStageCard({
  stageName,
  reason,
  suggestedActions,
}: {
  stageName: string
  reason: string
  suggestedActions: string[]
}) {
  return (
    <Card className="border-red-500/30 bg-red-500/5">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <XCircle className="h-4 w-4 text-red-500" />
          {humanStage(stageName)} — Blocked
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">Reason</p>
          <p className="text-sm">{reason || 'Stage failed validation or encountered an error.'}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Suggested actions</p>
          <ul className="list-disc list-inside text-sm space-y-1">
            {suggestedActions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

function AdminDetails({ run, stages }: { run: AnalysisStatus; stages: RunStage[] }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-t pt-3 mt-3">
      <button
        type="button"
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Technical details
      </button>
      {open && (
        <div className="mt-3 space-y-4">
          <div className="space-y-1 text-xs text-muted-foreground font-mono">
            <div>Run ID: {run.run_id}</div>
            <div>Company ID: {run.company_id ?? '—'}</div>
            <div>Raw stage: {run.current_stage}</div>
          </div>
          {stages.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Stage timing:</p>
              {stages.map((s) => (
                <div key={s.stage} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono">{s.stage}</span>
                  <span>
                    {formatTimestamp(s.started_at)}
                    {s.finished_at && ` → ${formatTimestamp(s.finished_at)}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function RunStatusPage() {
  const { runId } = useParams<{ runId: string }>()
  const [run, setRun] = useState<AnalysisStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [redisUnhealthy, setRedisUnhealthy] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { user, userRole } = useAuth()
  const isAdmin = isAdminLinkVisible(userRole, user?.email, !!user)

  const fetchStatus = useCallback(async () => {
    if (!runId) return
    const data = await getRunStatus(runId)
    if (data) {
      setRun(data)
      setError(false)
    } else {
      setError(true)
    }
    setLoading(false)
  }, [runId])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    const shouldPoll = run && (run.status === 'pending' || run.status === 'running')
    if (shouldPoll) {
      timerRef.current = setInterval(fetchStatus, POLL_INTERVAL)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [run?.status, fetchStatus])

  useEffect(() => {
    if (run?.status !== 'pending') {
      setRedisUnhealthy(false)
      return
    }
    let cancelled = false
    getDeepResearchHealth().then((health) => {
      if (cancelled || !health) return
      const redis = health.dependencies.find((d) => d.name === 'redis')
      setRedisUnhealthy(redis ? !redis.healthy : false)
    })
    return () => {
      cancelled = true
    }
  }, [run?.status])

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)]">
        <div className="w-56 shrink-0 border-r p-4">
          <Skeleton className="h-6 w-24 mb-4" />
          <Skeleton className="h-32 w-full" />
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full mt-4" />
        </div>
      </div>
    )
  }

  if (error || !run) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <Link to="/deep-research">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Deep Research
          </Button>
        </Link>
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <XCircle className="mx-auto h-10 w-10 text-red-500 mb-3" />
            <p className="text-lg font-medium">Failed to load run</p>
            <p className="text-sm text-muted-foreground">
              The requested analysis run could not be found.
            </p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              If you&apos;re running locally, ensure the backend and Postgres are running and that
              migrations have been applied. The run may not exist in this database.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const companyName = run.company_name || 'Analysis'
  const isComplete = run.status === 'completed'
  const isFailed = run.status === 'failed'
  const failedStage = run.stages.find((s) => s.status === 'failed')
  const runError = run.error_message
  const stageError = failedStage?.error_message

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex flex-1 min-h-0">
        <aside className="w-56 shrink-0 border-r bg-muted/20 p-4 overflow-y-auto">
          <Link to="/deep-research" className="block mb-4">
            <Button variant="ghost" size="sm" className="w-full justify-start">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <StageRail stages={run.stages} currentStage={run.current_stage} />
        </aside>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold">{companyName}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {humanStage(run.current_stage)}
                </p>
              </div>
              <Badge className={RUN_STATUS_VARIANT[run.status]}>
                {run.status === 'running' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                {run.status === 'failed' ? 'Blocked' : run.status.charAt(0).toUpperCase() + run.status.slice(1)}
              </Badge>
            </div>

            {run.status === 'running' && (
              <Card>
                <CardContent className="py-4">
                  <p className="text-sm flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                    Running {humanStage(run.current_stage)}…
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    This may take several minutes. The page will update automatically.
                  </p>
                </CardContent>
              </Card>
            )}

            {run.status === 'pending' && redisUnhealthy && (
              <Alert variant="destructive">
                <AlertDescription>
                  Redis is unhealthy. The worker cannot process jobs until Redis is running.
                </AlertDescription>
              </Alert>
            )}

            {run.status === 'pending' && (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="py-4">
                  <p className="text-sm font-medium">Waiting for worker to process this run</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    The run is queued. Ensure the RQ worker is running. From the repo root:
                  </p>
                  <code className="block mt-2 p-2 rounded bg-muted text-xs font-mono">
                    ./scripts/start-deep-research-worker.sh
                  </code>
                  <p className="text-xs text-muted-foreground mt-2">
                    Redis must be running. Check with: <code className="rounded bg-muted px-1">redis-cli ping</code>
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    disabled={restarting}
                    onClick={async () => {
                      setRestarting(true)
                      try {
                        const result = await restartRun(run.run_id)
                        if (result.success) {
                          toast.success('Run re-queued — worker will pick it up shortly')
                          await fetchStatus()
                        } else {
                          toast.error(result.error)
                        }
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : 'Restart failed')
                      } finally {
                        setRestarting(false)
                      }
                    }}
                  >
                    {restarting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Restart run
                  </Button>
                </CardContent>
              </Card>
            )}

            {run.stages.some(
              (s) => s.stage === 'valuation' && s.status === 'skipped' && s.output?.reason === 'valuation_not_ready'
            ) && (
              <Alert className="border-amber-500/30 bg-amber-500/5">
                <Info className="h-4 w-4 text-amber-600" />
                <AlertDescription>
                  <p className="font-medium">Valuation skipped</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Insufficient evidence or assumptions to run deterministic valuation. The report will omit valuation
                    figures.
                  </p>
                  {(() => {
                    const valStage = run.stages.find(
                      (s) => s.stage === 'valuation' && s.output?.blocked_reasons?.length
                    )
                    const reasons = (valStage?.output as { blocked_reasons?: string[] })?.blocked_reasons
                    if (reasons?.length) {
                      return (
                        <ul className="mt-2 list-disc list-inside text-sm text-muted-foreground">
                          {reasons.map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                      )
                    }
                    return null
                  })()}
                </AlertDescription>
              </Alert>
            )}

            {isComplete && run.company_id && (
              <Link to={`/deep-research/company/${run.company_id}/report/latest?runId=${run.run_id}`}>
                <Button variant="primary" className="w-full">
                  <FileText className="h-4 w-4 mr-2" />
                  View Report
                </Button>
              </Link>
            )}

            {isFailed && (
              <>
                <BlockedStageCard
                  stageName={failedStage?.stage ?? run.current_stage}
                  reason={stageError || runError || ''}
                  suggestedActions={getSuggestedActions(failedStage?.stage ?? run.current_stage)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={restarting}
                  onClick={async () => {
                      setRestarting(true)
                      try {
                        const result = await restartRun(run.run_id)
                        if (result.success) {
                          toast.success('Run re-queued — worker will pick it up shortly')
                          await fetchStatus()
                        } else {
                          toast.error(result.error)
                        }
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : 'Restart failed')
                      } finally {
                        setRestarting(false)
                      }
                    }}
                >
                  {restarting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Restart run
                </Button>
              </>
            )}

            {isAdmin && <AdminDetails run={run} stages={run.stages} />}
          </div>
        </main>
      </div>
    </div>
  )
}
