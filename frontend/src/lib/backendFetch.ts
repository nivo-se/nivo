/**
 * Fetch with Auth0 access token for backend API calls.
 * Attaches Authorization: Bearer <access_token> when available.
 */
import { getAccessToken } from './authToken'

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const token = await getAccessToken()
    if (token) return { Authorization: `Bearer ${token}` }
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
        `If using api.nivogroup.se: ensure the Cloudflare tunnel and API are running on the Mac. ` +
        `Use the Troubleshooting → Test connection on this page to diagnose.`
      )
    }
    throw e
  }
}
