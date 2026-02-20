import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Loader2, Building2 } from 'lucide-react'
import { isAuth0Configured } from '../lib/authToken'

const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const { signIn, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const callbackError = (location.state as { error?: string } | null)?.error
  // Auth0 can append error/error_description to URL when redirecting (e.g. after signup if email verification required)
  const params = new URLSearchParams(location.search)
  const urlError = params.get('error_description') ?? params.get('error')

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  const displayError = callbackError || urlError

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

  return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card rounded-2xl p-8 shadow-2xl border border-border">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6 p-6">
              <img
                src="/nivo-logo-green.svg"
                alt="Nivo Logo"
                className="h-20 w-auto"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  e.currentTarget.nextElementSibling?.classList.remove('hidden')
                }}
              />
              <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center hidden p-6">
                <Building2 className="h-10 w-10 text-primary-foreground" />
              </div>
            </div>
            <h1 className="text-base font-bold text-foreground mb-2">Log In</h1>
          </div>
          {displayError && (
            <p className="text-sm text-destructive mb-4 text-center" role="alert">
              {displayError}
            </p>
          )}
          <Button
            className="w-full font-semibold rounded-lg h-12"
            onClick={async () => {
              setLoading(true)
              await signIn('', '')
            }}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Redirecting...
              </>
            ) : (
              'Log in with Auth0'
            )}
          </Button>
        </div>
      </div>
    )
}

export default Auth
