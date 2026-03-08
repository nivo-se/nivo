import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { listRuns, type AnalysisStatus } from '@/lib/services/deepResearchService'

const STATUS_CLASSES: Record<AnalysisStatus['status'], string> = {
  pending: 'bg-muted text-muted-foreground',
  running: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  completed: 'bg-green-500/15 text-green-600 border-green-500/30',
  failed: 'bg-red-500/15 text-red-600 border-red-500/30',
  cancelled: 'bg-muted text-muted-foreground',
}

function truncateId(id: string, len = 12): string {
  return id.length > len ? id.slice(0, len) + '…' : id
}

export default function RunListPage() {
  const [runs, setRuns] = useState<AnalysisStatus[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listRuns().then((data) => {
      setRuns(data ?? [])
      setLoading(false)
    })
  }, [])

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
      <h1 className="text-2xl font-semibold tracking-tight">Deep Research Runs</h1>

      {runs && runs.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No analysis runs found.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {runs?.map((run) => (
          <Link
            key={run.run_id}
            to={`/deep-research/runs/${run.run_id}`}
            className="block"
          >
            <Card className="transition-colors hover:border-primary/40">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="text-sm font-mono">
                    {truncateId(run.run_id)}
                  </CardTitle>
                  <Badge className={STATUS_CLASSES[run.status]}>
                    {run.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex items-center gap-6 text-sm text-muted-foreground">
                {run.company_id && (
                  <span>
                    Company: <span className="text-foreground">{run.company_id}</span>
                  </span>
                )}
                <span>
                  Stage: <span className="text-foreground">{run.current_stage}</span>
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
