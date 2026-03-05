/**
 * Auth provider that uses Auth0. Must be rendered inside Auth0Provider.
 * Fetches GET /api/me to get role from local Postgres (user_roles).
 */
import React, { useEffect, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { AuthContext } from './AuthContext'
import type { AuthContextType, AppUser } from './AuthContext'
import { setAccessTokenGetter } from '../lib/authToken'
import { getMe } from '../lib/meService'

function auth0UserToAppUser(auth0User: { sub: string; email?: string; name?: string } | undefined): AppUser | null {
  if (!auth0User) return null
  return {
    id: auth0User.sub,
    email: auth0User.email ?? null,
    user_metadata: {},
    app_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export function Auth0AuthProvider({ children }: { children: React.ReactNode }) {
  const {
    isAuthenticated,
    user: auth0User,
    isLoading,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
  } = useAuth0()
  const [userRole, setUserRole] = useState<string | null>(null)
  const [meLoaded, setMeLoaded] = useState(false)

  useEffect(() => {
    // Use access token only (not ID token). getAccessTokenSilently() returns the access token for our audience.
    setAccessTokenGetter(async () => {
      try {
        return await getAccessTokenSilently()
      } catch {
        return null
      }
    })
    return () => setAccessTokenGetter(() => Promise.resolve(null))
  }, [getAccessTokenSilently])

  useEffect(() => {
    if (!isAuthenticated || !auth0User) {
      setUserRole(null)
      setMeLoaded(true)
      return
    }
    setMeLoaded(false)
    getMe()
      .then((me) => {
        setUserRole(me?.role ?? null)
        setMeLoaded(true)
      })
      .catch(() => {
        setUserRole(null)
        setMeLoaded(true)
      })
  }, [isAuthenticated, auth0User?.sub])

  const user = isAuthenticated && auth0User ? auth0UserToAppUser(auth0User) : null
  const loading = isLoading || (isAuthenticated && !meLoaded)

  const signIn = async (_email: string, _password: string) => {
    await loginWithRedirect()
    return { error: null }
  }

  const signOut = async () => {
    setUserRole(null)
    logout({ logoutParams: { returnTo: window.location.origin } })
    return { error: null }
  }

  const value: AuthContextType = {
    user,
    session: null,
    loading,
    userRole,
    isApproved: isAuthenticated,
    signUp: async () => ({ error: { name: 'Auth0', message: 'Use Sign up on the login page', status: 400 } as any }),
    signIn,
    signInWithMagicLink: async () => ({ error: { name: 'Auth0', message: 'Use Log in with Auth0', status: 400 } as any }),
    signInWithGoogle: async () => {
      await loginWithRedirect({ authorizationParams: { connection: 'google-oauth2' } })
      return { error: null }
    },
    signOut,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
