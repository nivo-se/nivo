import { useEffect, useState, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getLatestReport,
  getLatestReportForRun,
  getReportVersion,
  type ReportVersion,
  type ReportSection,
} from '@/lib/services/deepResearchService'

const REPORT_STATUS_CLASSES: Record<ReportVersion['status'], string> = {
  draft: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  review: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  published: 'bg-green-500/15 text-green-600 border-green-500/30',
  archived: 'bg-muted text-muted-foreground',
}

function sectionAnchor(section: ReportSection): string {
  return `section-${section.section_key}`
}

function SectionSidebar({ sections }: { sections: ReportSection[] }) {
  return (
    <nav className="sticky top-6 space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Sections
      </p>
      {sections.map((s) => (
        <a
          key={s.section_key}
          href={`#${sectionAnchor(s)}`}
          className="block text-sm py-1 px-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors truncate"
        >
          {s.heading || s.section_key}
        </a>
      ))}
    </nav>
  )
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-table:text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}

export default function ReportViewerPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const [searchParams] = useSearchParams()
  const runId = searchParams.get('runId')
  const versionId = searchParams.get('versionId')
  const [report, setReport] = useState<ReportVersion | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)

  useEffect(() => {
    if (!companyId) return

    async function fetchReport() {
      setErrorDetail(null)
      let data: ReportVersion | null = null
      // 1) Prefer explicit version (e.g. from Companies list)
      if (versionId) {
        data = await getReportVersion(versionId)
      }
      // 2) By company
      if (!data) {
        data = await getLatestReport(companyId!)
      }
      // 3) Fallback by run (handles company_id mismatch)
      if (!data && runId) {
        data = await getLatestReportForRun(runId)
      }
      if (data) {
        setReport(data)
      } else {
        setError(true)
        setErrorDetail('Report could not be loaded. Check that the backend is running at the API URL.')
      }
      setLoading(false)
    }

    fetchReport()
  }, [companyId, runId, versionId])

  const sortedSections = useMemo(() => {
    if (!report?.sections) return []
    return [...report.sections].sort((a, b) => a.sort_order - b.sort_order)
  }, [report?.sections])

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-[200px_1fr] gap-8">
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <p className="text-muted-foreground">
              No report available for this company yet.
            </p>
            {errorDetail && (
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                {errorDetail}
              </p>
            )}
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              If you&apos;re running locally, ensure the backend and Postgres are running and that
              this company and its report exist in the database.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const validationStatus = report.validation_status
  const hasLintWarnings = (validationStatus?.lint_warnings?.length ?? 0) > 0
  const lintFailed = validationStatus && !validationStatus.lint_passed
  const showStatusBanner = report.report_degraded || hasLintWarnings || lintFailed

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {showStatusBanner && (
        <Card className={
          report.report_degraded
            ? 'border-amber-500/50 bg-amber-500/5'
            : hasLintWarnings || lintFailed
              ? 'border-amber-500/50 bg-amber-500/5'
              : ''
        }>
          <CardContent className="pt-4">
            <div className="flex items-start gap-2">
              <span className="text-sm font-medium">
                {report.report_degraded ? 'Report generated with incomplete data' : 'Valuation validation'}
              </span>
            </div>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {report.report_degraded_reasons?.map((r, i) => (
                <li key={i}>• {r}</li>
              ))}
              {hasLintWarnings && validationStatus?.lint_warnings?.map((w, i) => (
                <li key={`lint-${i}`}>• {w}</li>
              ))}
              {lintFailed && !hasLintWarnings && (
                <li>• Valuation lint review recommended</li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <CardTitle className="text-xl">
                {report.title || 'Research Report'}
              </CardTitle>
              {report.version_number != null && (
                <p className="text-xs text-muted-foreground mt-1">
                  Version {report.version_number}
                </p>
              )}
            </div>
            <Badge className={REPORT_STATUS_CLASSES[report.status]}>
              {report.status}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {sortedSections.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-8">
          <aside className="hidden lg:block">
            <SectionSidebar sections={sortedSections} />
          </aside>

          <div className="space-y-8">
            {sortedSections.map((section) => (
              <section key={section.section_key} id={sectionAnchor(section)}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {section.heading || section.section_key}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MarkdownContent content={section.content_md} />
                  </CardContent>
                </Card>
              </section>
            ))}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            This report has no sections yet.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
