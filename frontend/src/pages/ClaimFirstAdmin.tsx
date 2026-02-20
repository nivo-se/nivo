/**
 * Shown when user is logged in (Auth0) but has no role in the DB.
 * Lets them claim the first admin account via POST /api/bootstrap.
 */
import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { postBootstrap } from '@/lib/bootstrapService'
import { Loader2, Shield } from 'lucide-react'

export default function ClaimFirstAdmin() {
  const { user, signOut } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClaim = async () => {
    setError(null)
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
      </div>
    </div>
  )
}
