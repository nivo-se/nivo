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
} from 'lucide-react'
import {
  getRunStatus,
  type AnalysisStatus,
  type RunStage,
} from '@/lib/services/deepResearchService'

const POLL_INTERVAL = 3000

const STATUS_CONFIG: Record<
  RunStage['status'],
  { icon: typeof CheckCircle; color: string; label: string }
> = {
  completed: { icon: CheckCircle, color: 'text-green-500', label: 'Completed' },
  running: { icon: Loader2, color: 'text-amber-500', label: 'Running' },
  pending: { icon: Circle, color: 'text-muted-foreground', label: 'Pending' },
  failed: { icon: XCircle, color: 'text-red-500', label: 'Failed' },
  skipped: { icon: SkipForward, color: 'text-muted-foreground', label: 'Skipped' },
}

const RUN_STATUS_VARIANT: Record<AnalysisStatus['status'], string> = {
  pending: 'bg-muted text-muted-foreground',
  running: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  completed: 'bg-green-500/15 text-green-600 border-green-500/30',
  failed: 'bg-red-500/15 text-red-600 border-red-500/30',
  cancelled: 'bg-muted text-muted-foreground',
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

function StageTimeline({ stages }: { stages: RunStage[] }) {
  return (
    <div className="relative space-y-0">
      {stages.map((stage, idx) => {
        const cfg = STATUS_CONFIG[stage.status]
        const Icon = cfg.icon
        const isLast = idx === stages.length - 1

        return (
          <div key={stage.stage} className="relative flex gap-4">
            {/* Vertical line */}
            <div className="flex flex-col items-center">
              <div className={`mt-1 shrink-0 ${cfg.color}`}>
                <Icon
                  className={`h-5 w-5 ${stage.status === 'running' ? 'animate-spin' : ''}`}
                />
              </div>
              {!isLast && (
                <div className="w-px flex-1 bg-border min-h-[24px]" />
              )}
            </div>

            {/* Content */}
            <div className="pb-6 flex-1 min-w-0">
              <p
                className={`font-medium text-sm ${
                  stage.status === 'skipped' ? 'line-through text-muted-foreground' : ''
                }`}
              >
                {stage.stage}
              </p>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                {stage.started_at && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTimestamp(stage.started_at)}
                  </span>
                )}
                {stage.finished_at && (
                  <span>→ {formatTimestamp(stage.finished_at)}</span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function RunStatusPage() {
  const { runId } = useParams<{ runId: string }>()
  const [run, setRun] = useState<AnalysisStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = useCallback(async () => {
    if (!runId) return
    const data = await getRunStatus(runId)
    if (data) {
      setRun(data)
      setError(false)
    } else if (!run) {
      setError(true)
    }
    setLoading(false)
  }, [runId, run])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    const shouldPoll =
      run && (run.status === 'pending' || run.status === 'running')
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
        <Skeleton className="h-64 w-full" />
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
          <CardContent className="py-12 text-center">
            <XCircle className="mx-auto h-10 w-10 text-red-500 mb-3" />
            <p className="text-lg font-medium">Failed to load run</p>
            <p className="text-sm text-muted-foreground mt-1">
              Run <code className="text-xs">{runId}</code> could not be found or an error occurred.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

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
              <CardTitle className="text-lg">Analysis Run</CardTitle>
              <p className="text-xs text-muted-foreground font-mono mt-1 truncate">
                {run.run_id}
              </p>
            </div>
            <Badge className={RUN_STATUS_VARIANT[run.status]}>
              {run.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {run.company_id && (
            <div className="text-sm">
              <span className="text-muted-foreground">Company:</span>{' '}
              <Link to={`/deep-research/company/${run.company_id}/report/latest`} className="font-medium text-primary hover:underline">
                {run.company_id}
              </Link>
            </div>
          )}
          <div className="text-sm">
            <span className="text-muted-foreground">Current stage:</span>{' '}
            <span className="font-medium">{run.current_stage}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stages</CardTitle>
        </CardHeader>
        <CardContent>
          {run.stages.length > 0 ? (
            <StageTimeline stages={run.stages} />
          ) : (
            <p className="text-sm text-muted-foreground">No stages reported yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
