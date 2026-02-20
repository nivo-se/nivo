import React, { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Loader2 } from 'lucide-react'
import { isAuth0Configured } from '../lib/authToken'

const Auth: React.FC = () => {
  const [redirecting, setRedirecting] = useState(false)
  const { signIn, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const callbackError = (location.state as { error?: string } | null)?.error
  const params = new URLSearchParams(location.search)
  const urlError = params.get('error_description') ?? params.get('error')
  const displayError = callbackError || urlError

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  // Redirect directly to Auth0; only show error UI if there was a callback/URL error
  useEffect(() => {
    if (!isAuth0Configured() || user || displayError) return
    setRedirecting(true)
    signIn('', '')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount

  if (!isAuth0Configured()) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card rounded-2xl p-8 shadow-2xl border border-border text-center">
          <h1 className="text-base font-bold text-foreground mb-2">Auth Not Configured</h1>
          <p className="text-muted-foreground">
            Set VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID in frontend/.env
          </p>
        </div>
      </div>
    )
  }

  // Show error with Try again button
  if (displayError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card rounded-2xl p-8 shadow-2xl border border-border">
          <div className="text-center mb-6">
            <img src="/nivo-logo-green.svg" alt="Nivo" className="h-16 w-auto mx-auto mb-4" />
            <h1 className="text-base font-bold text-foreground mb-2">Log In</h1>
            <p className="text-sm text-destructive mb-4" role="alert">{displayError}</p>
          </div>
          <Button
            className="w-full font-semibold rounded-lg h-12"
            onClick={async () => {
              setRedirecting(true)
              await signIn('', '')
            }}
            disabled={redirecting}
          >
            {redirecting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Redirecting...</> : 'Try again'}
          </Button>
        </div>
      </div>
    )
  }

  // Redirecting to Auth0 – show loading only
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center">
        <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Redirecting to sign in...</p>
      </div>
    </div>
  )
}

export default Auth
