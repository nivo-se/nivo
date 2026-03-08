import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft,
  CheckCircle,
  Clock,
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
  type AnalysisStatus,
  type RunStage,
} from '@/lib/services/deepResearchService'
import { isAdminLinkVisible } from '@/lib/isAdmin'
import { useAuth } from '@/contexts/AuthContext'

const POLL_INTERVAL = 3000

const STAGE_LABELS: Record<string, string> = {
  identity: 'Company Identification',
  market_research: 'Market Research',
  competitor_discovery: 'Competitor Discovery',
  financial_analysis: 'Financial Analysis',
  strategy_analysis: 'Strategy Analysis',
  report_generation: 'Report Generation',
  verification: 'Fact Verification',
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

function StageChecklist({ stages }: { stages: RunStage[] }) {
  return (
    <div className="space-y-0">
      {stages.map((stage, idx) => {
        const cfg = STATUS_ICON[stage.status]
        const Icon = cfg.icon
        const isLast = idx === stages.length - 1

        return (
          <div key={stage.stage} className="relative flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`mt-0.5 shrink-0 ${cfg.color}`}>
                <Icon className={`h-4 w-4 ${stage.status === 'running' ? 'animate-spin' : ''}`} />
              </div>
              {!isLast && <div className="w-px flex-1 bg-border min-h-[20px]" />}
            </div>
            <div className="pb-4 flex-1 min-w-0">
              <p className={`text-sm font-medium ${stage.status === 'skipped' ? 'line-through text-muted-foreground' : ''}`}>
                {humanStage(stage.stage)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
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

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (error || !run) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <Link to="/deep-research/runs">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to runs
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

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Link to="/deep-research/runs">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to runs
        </Button>
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <CardTitle className="text-lg">{companyName}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {humanStage(run.current_stage)}
              </p>
            </div>
            <Badge className={RUN_STATUS_VARIANT[run.status]}>
              {run.status === 'running' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isComplete && run.company_id && (
            <Link to={`/deep-research/company/${run.company_id}/report/latest?runId=${run.run_id}`}>
              <Button className="w-full">
                <FileText className="h-4 w-4 mr-2" />
                View Report
              </Button>
            </Link>
          )}

          {run.stages.length > 0 && (
            <div className="pt-2">
              <p className="text-sm font-medium mb-3">Pipeline Progress</p>
              <StageChecklist stages={run.stages} />
            </div>
          )}

          {isAdmin && <AdminDetails run={run} stages={run.stages} />}
        </CardContent>
      </Card>
    </div>
  )
}
