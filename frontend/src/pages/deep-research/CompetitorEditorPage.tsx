import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Trash2, RefreshCw, Globe, Users } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getCompetitors,
  getLatestReport,
  recomputeReport,
  type CompetitorItem,
  type RecomputeResult,
} from '@/lib/services/deepResearchService'

const MUTATION_PENDING_MSG =
  'Backend mutation endpoint is not yet available. This action will be enabled once the API is implemented.'

export default function CompetitorEditorPage() {
  const { companyId } = useParams<{ companyId: string }>()

  const [competitors, setCompetitors] = useState<CompetitorItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newName, setNewName] = useState('')
  const [newWebsite, setNewWebsite] = useState('')
  const [pendingNotice, setPendingNotice] = useState<string | null>(null)

  const [recomputeStatus, setRecomputeStatus] = useState<RecomputeResult | null>(null)
  const [recomputing, setRecomputing] = useState(false)

  const fetchData = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    setError(null)
    try {
      const result = await getCompetitors(companyId)
      setCompetitors(result?.items ?? [])
    } catch {
      setError('Failed to load competitors.')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setPendingNotice(MUTATION_PENDING_MSG)
  }

  function handleRemove() {
    setPendingNotice(MUTATION_PENDING_MSG)
  }

  async function handleRecompute() {
    if (!companyId) return
    setRecomputing(true)
    setRecomputeStatus(null)
    try {
      const report = await getLatestReport(companyId)
      if (!report) {
        setRecomputeStatus(null)
        setError('No report found for this company. Cannot recompute.')
        return
      }
      const result = await recomputeReport({ report_version_id: report.report_version_id })
      setRecomputeStatus(result)
    } catch {
      setError('Recompute request failed.')
    } finally {
      setRecomputing(false)
    }
  }

  function dismissNotice() {
    setPendingNotice(null)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-heading font-semibold">Competitor Editor</h1>
      </div>

      {pendingNotice && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-start justify-between gap-4 pt-6">
            <p className="text-sm text-amber-200">{pendingNotice}</p>
            <Button variant="ghost" size="sm" onClick={dismissNotice}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Add competitor form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Competitor
          </CardTitle>
          <CardDescription>
            Add a new competitor to the analysis set.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <label htmlFor="comp-name" className="text-xs font-medium text-muted-foreground">
                Name
              </label>
              <Input
                id="comp-name"
                placeholder="Company name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <label htmlFor="comp-website" className="text-xs font-medium text-muted-foreground">
                Website
              </label>
              <Input
                id="comp-website"
                placeholder="https://example.com"
                value={newWebsite}
                onChange={(e) => setNewWebsite(e.target.value)}
              />
            </div>
            <Button type="submit">
              <Plus className="mr-1.5 h-4 w-4" />
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Competitor list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1.5">
            <CardTitle>Competitors</CardTitle>
            <CardDescription>
              {loading
                ? 'Loading…'
                : `${competitors.length} competitor${competitors.length === 1 ? '' : 's'} identified`}
            </CardDescription>
          </div>
          <Button
            size="sm"
            disabled={recomputing}
            onClick={handleRecompute}
          >
            <RefreshCw className={`mr-1.5 h-4 w-4 ${recomputing ? 'animate-spin' : ''}`} />
            Recompute
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16 ml-auto" />
                </div>
              ))}
            </div>
          ) : competitors.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
              <Users className="h-10 w-10 opacity-40" />
              <p className="text-sm">No competitors found for this company.</p>
              <p className="text-xs">Add competitors above or run a full analysis to auto-detect them.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {competitors.map((c) => (
                <li
                  key={c.competitor_id}
                  className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">{c.name}</p>
                    {c.website && (
                      <a
                        href={c.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Globe className="h-3 w-3" />
                        {c.website.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                  </div>

                  {c.relation_score != null && (
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="h-2 w-20 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.round(c.relation_score * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
                        {Math.round(c.relation_score * 100)}%
                      </span>
                    </div>
                  )}

                  <Button variant="ghost" size="sm" onClick={handleRemove}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Recompute status */}
      {recomputeStatus && (
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 text-sm">
              <span className="font-medium">Recompute triggered</span>
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
