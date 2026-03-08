import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Settings, RefreshCw, FileEdit } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getLatestReport,
  recomputeSection,
  type ReportVersion,
  type RecomputeResult,
} from '@/lib/services/deepResearchService'

const SECTION_OPTIONS = [
  { key: 'company_profile', label: 'Company Profile' },
  { key: 'financials_and_valuation', label: 'Financials & Valuation' },
  { key: 'market_and_competitive_landscape', label: 'Market & Competitive Landscape' },
  { key: 'strategy_and_positioning', label: 'Strategy & Positioning' },
  { key: 'investment_thesis', label: 'Investment Thesis' },
] as const

export default function AssumptionOverridePage() {
  const { companyId } = useParams<{ companyId: string }>()

  const [report, setReport] = useState<ReportVersion | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedSection, setSelectedSection] = useState<string>('')
  const [instructions, setInstructions] = useState('')

  const [recomputeStatus, setRecomputeStatus] = useState<RecomputeResult | null>(null)
  const [recomputing, setRecomputing] = useState(false)

  const fetchReport = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    setError(null)
    try {
      const r = await getLatestReport(companyId)
      setReport(r)
    } catch {
      setError('Failed to load report data.')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  async function handleRecomputeSection() {
    if (!report || !selectedSection) return
    setRecomputing(true)
    setRecomputeStatus(null)
    try {
      const result = await recomputeSection({
        report_version_id: report.report_version_id,
        section_key: selectedSection,
        instructions: instructions.trim() || undefined,
      })
      setRecomputeStatus(result)
    } catch {
      setError('Section recompute request failed.')
    } finally {
      setRecomputing(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-heading font-semibold">Assumption Overrides</h1>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Explanation card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileEdit className="h-4 w-4" />
            About Assumption Overrides
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Assumption overrides allow analysts to adjust key financial and model inputs, then
            trigger downstream recomputation. Once the backend API is available, this page will
            let you:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            <li>View and edit revenue growth assumptions</li>
            <li>Override discount rates, terminal values, and margin projections</li>
            <li>Set custom competitive positioning scores</li>
            <li>Lock specific assumptions to prevent automatic updates</li>
          </ul>
          <Badge variant="outline" className="mt-2">API Pending</Badge>
        </CardContent>
      </Card>

      {/* Section recompute */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Section Recompute
          </CardTitle>
          <CardDescription>
            Recompute a specific report section with optional analyst instructions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-9 w-36" />
            </div>
          ) : !report ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <FileEdit className="h-10 w-10 opacity-40" />
              <p className="text-sm">No report found for this company.</p>
              <p className="text-xs">Run a full analysis first to generate a report.</p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Section
                </label>
                <Select value={selectedSection} onValueChange={setSelectedSection}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a section to recompute" />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.key} value={opt.key}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="instructions" className="text-xs font-medium text-muted-foreground">
                  Instructions (optional)
                </label>
                <Textarea
                  id="instructions"
                  placeholder="e.g. Use 8% discount rate instead of 10%. Focus more on Nordic market dynamics."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-3">
                <Button
                  disabled={!selectedSection || recomputing}
                  onClick={handleRecomputeSection}
                >
                  <RefreshCw className={`mr-1.5 h-4 w-4 ${recomputing ? 'animate-spin' : ''}`} />
                  Recompute Section
                </Button>
                {report && (
                  <span className="text-xs text-muted-foreground">
                    Report v{report.version_number ?? '?'} · {report.report_version_id.slice(0, 8)}
                  </span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Recompute status */}
      {recomputeStatus && (
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 text-sm">
              <span className="font-medium">Section recompute triggered</span>
              <span className="mx-2 text-muted-foreground">·</span>
              <span className="text-muted-foreground">Job {recomputeStatus.job_id}</span>
            </div>
            <Badge variant={recomputeStatus.status === 'completed' ? 'default' : 'secondary'}>
              {recomputeStatus.status}
            </Badge>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
