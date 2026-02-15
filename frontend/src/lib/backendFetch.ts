/**
 * Fetch with Supabase auth token for backend API calls.
 * Attaches Authorization: Bearer <access_token> when session exists.
 */
import { supabase } from './supabase'

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!supabase) return {}
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (token) {
      return { Authorization: `Bearer ${token}` }
    }
  } catch {
    // ignore
  }
  return {}
}

export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const authHeaders = await getAuthHeaders()
  const headers = new Headers(options.headers)
  Object.entries(authHeaders).forEach(([k, v]) => headers.set(k, v))
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(url, { ...options, headers })
}
