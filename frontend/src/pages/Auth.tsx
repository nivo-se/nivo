import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Loader2, Mail, Lock, Building2 } from 'lucide-react'
import { supabaseConfig } from '../lib/supabase'

const Auth: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [mode, setMode] = useState<'password' | 'magic'>('magic')

  const { signIn, signInWithMagicLink, signInWithGoogle, user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Handle magic link callback (hash fragment or query)
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash?.replace('#', '') || '')
    const type = searchParams.get('type') || hashParams.get('type')
    if (type === 'recovery' || type === 'magiclink') {
      setSuccess('Verifying link...')
    }
  }, [searchParams])

  // Redirect to dashboard if user is already logged in
  useEffect(() => {
    if (user) {
      navigate('/dashboard')
    }
  }, [user, navigate])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    if (!email) {
      setError('Please enter your email')
      setLoading(false)
      return
    }

    if (mode === 'password') {
      if (!password) {
        setError('Please enter your password')
        setLoading(false)
        return
      }
      const { error } = await signIn(email, password)
      if (error) {
        setError(error.message)
        setLoading(false)
      } else {
        setSuccess('Successfully signed in! Redirecting...')
        setTimeout(() => navigate('/dashboard'), 1000)
      }
    } else {
      const { error } = await signInWithMagicLink(email)
      if (error) {
        setError(error.message)
        setLoading(false)
      } else {
        setSuccess('Check your email for the login link.')
      }
    }
    setLoading(false)
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError(null)
    const { error } = await signInWithGoogle()
    if (error) {
      setError(error.message)
    }
    setLoading(false)
  }

  if (!supabaseConfig.isConfigured) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-2xl border border-[#E6E6E6] text-center">
          <h1 className="text-xl font-bold text-[#2E2A2B] mb-2">Auth Not Configured</h1>
          <p className="text-gray-600">
            Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for login. Local dev may work without auth.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-2xl border border-[#E6E6E6]">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6 p-6">
            <img 
              src="/nivo-logo-green.svg" 
              alt="Nivo Logo" 
              className="h-20 w-auto"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="w-20 h-20 bg-[#596152] rounded-full flex items-center justify-center hidden p-6">
              <Building2 className="h-10 w-10 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-[#2E2A2B] mb-2">Log In</h1>
        </div>

        <form onSubmit={handleSignIn} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="email" className="text-[#2E2A2B] text-sm font-medium">
              E-post
            </label>
            <Input
              id="email"
              type="email"
              placeholder="din@epost.se"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white border-[#E6E6E6] text-[#2E2A2B] rounded-lg h-12 px-4"
              required
            />
          </div>

          {mode === 'password' && (
            <div className="space-y-2">
              <label htmlFor="password" className="text-[#2E2A2B] text-sm font-medium">
                Lösenord
              </label>
              <Input
                id="password"
                type="password"
                placeholder="Lösenord"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white border-[#E6E6E6] rounded-lg h-12 px-4"
              />
            </div>
          )}

          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-900/20 border border-green-500/50 rounded-lg p-3">
              <p className="text-green-400 text-sm">{success}</p>
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full bg-[#596152] hover:bg-[#596152]/90 text-white font-semibold rounded-lg h-12"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {mode === 'magic' ? 'Skickar länk...' : 'Loggar in...'}
              </>
            ) : (
              mode === 'magic' ? 'Skicka magisk länk' : 'Fortsätt'
            )}
          </Button>

          <button
            type="button"
            onClick={() => setMode(m => m === 'magic' ? 'password' : 'magic')}
            className="w-full text-sm text-gray-500 hover:text-gray-700"
          >
            {mode === 'magic' ? 'Logga in med lösenord istället' : 'Skicka magisk länk istället'}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase text-gray-400">
              <span className="bg-white px-2">eller</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full rounded-lg h-12"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            Logga in med Google
          </Button>
        </form>
      </div>
    </div>
  )
}

export default Auth
