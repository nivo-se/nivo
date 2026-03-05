/**
 * Shown when user is logged in (Auth0) but has no role in the DB.
 * Lets them claim the first admin account via POST /api/bootstrap.
 */
import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { postBootstrap } from '@/lib/bootstrapService'
import { testBackendConnectivity } from '@/lib/connectivityTest'
import { Loader2, Shield, Wifi, ChevronDown, ChevronUp } from 'lucide-react'

export default function ClaimFirstAdmin() {
  const { user, signOut } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [diagnostic, setDiagnostic] = useState<{ ok: boolean; message: string; suggestion?: string } | null>(null)
  const [diagnosticLoading, setDiagnosticLoading] = useState(false)
  const [troubleshootOpen, setTroubleshootOpen] = useState(false)

  const handleClaim = async () => {
    setError(null)
    setDiagnostic(null)
    setLoading(true)
    try {
      await postBootstrap()
      // Reload so /api/me is refetched and userRole is set
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Claim failed')
      setLoading(false)
    }
  }

  const handleTestConnection = async () => {
    setDiagnosticLoading(true)
    setDiagnostic(null)
    try {
      const result = await testBackendConnectivity()
      if (result.ok) {
        setDiagnostic({
          ok: true,
          message: `Backend reachable (status ${result.status}). If claim still fails, the issue may be with auth/CORS on POST /api/bootstrap.`,
        })
      } else {
        setDiagnostic({
          ok: false,
          message: result.error ?? `Status ${result.status}`,
          suggestion: result.suggestion,
        })
      }
    } catch (e) {
      setDiagnostic({
        ok: false,
        message: e instanceof Error ? e.message : 'Test failed',
      })
    } finally {
      setDiagnosticLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-lg">
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-primary/10 p-4">
            <Shield className="h-10 w-10 text-primary" />
          </div>
        </div>
        <h1 className="text-xl font-semibold text-center text-foreground mb-2">
          No role assigned
        </h1>
        <p className="text-muted-foreground text-center text-sm mb-6">
          You're signed in as {user?.email ?? user?.id}. There are no users in the database yet.
          If you're setting up the app, you can claim the first admin account.
        </p>
        {error && (
          <p className="text-destructive text-sm text-center mb-4" role="alert">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-3">
          <Button
            className="w-full"
            onClick={handleClaim}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Claiming...
              </>
            ) : (
              'Claim first admin'
            )}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => signOut()}>
            Sign out
          </Button>
        </div>

        <div className="mt-6 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setTroubleshootOpen(!troubleshootOpen)}
            className="flex items-center gap-2 w-full text-sm text-muted-foreground hover:text-foreground"
          >
            {troubleshootOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Troubleshooting
          </button>
          {troubleshootOpen && (
            <div className="mt-3 space-y-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleTestConnection}
                disabled={diagnosticLoading}
              >
                {diagnosticLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Wifi className="mr-2 h-4 w-4" />
                )}
                Test connection to API
              </Button>
              {diagnostic && (
                <div
                  className={`text-sm p-3 rounded-md ${
                    diagnostic.ok ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-destructive/10 text-destructive'
                  }`}
                >
                  <p>{diagnostic.message}</p>
                  {diagnostic.suggestion && (
                    <p className="mt-2 text-muted-foreground">{diagnostic.suggestion}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
