/**
 * POST /api/enroll — register email on login and get role + bootstrap status.
 * No role or allowlist required; any valid JWT can call this.
 */
import { fetchWithAuth } from '@/lib/backendFetch'
import { API_BASE } from '@/lib/apiClient'

export interface EnrollResponse {
  sub: string
  email: string | null
  role: string | null
  is_bootstrapped: boolean
}

export async function postEnroll(
  email?: string | null,
  name?: string | null,
): Promise<EnrollResponse | null> {
  try {
    const res = await fetchWithAuth(`${API_BASE}/api/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email ?? null, name: name ?? null }),
    })
    if (!res.ok) {
      if (import.meta.env.DEV) {
        const text = await res.text().catch(() => '')
        console.error('[enroll] POST /api/enroll failed', res.status, text.slice(0, 300))
      }
      return null
    }
    return res.json()
  } catch {
    return null
  }
}
