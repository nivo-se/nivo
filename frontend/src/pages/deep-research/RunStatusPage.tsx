import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft,
  CheckCircle,
  Copy,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
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

/** ChatGPT-style activity messages shown when a stage is running */
const STAGE_ACTIVITY: Record<string, string> = {
  identity: 'Resolving company identity…',
  company_understanding: 'Understanding the company…',
  report_spec: 'Building report specification…',
  company_profile: 'Building company profile…',
  web_retrieval: 'Searching the web for intelligence…',
  evidence_validation: 'Validating evidence…',
  market_analysis: 'Synthesizing market analysis…',
  competitor_discovery: 'Discovering competitors…',
  product_research: 'Researching products…',
  transaction_research: 'Researching transactions…',
  strategy: 'Analyzing strategy and value creation…',
  value_creation: 'Analyzing value creation…',
  financial_model: 'Building financial model…',
  assumption_registry: 'Building assumption registry…',
  valuation: 'Running valuation…',
  verification: 'Verifying analysis…',
  report_generation: 'Generating final report…',
}

const STAGE_STATUS_LABELS: Record<RunStage['status'], string> = {
  pending: 'Queued',
  running: 'Running',
  completed: 'Passed',
  failed: 'Blocked',
  skipped: 'Skipped',
}

const STATUS_ICON: Record<RunStage['status'], { icon: typeof CheckCircle; color: string }> = {
  completed: { icon: CheckCircle, color: 'text-profile-accent' },
  running: { icon: Loader2, color: 'text-profile-accent-secondary' },
  pending: { icon: Circle, color: 'text-profile-fg-muted' },
  failed: { icon: XCircle, color: 'text-red-500' },
  skipped: { icon: SkipForward, color: 'text-profile-fg-muted' },
}

const RUN_STATUS_VARIANT: Record<AnalysisStatus['status'], string> = {
  pending: 'bg-profile-bg-subtle text-profile-fg-muted border-profile-divider',
  running: 'bg-profile-accent-muted/80 text-profile-accent-secondary border-profile-sage-muted',
  completed: 'bg-profile-sage-muted text-profile-accent border-profile-divider',
  failed: 'bg-red-500/10 text-red-600 border-red-500/20',
  cancelled: 'bg-profile-bg-subtle text-profile-fg-muted border-profile-divider',
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

function formatElapsed(ms: number): string {
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`
  const m = Math.floor(ms / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

function formatSecondsAgo(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 5) return 'Just now'
  if (s < 60) return `${s}s ago`
  return `${Math.floor(s / 60)}m ago`
}

function ResearchStatusBanner({
  run,
  lastFetchedAt,
}: {
  run: AnalysisStatus
  lastFetchedAt: number | null
}) {
  const isRunning = run.status === 'running'
  const isPending = run.status === 'pending'
  const displayStages = run.stages.filter((s) => s.stage !== 'value_creation')
  const completedCount = displayStages.filter((s) => s.status === 'completed' || s.status === 'skipped').length
  const totalCount = displayStages.length
  const stepLabel =
    isRunning && totalCount > 0
      ? `Step ${completedCount + 1} of ${totalCount}`
      : isPending
        ? 'Queued — will start when worker picks it up'
        : null

  const runningStage = run.stages.find((s) => s.status === 'running')
  const startedAt = runningStage?.started_at ?? run.created_at
  const elapsedMs = startedAt ? Date.now() - new Date(startedAt).getTime() : 0

  const activityMsg =
    isRunning && run.current_stage
      ? STAGE_ACTIVITY[run.current_stage] ?? `${humanStage(run.current_stage)}…`
      : isPending
        ? 'Waiting for worker to pick up this run…'
        : null

  const lastUpdatedMsg =
    lastFetchedAt !== null ? formatSecondsAgo(Date.now() - lastFetchedAt) : null

  if (!activityMsg && !isPending) return null

  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        isRunning
          ? 'border-profile-accent/40 bg-profile-accent-muted/30'
          : 'border-profile-sage-muted bg-profile-accent-muted/20'
      }`}
    >
      <div className="flex items-center gap-3">
        {isRunning && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-profile-accent-secondary opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-profile-accent-secondary" />
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-profile-fg">{activityMsg}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-1 text-xs text-profile-fg-muted">
            {stepLabel && <span>{stepLabel}</span>}
            {isRunning && elapsedMs > 0 && (
              <span>Elapsed: {formatElapsed(elapsedMs)}</span>
            )}
            {lastUpdatedMsg && (
              <span className={isRunning ? 'text-profile-accent-secondary' : ''}>
                Updated {lastUpdatedMsg}
              </span>
            )}
          </div>
        </div>
        {isRunning && (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-profile-accent-secondary" />
        )}
      </div>
      {isRunning && totalCount > 0 && (
        <div className="mt-2 h-1 w-full rounded-full bg-profile-bg-subtle overflow-hidden">
          <div
            className="h-full bg-profile-accent-secondary transition-all duration-500 ease-out"
            style={{
              width: `${Math.min(100, (completedCount / totalCount) * 100)}%`,
            }}
          />
        </div>
      )}
    </div>
  )
}

function StageRail({ stages, currentStage }: { stages: RunStage[]; currentStage: string }) {
  const displayStages = stages.filter((s) => s.stage !== 'value_creation')

  return (
    <nav className="space-y-0">
      <p className="text-xs font-semibold uppercase tracking-wider text-profile-fg-muted mb-3">
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
                className={`mt-0.5 shrink-0 ${cfg.color} ${isActive ? 'ring-2 ring-offset-2 ring-profile-accent/30 rounded-full' : ''}`}
              >
                <Icon className={`h-4 w-4 ${stage.status === 'running' ? 'animate-spin' : ''}`} />
              </div>
              {!isLast && <div className="w-px flex-1 bg-profile-divider min-h-[20px]" />}
            </div>
            <div className="pb-4 flex-1 min-w-0">
              <p
                className={`text-sm font-medium ${stage.status === 'skipped' ? 'line-through text-profile-fg-muted' : ''}`}
              >
                {humanStage(stage.stage)}
              </p>
              <p className="text-xs text-profile-fg-muted mt-0.5">
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
  suggestedAction,
  runId,
  onRestartWithWebsite,
}: {
  stageName: string
  reason: string
  suggestedActions: string[]
  suggestedAction?: string | null
  onRestartWithWebsite?: (website: string) => Promise<void>
}) {
  const [showWebsiteInput, setShowWebsiteInput] = useState(false)
  const [websiteInput, setWebsiteInput] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleAddWebsite = async () => {
    let url = websiteInput.trim()
    if (!url) return
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`
    }
    setSubmitting(true)
    try {
      await onRestartWithWebsite?.(url)
      setShowWebsiteInput(false)
      setWebsiteInput('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="border-red-500/30 bg-red-500/5">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-profile-fg">
          <XCircle className="h-4 w-4 text-red-500" />
          {stageName === 'quick_check' ? 'Needs more info' : `${humanStage(stageName)} — Blocked`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium text-profile-fg-muted mb-1">Reason</p>
          <p className="text-sm text-profile-fg">{reason || 'Stage failed validation or encountered an error.'}</p>
        </div>
        {suggestedAction === 'add_company_website' && onRestartWithWebsite ? (
          <div className="space-y-2">
            {showWebsiteInput ? (
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://company-website.com"
                  value={websiteInput}
                  onChange={(e) => setWebsiteInput(e.target.value)}
                  className="flex-1 rounded-md border border-profile-divider bg-background px-3 py-2 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddWebsite()}
                />
                <Button size="sm" onClick={handleAddWebsite} disabled={submitting || !websiteInput.trim()}>
                  {submitting ? 'Adding…' : 'Add & restart'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowWebsiteInput(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="border-profile-accent text-profile-accent hover:bg-profile-accent-muted"
                onClick={() => setShowWebsiteInput(true)}
              >
                Add company website
              </Button>
            )}
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-profile-fg-muted mb-2">Suggested actions</p>
            <ul className="list-disc list-inside text-sm space-y-1">
              {suggestedActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function buildValidationSummaryText(run: AnalysisStatus): string {
  const d = run.diagnostics
  const lines: string[] = [
    `run_id: ${run.run_id}`,
    `company: ${run.company_name ?? '—'}`,
    `status: ${run.status}`,
    `report_quality_status: ${run.report_quality_status ?? d?.report_quality_status ?? '—'}`,
    `reason_codes: ${(d?.report_quality_reason_codes ?? []).join(', ') || '—'}`,
    `degraded_reasons: ${(d?.report_degraded_reasons ?? []).join('; ') || '—'}`,
    `valuation_skipped: ${d?.valuation_skipped ?? false}`,
    `assumption_blocked_reasons: ${(d?.assumption_blocked_reasons ?? []).join('; ') || '—'}`,
    `evidence_accepted: ${d?.evidence_accepted_count ?? '—'}`,
    `evidence_rejected: ${d?.evidence_rejected_count ?? '—'}`,
  ]
  if (d?.report_quality_limitation_summary?.length) {
    lines.push(`limitation_summary: ${d.report_quality_limitation_summary.join(' | ')}`)
  }
  return lines.join('\n')
}

function ValidationSummaryBlock({ run }: { run: AnalysisStatus }) {
  const d = run.diagnostics
  if (!d) return null
  const hasContent =
    d.report_quality_status ||
    (d.report_quality_reason_codes?.length ?? 0) > 0 ||
    (d.report_quality_limitation_summary?.length ?? 0) > 0 ||
    d.assumption_valuation_ready !== undefined ||
    d.valuation_skipped ||
    d.report_degraded ||
    d.evidence_accepted_count !== undefined
  if (!hasContent) return null

  const summaryLine = [
    d.report_quality_status && `Quality: ${d.report_quality_status}`,
    d.assumption_valuation_ready !== undefined && `Assumptions: ${d.assumption_valuation_ready ? 'ready' : 'not ready'}`,
    d.valuation_skipped && 'Valuation skipped',
    d.evidence_accepted_count !== undefined && `Evidence: ${d.evidence_accepted_count} accepted`,
  ]
    .filter(Boolean)
    .join(' · ')

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const text = buildValidationSummaryText(run)
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Validation summary copied to clipboard')
    } catch {
      toast.error('Failed to copy')
    }
  }

  return (
    <Collapsible defaultOpen={false}>
      <div className="flex items-center justify-between gap-2">
        <CollapsibleTrigger className="flex items-center gap-1 flex-1 text-left text-xs text-profile-fg-muted hover:text-profile-fg py-1.5">
          <ChevronDown className="h-3 w-3 shrink-0" />
          <span>Validation summary</span>
        </CollapsibleTrigger>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 p-1 text-profile-fg-muted hover:text-profile-fg rounded transition-colors"
          title="Copy validation summary"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
      <CollapsibleContent>
        <div className="mt-2 pt-2 border-t border-profile-divider space-y-2 text-xs text-profile-fg-muted">
          {summaryLine && <p>{summaryLine}</p>}
          {(d.report_quality_reason_codes?.length ?? 0) > 0 && (
            <div>
              <span className="font-medium text-profile-fg">Reason codes:</span>{' '}
              {d.report_quality_reason_codes!.join(', ')}
            </div>
          )}
          {(d.report_quality_limitation_summary?.length ?? 0) > 0 && (
            <ul className="list-disc list-inside space-y-0.5">
              {d.report_quality_limitation_summary!.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
          {(d.assumption_blocked_reasons?.length ?? 0) > 0 && (
            <div>
              <span className="font-medium text-profile-fg">Assumption blockers:</span>{' '}
              {d.assumption_blocked_reasons!.join('; ')}
            </div>
          )}
          {d.report_degraded && (d.report_quality_limitation_summary?.length ?? 0) === 0 && (
            <p>Report generated with incomplete data.</p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function AdminDetails({ run, stages }: { run: AnalysisStatus; stages: RunStage[] }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-t pt-3 mt-3">
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-profile-fg-muted hover:text-profile-fg transition-colors"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Technical details
      </button>
      {open && (
        <div className="mt-3 space-y-4">
          <div className="space-y-1 text-xs text-profile-fg-muted font-mono">
            <div>Run ID: {run.run_id}</div>
            <div>Company ID: {run.company_id ?? '—'}</div>
            <div>Raw stage: {run.current_stage}</div>
          </div>
          {stages.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-profile-fg-muted">Stage timing:</p>
              {stages.map((s) => (
                <div key={s.stage} className="flex items-center justify-between text-xs text-profile-fg-muted">
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
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { user, userRole } = useAuth()
  const isAdmin = isAdminLinkVisible(userRole, user?.email, !!user)

  const fetchStatus = useCallback(async () => {
    if (!runId) return
    const data = await getRunStatus(runId)
    if (data) {
      setRun(data)
      setError(false)
      setLastFetchedAt(Date.now())
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- polling lifecycle is keyed off run status and stable fetch callback
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
            <p className="text-sm text-profile-fg-muted">
              The requested analysis run could not be found.
            </p>
            <p className="text-xs text-profile-fg-muted max-w-md mx-auto">
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
        <aside className="w-56 shrink-0 border-r border-profile-divider bg-profile-bg-subtle p-4 overflow-y-auto">
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
                <h1 className="text-xl font-semibold text-profile-fg">{companyName}</h1>
                <p className="text-sm text-profile-fg-muted mt-1">
                  {humanStage(run.current_stage)}
                </p>
              </div>
              <Badge className={RUN_STATUS_VARIANT[run.status]}>
                {run.status === 'running' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                {run.status === 'failed' ? 'Blocked' : run.status.charAt(0).toUpperCase() + run.status.slice(1)}
              </Badge>
            </div>

            {(run.status === 'running' || run.status === 'pending') && (
              <ResearchStatusBanner run={run} lastFetchedAt={lastFetchedAt} />
            )}

            {run.status === 'running' && (
              <Card className="border-profile-divider bg-profile-bg-surface">
                <CardContent className="py-4">
                  <p className="text-sm flex items-center gap-2 text-profile-fg">
                    <Loader2 className="h-4 w-4 animate-spin text-profile-accent-secondary" />
                    Running {humanStage(run.current_stage)}…
                  </p>
                  <p className="text-xs text-profile-fg-muted mt-2">
                    This may take several minutes. The page will update automatically.
                  </p>
                  <p className="text-xs text-profile-fg-muted mt-2">
                    Stuck? Use Force restart to reset and re-queue.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 border-profile-divider text-profile-accent hover:bg-profile-accent-muted hover:border-profile-accent"
                    disabled={restarting}
                    onClick={async () => {
                      setRestarting(true)
                      try {
                        const result = await restartRun(run.run_id, true)
                        if (result.success) {
                          toast.success('Run reset and re-queued — worker will pick it up shortly')
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
                    Force restart
                  </Button>
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
              <Card className="border-profile-sage-muted bg-profile-accent-muted/50">
                <CardContent className="py-4">
                  <p className="text-sm font-medium text-profile-fg">Waiting for worker to process this run</p>
                  <p className="text-sm text-profile-fg-muted mt-2">
                    The run is queued. Ensure the RQ worker is running. From the repo root:
                  </p>
                  <code className="block mt-2 p-2 rounded bg-profile-bg-subtle text-profile-fg text-xs font-mono">
                    ./scripts/start-deep-research-worker.sh
                  </code>
                  <p className="text-xs text-profile-fg-muted mt-2">
                    Redis must be running. Check with: <code className="rounded bg-profile-bg-subtle px-1">redis-cli ping</code>
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 border-profile-divider text-profile-accent hover:bg-profile-accent-muted hover:border-profile-accent"
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
              <Alert className="border-profile-sage-muted bg-profile-accent-muted/50">
                <Info className="h-4 w-4 text-profile-accent-secondary" />
                <AlertDescription>
                  <p className="font-medium">Valuation skipped</p>
                  <p className="text-sm text-profile-fg-muted mt-1">
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
                        <ul className="mt-2 list-disc list-inside text-sm text-profile-fg-muted">
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

            {isComplete && (run.report_quality_status || run.diagnostics?.report_quality_limitation_summary?.length) && (
              <Card className="border-profile-divider bg-profile-bg-surface">
                <CardContent className="py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-profile-fg-muted mb-2">
                    Report quality
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      className={
                        run.report_quality_status === 'complete'
                          ? 'bg-profile-sage-muted text-profile-accent border-profile-divider'
                          : run.report_quality_status === 'complete_with_limitations'
                            ? 'bg-profile-accent-muted/80 text-profile-accent-secondary border-profile-sage-muted'
                            : run.report_quality_status === 'blocked'
                              ? 'bg-red-500/10 text-red-600 border-red-500/20'
                              : 'bg-profile-bg-subtle text-profile-fg-muted border-profile-divider'
                      }
                    >
                      {run.report_quality_status === 'complete'
                        ? 'Complete'
                        : run.report_quality_status === 'complete_with_limitations'
                          ? 'Complete with limitations'
                          : run.report_quality_status === 'blocked'
                            ? 'Blocked'
                            : run.report_quality_status ?? '—'}
                    </Badge>
                  </div>
                  {run.diagnostics?.report_quality_limitation_summary?.length ? (
                    <ul className="mt-2 text-sm text-profile-fg-muted list-disc list-inside space-y-0.5">
                      {run.diagnostics.report_quality_limitation_summary.slice(0, 5).map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </CardContent>
              </Card>
            )}

            {isComplete && <ValidationSummaryBlock run={run} />}

            {isComplete && run.company_id && (
              <Link to={`/deep-research/company/${run.company_id}/report/latest?runId=${run.run_id}`}>
                <Button className="w-full bg-profile-accent hover:bg-profile-accent-secondary text-white border-0">
                  <FileText className="h-4 w-4 mr-2" />
                  View Report
                </Button>
              </Link>
            )}

            {isFailed && (
              <>
                <BlockedStageCard
                  stageName={failedStage?.stage ?? run.current_stage}
                  reason={run.quick_check_suggestion || stageError || runError || ''}
                  suggestedActions={
                    run.suggested_action === 'add_company_website'
                      ? ['Add company website']
                      : getSuggestedActions(failedStage?.stage ?? run.current_stage)
                  }
                  suggestedAction={run.suggested_action}
                  onRestartWithWebsite={async (website) => {
                    setRestarting(true)
                    try {
                      const result = await restartRun(run.run_id, false, website)
                      if (result.success) {
                        toast.success('Website added — run re-queued')
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
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="border-profile-divider text-profile-accent hover:bg-profile-accent-muted hover:border-profile-accent"
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
