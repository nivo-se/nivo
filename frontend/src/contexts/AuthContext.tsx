import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase, supabaseConfig } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  userRole: string | null
  isApproved: boolean
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<{ error: AuthError | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [isApproved, setIsApproved] = useState(false)
  const authEnabled = false // TEMPORARY: Disable auth for testing

  const createAuthDisabledError = (): AuthError => ({
    name: 'AuthNotConfigured',
    message: 'Authentication is not configured for this environment.',
    status: 503
  } as AuthError)

  // Check user role and approval status
  const checkUserStatus = async (userId: string, userEmail?: string) => {
    if (!supabase) {
      console.warn('Supabase not configured, skipping user status check')
      return
    }
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error checking user status:', error)
        return
      }

      if (data) {
        setUserRole(data.role)
        setIsApproved(data.role === 'approved' || data.role === 'admin')
      } else {
        // User not in user_roles table, check if they're the admin email
        const isAdminEmail = userEmail === 'jesper@rgcapital.se'
        if (isAdminEmail) {
          setUserRole('admin')
          setIsApproved(true)
        } else {
          setUserRole('pending')
          setIsApproved(false)
        }
      }
    } catch (err) {
      console.error('Error checking user status:', err)
      // Fallback: if there's an error, check if it's the admin email
      const isAdminEmail = userEmail === 'jesper@rgcapital.se'
      if (isAdminEmail) {
        setUserRole('admin')
        setIsApproved(true)
      } else {
        setUserRole('pending')
        setIsApproved(false)
      }
    }
  }

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      if (!authEnabled) {
        // TEMPORARY: Set mock user for testing
        const mockUser = {
          id: '795b5119-9fa0-437e-b196-715dcd497666',
          email: 'jesper@rgcapital.se',
          user_metadata: {},
          app_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } as User
        setUser(mockUser)
        setSession(null)
        setUserRole('admin')
        setIsApproved(true)
        setLoading(false)
        return
      }

      if (!supabase) {
        console.warn('Supabase not configured, skipping session check')
        setLoading(false)
        return
      }

      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) {
        console.error('Error getting session:', error)
      } else {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          // TEMPORARY FIX: Force admin for jesper@rgcapital.se
          if (session.user.email === 'jesper@rgcapital.se') {
            console.log('TEMPORARY FIX: Forcing admin access for jesper@rgcapital.se')
            setUserRole('admin')
            setIsApproved(true)
          } else {
            await checkUserStatus(session.user.id, session.user.email)
          }
        }
      }
      setLoading(false)
    }

    getInitialSession()

    if (!authEnabled) {
      return
    }

    // Listen for auth changes
    if (!supabase) {
      return
    }
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          // TEMPORARY FIX: Force admin for jesper@rgcapital.se
          if (session.user.email === 'jesper@rgcapital.se') {
            console.log('TEMPORARY FIX: Forcing admin access for jesper@rgcapital.se (auth change)')
            setUserRole('admin')
            setIsApproved(true)
          } else {
            await checkUserStatus(session.user.id, session.user.email)
          }
        } else {
          setUserRole(null)
          setIsApproved(false)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [authEnabled])

  const signUp = async (email: string, password: string) => {
    if (!authEnabled || !supabase) {
      return { error: createAuthDisabledError() }
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    
    if (!error && data.user) {
      // Add user to user_roles table with pending status
      await supabase
        .from('user_roles')
        .insert({
          user_id: data.user.id,
          role: 'pending'
        })
    }
    
    return { error }
  }

  const signIn = async (email: string, password: string) => {
    if (!authEnabled || !supabase) {
      return { error: createAuthDisabledError() }
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signOut = async () => {
    if (!authEnabled || !supabase) {
      return { error: createAuthDisabledError() }
    }

    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Sign out error:', error)
        return { error }
      }
      // Clear local state
      setUser(null)
      setSession(null)
      setUserRole(null)
      setIsApproved(false)
      return { error: null }
    } catch (err: any) {
      console.error('Sign out error:', err)
      return { error: err }
    }
  }

  const value = {
    user,
    session,
    loading,
    userRole,
    isApproved,
    signUp,
    signIn,
    signOut,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
