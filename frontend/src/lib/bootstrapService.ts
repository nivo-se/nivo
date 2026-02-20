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
    throw new Error(text || `Bootstrap failed: ${res.status}`)
  }
  return res.json()
}
