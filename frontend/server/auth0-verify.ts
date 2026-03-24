/**
 * Validate Auth0 access tokens (RS256 + JWKS). Uses same env as FastAPI / SPA.
 */

import * as jose from 'jose'

export async function getAuth0SubFromBearer(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7).trim()
  if (!token) return null

  const domain = process.env.AUTH0_DOMAIN || process.env.VITE_AUTH0_DOMAIN
  const audience = process.env.AUTH0_AUDIENCE || process.env.VITE_AUTH0_AUDIENCE
  if (!domain || !audience) return null

  try {
    const JWKS = jose.createRemoteJWKSet(new URL(`https://${domain}/.well-known/jwks.json`))
    const { payload } = await jose.jwtVerify(token, JWKS, {
      issuer: `https://${domain}/`,
      audience,
    })
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch (e) {
    if (process.env.DEBUG === 'true' || process.env.DEBUG === '1') {
      console.warn('[auth0-verify] JWT verify failed:', e)
    }
    return null
  }
}
