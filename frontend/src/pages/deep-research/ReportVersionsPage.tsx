import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { FileText, Clock, GitBranch } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getLatestReport,
  type ReportVersion,
} from '@/lib/services/deepResearchService'

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  published: 'default',
  review: 'secondary',
  draft: 'outline',
  archived: 'destructive',
}

export default function ReportVersionsPage() {
  const { companyId } = useParams<{ companyId: string }>()

  const [report, setReport] = useState<ReportVersion | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!companyId) return

    let cancelled = false

    async function load() {
      setLoading(true)
      const result = await getLatestReport(companyId!)
      if (!cancelled) {
        setReport(result)
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [companyId])

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <GitBranch className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Report Versions</h1>
      </div>

      {!report ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-medium">No reports yet</p>
            <p className="text-sm text-muted-foreground">
              No report has been generated for this company.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {report.title ?? 'Untitled Report'}
                </CardTitle>
                <Badge variant={statusVariant[report.status] ?? 'outline'}>
                  {report.status}
                </Badge>
              </div>
              <CardDescription>Latest version</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Version</span>
                </div>
                <span className="font-medium">
                  {report.version_number ?? '—'}
                </span>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <GitBranch className="h-4 w-4" />
                  <span>Run ID</span>
                </div>
                <span className="font-mono text-xs">{report.run_id}</span>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>Sections</span>
                </div>
                <span className="font-medium">
                  {report.sections?.length ?? '—'}
                </span>
              </div>

              <div className="pt-2">
                <Button asChild variant="outline" size="sm">
                  <Link to={`/deep-research/company/${companyId}/report/latest`}>
                    <FileText className="mr-1 h-4 w-4" />
                    View Report
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
              <Clock className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Version history coming soon</p>
              <p className="max-w-md text-xs text-muted-foreground">
                A full version list API is planned. Once available, this page
                will show all previous report versions with diffs and rollback
                options.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
