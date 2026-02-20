/**
 * Auth context: Auth0 only. When Auth0 is not configured, this no-auth provider is used.
 */
import React, { createContext, useContext, useEffect, useState } from 'react'
import { setAccessTokenGetter } from '../lib/authToken'

export interface AppUser {
  id: string
  email: string | null
  user_metadata?: Record<string, unknown>
  app_metadata?: Record<string, unknown>
  aud?: string
  created_at?: string
  updated_at?: string
}

export interface AuthContextType {
  user: AppUser | null
  session: unknown
  loading: boolean
  userRole: string | null
  isApproved: boolean
  signUp: (email: string, password: string) => Promise<{ error: { name: string; message: string; status: number } | null }>
  signIn: (email: string, password: string) => Promise<{ error: { name: string; message: string; status: number } | null }>
  signInWithMagicLink: (email: string) => Promise<{ error: { name: string; message: string; status: number } | null }>
  signInWithGoogle: () => Promise<{ error: { name: string; message: string; status: number } | null }>
  signOut: () => Promise<{ error: { name: string; message: string; status: number } | null }>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider or Auth0AuthProvider')
  }
  return context
}

const notConfiguredError = () => ({
  name: 'AuthNotConfigured',
  message: 'Auth0 is not configured. Set VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID.',
  status: 503,
})

/**
 * No-auth fallback when Auth0 is not configured. No login; user is always null.
 */
export function NoAuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setAccessTokenGetter(() => Promise.resolve(null))
    setLoading(false)
    return () => setAccessTokenGetter(() => Promise.resolve(null))
  }, [])

  const value: AuthContextType = {
    user: null,
    session: null,
    loading,
    userRole: null,
    isApproved: false,
    signUp: async () => ({ error: notConfiguredError() }),
    signIn: async () => ({ error: notConfiguredError() }),
    signInWithMagicLink: async () => ({ error: notConfiguredError() }),
    signInWithGoogle: async () => ({ error: notConfiguredError() }),
    signOut: async () => ({ error: null }),
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
