import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Building2, FileText, ArrowRight } from 'lucide-react'
import {
  listCompaniesWithReports,
  type CompanyWithReport,
} from '@/lib/services/deepResearchService'

function formatDate(ts: string | null): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyWithReport[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listCompaniesWithReports().then((data) => {
      setCompanies(data ?? [])
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <Skeleton className="h-8 w-56" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Deep Research</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Companies with completed research reports
        </p>
      </div>

      {companies && companies.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No companies with reports yet. Start an analysis run to generate a report.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {companies?.map((c) => {
          const reportUrl = c.latest_report_id
            ? `/deep-research/company/${c.company_id}/report/latest?versionId=${c.latest_report_id}`
            : `/deep-research/company/${c.company_id}/report/latest`
          return (
          <Link
            key={c.company_id}
            to={reportUrl}
            className="block group"
          >
            <Card className="transition-colors hover:border-primary/40">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors truncate">
                      {c.company_name}
                    </CardTitle>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {c.latest_report_title && (
                    <span className="flex items-center gap-1 truncate">
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      {c.latest_report_title}
                    </span>
                  )}
                  {c.updated_at && (
                    <span className="shrink-0">{formatDate(c.updated_at)}</span>
                  )}
                  {c.run_count > 0 && (
                    <Badge variant="secondary" className="shrink-0">
                      {c.run_count} {c.run_count === 1 ? 'run' : 'runs'}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
          )
        })}
      </div>
    </div>
  )
}
