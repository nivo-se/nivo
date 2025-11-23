import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Loader2 } from 'lucide-react'

export const AIInsights: React.FC = () => {
  const [orgnr, setOrgnr] = useState('')
  const [profile, setProfile] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toArray = (value: unknown): string[] => {
    if (!value) return []
    if (Array.isArray(value)) {
      return value.filter(Boolean).map(String)
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed)) {
          return parsed.filter(Boolean).map(String)
        }
      } catch {
        return value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      }
      return value ? [value] : []
    }
    return [String(value)]
  }

  const marketRegions = useMemo(() => toArray(profile?.market_regions), [profile])
  const riskFlags = useMemo(() => toArray(profile?.risk_flags), [profile])
  const nextSteps = useMemo(() => toArray(profile?.next_steps), [profile])
  const scrapedPages = useMemo(() => toArray(profile?.scraped_pages), [profile])

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
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-md border border-gray-100 p-3">
              <p className="text-xs uppercase text-gray-500">Product</p>
              <p className="text-sm text-gray-900">{profile.product_description || 'N/A'}</p>
              <p className="mt-2 text-xs text-gray-500">
                {profile.business_model_summary || profile.value_chain_position || ''}
              </p>
            </div>
            <div className="rounded-md border border-gray-100 p-3">
              <p className="text-xs uppercase text-gray-500">End market</p>
              <p className="text-sm text-gray-900">{profile.end_market || 'N/A'}</p>
              <p className="mt-2 text-xs text-gray-500">
                Customer types: {profile.customer_types || 'N/A'}
              </p>
            </div>
            <div className="rounded-md border border-gray-100 p-3">
              <p className="text-xs uppercase text-gray-500">Industry & Regions</p>
              <p className="text-sm font-medium text-gray-900">
                {profile.industry_sector || 'N/A'}
                {profile.industry_subsector ? ` / ${profile.industry_subsector}` : ''}
              </p>
              {marketRegions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {marketRegions.map((region) => (
                    <span key={region} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                      {region}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-md border border-gray-100 p-3">
              <p className="text-xs uppercase text-gray-500">Value chain position</p>
              <p className="text-sm text-gray-900">{profile.value_chain_position || 'N/A'}</p>
              <p className="mt-2 text-xs uppercase text-gray-500">Agent</p>
              <p className="text-sm text-gray-900">{profile.agent_type || 'default'}</p>
            </div>
            <div className="rounded-md border border-gray-100 p-3">
              <p className="text-xs uppercase text-gray-500">Strategic fit</p>
              <p className="text-2xl font-semibold text-gray-900">
                {profile.strategic_fit_score ?? '—'}
                <span className="text-base font-normal text-gray-500">/10</span>
              </p>
              <p className="mt-1 text-xs text-gray-500">{profile.fit_rationale || '—'}</p>
            </div>
            <div className="rounded-md border border-gray-100 p-3">
              <p className="text-xs uppercase text-gray-500">Defensibility</p>
              <p className="text-2xl font-semibold text-gray-900">
                {profile.defensibility_score ?? '—'}
                <span className="text-base font-normal text-gray-500">/10</span>
              </p>
              <p className="mt-2 text-xs text-gray-500">Upside: {profile.upside_potential || '—'}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-md border border-gray-100 p-3">
              <p className="text-xs uppercase text-gray-500">Risk flags</p>
              {riskFlags.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-900">
                  {riskFlags.map((flag) => (
                    <li key={flag}>{flag}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-900">No major risks flagged.</p>
              )}
            </div>
            <div className="rounded-md border border-gray-100 p-3">
              <p className="text-xs uppercase text-gray-500">Next steps</p>
              {nextSteps.length > 0 ? (
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-900">
                  {nextSteps.map((step, idx) => (
                    <li key={`${step}-${idx}`}>{step}</li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-gray-900">No playbook actions yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-md border border-gray-100 p-4">
            <p className="text-xs uppercase text-gray-500">Strategic playbook</p>
            <p className="mt-2 whitespace-pre-line text-sm text-gray-900">
              {profile.strategic_playbook || 'Playbook not generated yet.'}
            </p>
          </div>

          <div className="rounded-md border border-gray-100 p-3">
            <p className="text-xs uppercase text-gray-500">AI Notes</p>
            <p className="text-sm text-gray-900 whitespace-pre-line">{profile.ai_notes || 'N/A'}</p>
            {scrapedPages.length > 0 && (
              <div className="mt-3">
                <p className="text-xs uppercase text-gray-500">Scraped pages</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-gray-600">
                  {scrapedPages.map((url) => (
                    <li key={url} className="truncate">
                      <a href={url.startsWith('http') ? url : `https://${url}`} target="_blank" rel="noreferrer">
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

