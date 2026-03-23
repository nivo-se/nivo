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

function _envTruthy(v: string | boolean | undefined): boolean {
  if (v === true) return true
  if (v === false || v === undefined) return false
  const s = String(v).toLowerCase().trim()
  return s === "1" || s === "true" || s === "yes"
}

/**
 * Auth0 is "on" only when domain + client id are set.
 * Set `VITE_DISABLE_AUTH=true` (e.g. in `.env.development`) to skip login locally
 * even if `.env` contains Auth0 keys for production builds.
 */
export function isAuth0Configured(): boolean {
  if (_envTruthy(import.meta.env.VITE_DISABLE_AUTH)) {
    return false
  }
  const domain = import.meta.env.VITE_AUTH0_DOMAIN
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID
  return !!(domain && clientId && String(domain).length > 0 && String(clientId).length > 0)
}
