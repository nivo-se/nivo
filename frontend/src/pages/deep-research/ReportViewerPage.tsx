import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getLatestReport,
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

function ContentParagraphs({ content }: { content: string }) {
  const paragraphs = useMemo(
    () => content.split(/\n\n+/).filter((p) => p.trim()),
    [content],
  )

  return (
    <div className="space-y-4">
      {paragraphs.map((para, i) => (
        <p key={i} className="text-sm leading-relaxed whitespace-pre-wrap">
          {para}
        </p>
      ))}
    </div>
  )
}

export default function ReportViewerPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const [report, setReport] = useState<ReportVersion | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!companyId) return
    getLatestReport(companyId).then((data) => {
      if (data) {
        setReport(data)
      } else {
        setError(true)
      }
      setLoading(false)
    })
  }, [companyId])

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
          <CardContent className="py-12 text-center text-muted-foreground">
            No report available for this company.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Report header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <CardTitle className="text-xl">
                {report.title || 'Untitled Report'}
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

      {/* Body: sidebar + sections */}
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
                    <ContentParagraphs content={section.content_md} />
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
