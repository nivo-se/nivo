/**
 * Auth provider that uses Auth0. Must be rendered inside Auth0Provider.
 * Calls POST /api/enroll on login to register email and get role + bootstrap status.
 */
import React, { useEffect, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { AuthContext } from './AuthContext'
import type { AuthContextType, AppUser } from './AuthContext'
import { setAccessTokenGetter } from '../lib/authToken'
import { postEnroll } from '../lib/services/enrollService'

/** Must match Auth0Provider.authorizationParams so silent refresh uses the same API audience. */
const VITE_AUTH0_AUDIENCE = (import.meta.env.VITE_AUTH0_AUDIENCE as string | undefined)?.trim() || undefined
const ACCESS_TOKEN_SCOPE = 'openid profile email offline_access'

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
  const [isBootstrapped, setIsBootstrapped] = useState(false)
  const [meLoaded, setMeLoaded] = useState(false)

  useEffect(() => {
    // Access token for API (audience). Without explicit authorizationParams, silent refresh can omit
    // the API audience and the backend returns 401; Auth0 token endpoint may return 400 in some cases.
    setAccessTokenGetter(async () => {
      try {
        return await getAccessTokenSilently({
          authorizationParams: {
            ...(VITE_AUTH0_AUDIENCE ? { audience: VITE_AUTH0_AUDIENCE } : {}),
            scope: ACCESS_TOKEN_SCOPE,
          },
        })
      } catch (e) {
        if (import.meta.env.DEV) {
          console.error('[Auth0] getAccessTokenSilently failed', e)
        }
        return null
      }
    })
    return () => setAccessTokenGetter(() => Promise.resolve(null))
  }, [getAccessTokenSilently])

  useEffect(() => {
    if (!isAuthenticated || !auth0User) {
      setUserRole(null)
      setIsBootstrapped(false)
      setMeLoaded(true)
      return
    }
    setMeLoaded(false)
    postEnroll(auth0User.email ?? null, auth0User.name ?? null)
      .then((result) => {
        setUserRole(result?.role ?? null)
        setIsBootstrapped(result?.is_bootstrapped ?? false)
        setMeLoaded(true)
      })
      .catch(() => {
        setUserRole(null)
        setIsBootstrapped(false)
        setMeLoaded(true)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap should rerun on auth state and subject changes
  }, [isAuthenticated, auth0User?.sub])

  const user = isAuthenticated && auth0User ? auth0UserToAppUser(auth0User) : null
  const loading = isLoading || (isAuthenticated && !meLoaded)

  const signIn = async (_email: string, _password: string) => {
    await loginWithRedirect()
    return { error: null }
  }

  const signOut = async () => {
    setUserRole(null)
    setIsBootstrapped(false)
    logout({ logoutParams: { returnTo: window.location.origin } })
    return { error: null }
  }

  const value: AuthContextType = {
    user,
    session: null,
    loading,
    userRole,
    isBootstrapped,
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
