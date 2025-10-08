import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabaseConfig } from '../lib/supabase'
import { Loader2, Clock, AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription } from './ui/alert'
import { Button } from './ui/button'

interface ProtectedRouteProps {
  children: React.ReactNode
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, isApproved, userRole } = useAuth()
  const authEnabled = supabaseConfig.isConfigured

  if (!authEnabled) {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    // Redirect to auth page
    window.location.href = '/auth'
    return null
  }

  // Check if user is approved
  if (!isApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-auto p-6">
          <div className="text-center mb-6">
            <Clock className="h-16 w-16 text-orange-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Pending</h1>
            <p className="text-gray-600">
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
              onClick={() => {
                window.location.href = '/auth'
              }}
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
