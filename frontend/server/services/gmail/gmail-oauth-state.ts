import { createHash } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'

const PURPOSE = 'gmail_crm_oauth' as const

function secretKey(): Uint8Array {
  const k = process.env.GMAIL_OAUTH_ENCRYPTION_KEY?.trim()
  if (!k) throw new Error('GMAIL_OAUTH_ENCRYPTION_KEY is not set')
  return new Uint8Array(createHash('sha256').update(k, 'utf8').digest())
}

export async function signGmailOAuthState(userId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ purpose: PURPOSE })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(now + 600)
    .sign(secretKey())
}

export async function verifyGmailOAuthState(state: string): Promise<string> {
  const { payload } = await jwtVerify(state, secretKey(), { algorithms: ['HS256'] })
  if (payload.purpose !== PURPOSE) throw new Error('Invalid OAuth state')
  const sub = payload.sub
  if (typeof sub !== 'string' || !sub) throw new Error('Invalid OAuth state')
  return sub
}

/**
 * When Google redirects with an error, `state` may be a JWT we must still validate (CSRF) before showing.
 */
export function safeStatePrefix(state: string | undefined, maxLen = 32): string {
  if (!state) return '—'
  const t = state.trim()
  if (t.length <= maxLen) return t
  return `${t.slice(0, maxLen)}…`
}
