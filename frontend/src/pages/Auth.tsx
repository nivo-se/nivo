import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Loader2, Mail, Lock, Building2 } from 'lucide-react'

const Auth: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const { signIn, user } = useAuth()
  const navigate = useNavigate()

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

    if (!email || !password) {
      setError('Please fill in all fields')
      setLoading(false)
      return
    }

    const { error } = await signIn(email, password)
    
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess('Successfully signed in! Redirecting to dashboard...')
      // Redirect to dashboard after successful login
      setTimeout(() => {
        navigate('/dashboard')
      }, 1000)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center p-4">
      {/* Main Login Container */}
      <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-2xl border border-[#E6E6E6]">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6 p-6">
            <img 
              src="/nivo-logo-green.svg" 
              alt="Nivo Logo" 
              className="h-20 w-auto"
              onError={(e) => {
                // Fallback to icon if logo doesn't exist
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="w-20 h-20 bg-[#596152] rounded-full flex items-center justify-center hidden p-6">
              <Building2 className="h-10 w-10 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-[#2E2A2B] mb-2">
            Log In
          </h1>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSignIn} className="space-y-6">
          {/* Email Input */}
          <div className="space-y-2">
            <label htmlFor="email" className="text-[#2E2A2B] text-sm font-medium">
              E-post eller användarnamn
            </label>
            <Input
              id="email"
              type="email"
              placeholder="E-post eller användarnamn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white border-[#E6E6E6] text-[#2E2A2B] placeholder-[#2E2A2B]/50 rounded-lg h-12 px-4 focus:border-[#596152] focus:ring-0"
              required
            />
          </div>

          {/* Password Input */}
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
              className="bg-white border-[#E6E6E6] text-[#2E2A2B] placeholder-[#2E2A2B]/50 rounded-lg h-12 px-4 focus:border-[#596152] focus:ring-0"
              required
            />
          </div>

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

          {/* Login Button */}
          <Button 
            type="submit" 
            className="w-full bg-[#596152] hover:bg-[#596152]/90 text-white font-semibold rounded-lg h-12 text-base transition-colors"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loggar in...
              </>
            ) : (
              'Fortsätt'
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}

export default Auth
