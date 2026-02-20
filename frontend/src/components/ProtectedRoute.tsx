import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { isAuth0Configured } from '../lib/authToken'
import { Loader2, Clock, AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription } from './ui/alert'
import { Button } from './ui/button'

const AUTH_SETTLE_MS = 2500 // Grace period after navigation before redirecting to /auth (Auth0 may need time to propagate)

interface ProtectedRouteProps {
  children: React.ReactNode
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const navigate = useNavigate()
  const { user, loading, isApproved } = useAuth()
  const authEnabled = isAuth0Configured()
  const [graceExpired, setGraceExpired] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setGraceExpired(true), AUTH_SETTLE_MS)
    return () => clearTimeout(t)
  }, [])

  // Redirect to /auth when not logged in—but only after grace period (avoids redirect loop right after callback)
  useEffect(() => {
    if (!authEnabled || !graceExpired) return
    if (loading || user) return
    navigate('/auth', { replace: true })
  }, [authEnabled, loading, user, navigate, graceExpired])

  if (!authEnabled) {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // During grace period after nav from callback, show loading instead of redirecting (Auth0 may still be settling)
  if (!user && !graceExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  // Check if user is approved
  if (!isApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40">
        <div className="max-w-md w-full mx-auto p-6">
          <div className="text-center mb-6">
            <Clock className="h-16 w-16 text-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">Access Pending</h1>
            <p className="text-muted-foreground">
              Your account is waiting for administrator approval.
            </p>
          </div>
          
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You have successfully signed up, but your account needs to be approved by an administrator before you can access the platform. 
              You will receive an email notification once your account is approved.
            </AlertDescription>
          </Alert>

          <div className="mt-6 text-center">
            <Button 
              variant="outline" 
              onClick={() => navigate('/auth')}
            >
              Back to Login
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export default ProtectedRoute
