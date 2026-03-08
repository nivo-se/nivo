import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  HelpCircle,
  ShieldCheck,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getVerification,
  getLatestReport,
  type VerificationResult,
} from '@/lib/services/deepResearchService'

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  completed: 'default',
  running: 'secondary',
  queued: 'outline',
  failed: 'destructive',
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  color: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`rounded-lg p-2.5 ${color}`}>{icon}</div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function VerificationPanel() {
  const { companyId } = useParams<{ companyId: string }>()
  const [searchParams] = useSearchParams()

  const [verification, setVerification] = useState<VerificationResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!companyId) return

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        let runId = searchParams.get('runId')

        if (!runId) {
          const report = await getLatestReport(companyId!)
          if (!report) {
            setError('No report found for this company. Cannot determine run ID.')
            setLoading(false)
            return
          }
          runId = report.run_id
        }

        const result = await getVerification(runId)
        if (!cancelled) setVerification(result)
      } catch {
        if (!cancelled) setError('Failed to load verification data.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [companyId, searchParams])

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    )
  }

  const stats = verification?.stats ?? {}
  const totalClaims = Number(stats.total_claims ?? 0)
  const supported = Number(stats.claims_supported ?? 0)
  const unsupported = Number(stats.claims_unsupported ?? 0)
  const uncertain = Number(stats.claims_uncertain ?? 0)

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Verification Results</h1>
        {verification && (
          <Badge variant={statusVariant[verification.status] ?? 'outline'}>
            {verification.status}
          </Badge>
        )}
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-3 p-5 text-destructive">
            <XCircle className="h-5 w-5 shrink-0" />
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      {!verification && !error && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <HelpCircle className="h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-medium">No verification data</p>
            <p className="text-sm text-muted-foreground">
              Verification has not been run for this analysis yet.
            </p>
          </CardContent>
        </Card>
      )}

      {verification && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              icon={<ShieldCheck className="h-5 w-5 text-primary" />}
              label="Total Claims"
              value={totalClaims}
              color="bg-primary/10"
            />
            <StatCard
              icon={<CheckCircle className="h-5 w-5 text-green-600" />}
              label="Supported"
              value={supported}
              color="bg-green-500/10"
            />
            <StatCard
              icon={<XCircle className="h-5 w-5 text-red-600" />}
              label="Unsupported"
              value={unsupported}
              color="bg-red-500/10"
            />
            <StatCard
              icon={<AlertTriangle className="h-5 w-5 text-yellow-600" />}
              label="Uncertain"
              value={uncertain}
              color="bg-yellow-500/10"
            />
          </div>

          {verification.issues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  Issues ({verification.issues.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {verification.issues.map((issue, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {verification.issues.length === 0 && verification.status === 'completed' && (
            <Card>
              <CardContent className="flex items-center gap-3 p-5">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <p className="text-sm text-muted-foreground">
                  No issues found during verification.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
