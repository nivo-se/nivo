/**
 * Connectivity diagnostic: test if the backend API is reachable from the browser.
 * Uses GET /health (no auth) to avoid CORS preflight for simple requests.
 */
import { API_BASE } from './apiClient'

export interface ConnectivityResult {
  ok: boolean
  status?: number
  statusText?: string
  body?: unknown
  error?: string
  /** If /health works but auth endpoints fail, likely CORS preflight or auth issue */
  suggestion?: string
}

export async function testBackendConnectivity(): Promise<ConnectivityResult> {
  const url = API_BASE ? `${API_BASE}/health` : '/health'
  try {
    const res = await fetch(url, { method: 'GET' })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        statusText: res.statusText,
        body,
        suggestion: 'Backend returned an error. Check tunnel and API logs.',
      }
    }
    return {
      ok: true,
      status: res.status,
      body,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    let suggestion = 'Backend not reachable from this browser. '
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      suggestion +=
        'Try: (1) curl ' +
        (API_BASE || 'http://localhost:8000') +
        '/health from your terminal. If that works, the Mac running the tunnel may be asleep or on a different network. (2) Disable ad blockers. (3) Check if your network blocks api.nivogroup.se.'
    } else if (msg.includes('CORS')) {
      suggestion += 'CORS may be blocking. Ensure CORS_ORIGINS includes your frontend origin (nivogroup.se, www.nivogroup.se).'
    }
    return {
      ok: false,
      error: msg,
      suggestion,
    }
  }
}
