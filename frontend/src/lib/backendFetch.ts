/**
 * Fetch with Supabase auth token for backend API calls.
 * Attaches Authorization: Bearer <access_token> when session exists.
 * Catches network errors and throws a more helpful message.
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

function isNetworkError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return (
    msg === "Failed to fetch" ||
    msg.includes("NetworkError") ||
    msg.includes("Load failed") ||
    msg.includes("connection refused")
  )
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
  try {
    return await fetch(url, { ...options, headers })
  } catch (e) {
    if (isNetworkError(e)) {
      const base = new URL(url).origin
      throw new Error(
        `Cannot reach backend at ${base}. Is the backend running? ` +
        `Check VITE_API_BASE_URL in .env (e.g. http://localhost:8000 or http://localhost:8001).`
      )
    }
    throw e
  }
}
