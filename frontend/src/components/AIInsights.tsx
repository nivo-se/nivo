import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Loader2 } from 'lucide-react'

export const AIInsights: React.FC = () => {
  const [orgnr, setOrgnr] = useState('')
  const [profile, setProfile] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLoadProfile = async () => {
    if (!orgnr.trim()) {
      setError('Enter an organization number')
      return
    }
    if (!supabase) {
      setError('Supabase client is not configured')
      return
    }
    setError(null)
    setIsLoading(true)
    try {
      const { data, error: supabaseError } = await supabase
        .from('ai_profiles')
        .select('*')
        .eq('org_number', orgnr.trim())
        .maybeSingle()

      if (supabaseError) throw supabaseError
      setProfile(data)
      if (!data) {
        setError('No insights available yet. Run enrichment first.')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load profile')
      setProfile(null)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 p-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={orgnr}
          onChange={(e) => setOrgnr(e.target.value)}
          placeholder="Enter org number (e.g. 5560001421)"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
        />
        <button
          onClick={handleLoadProfile}
          className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/90 disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load insights'}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {profile && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-md border border-gray-100 p-3">
            <p className="text-xs uppercase text-gray-500">Product</p>
            <p className="text-sm text-gray-900">{profile.product_description || 'N/A'}</p>
          </div>
          <div className="rounded-md border border-gray-100 p-3">
            <p className="text-xs uppercase text-gray-500">End market</p>
            <p className="text-sm text-gray-900">{profile.end_market || 'N/A'}</p>
          </div>
          <div className="rounded-md border border-gray-100 p-3">
            <p className="text-xs uppercase text-gray-500">Customer types</p>
            <p className="text-sm text-gray-900">{profile.customer_types || 'N/A'}</p>
          </div>
          <div className="rounded-md border border-gray-100 p-3">
            <p className="text-xs uppercase text-gray-500">Value chain position</p>
            <p className="text-sm text-gray-900">{profile.value_chain_position || 'N/A'}</p>
          </div>
          <div className="rounded-md border border-gray-100 p-3">
            <p className="text-xs uppercase text-gray-500">Strategic fit</p>
            <p className="text-2xl font-semibold text-gray-900">
              {profile.strategic_fit_score ?? '—'}
              <span className="text-base font-normal text-gray-500">/100</span>
            </p>
          </div>
          <div className="rounded-md border border-gray-100 p-3">
            <p className="text-xs uppercase text-gray-500">Defensibility</p>
            <p className="text-2xl font-semibold text-gray-900">
              {profile.defensibility_score ?? '—'}
              <span className="text-base font-normal text-gray-500">/100</span>
            </p>
          </div>
          <div className="rounded-md border border-gray-100 p-3 md:col-span-2">
            <p className="text-xs uppercase text-gray-500">AI Notes</p>
            <p className="text-sm text-gray-900 whitespace-pre-line">{profile.ai_notes || 'N/A'}</p>
          </div>
        </div>
      )}
    </div>
  )
}

