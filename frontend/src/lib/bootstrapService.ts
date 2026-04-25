/**
 * POST /api/bootstrap — claim first admin. Requires valid Auth0 JWT.
 */
import { fetchWithAuth } from './backendFetch'
import { API_BASE } from './apiClient'

export interface BootstrapResponse {
  sub: string
  role: string
}

export async function postBootstrap(): Promise<BootstrapResponse> {
  const res = await fetchWithAuth(`${API_BASE}/api/bootstrap`, {
    method: 'POST',
  })
  if (!res.ok) {
    const text = await res.text()
    let msg = text || `Bootstrap failed: ${res.status}`
    try {
      const j = JSON.parse(text) as { detail?: string }
      if (typeof j.detail === 'string') {
        msg = j.detail
      }
    } catch {
      // keep msg as body text
    }
    throw new Error(msg)
  }
  return res.json()
}
