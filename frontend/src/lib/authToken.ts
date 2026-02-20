/**
 * Central place for the app to provide an access-token getter (Auth0).
 * backendFetch uses this to attach Authorization: Bearer <token> to API calls.
 * Must be the access token (getAccessTokenSilently()), not the ID token.
 */
let getter: (() => Promise<string | null>) | null = null

export function setAccessTokenGetter(fn: () => Promise<string | null>): void {
  getter = fn
}

export async function getAccessToken(): Promise<string | null> {
  if (!getter) return null
  try {
    return await getter()
  } catch {
    return null
  }
}

export function isAuth0Configured(): boolean {
  const domain = import.meta.env.VITE_AUTH0_DOMAIN
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID
  return !!(domain && clientId && String(domain).length > 0 && String(clientId).length > 0)
}
