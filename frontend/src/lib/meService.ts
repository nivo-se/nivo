/**
 * Current user (GET /api/me). Uses backendFetch so Bearer token is attached.
 */
import { fetchWithAuth } from './backendFetch'
import { API_BASE } from './apiClient'

export interface MeResponse {
  sub: string
  role: string | null
}

export async function getMe(): Promise<MeResponse | null> {
  const res = await fetchWithAuth(`${API_BASE}/api/me`)
  if (!res.ok) return null
  return res.json()
}
