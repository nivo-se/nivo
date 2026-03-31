/**
 * Structured Reply-To for CRM: reply+<token>@<RESEND_REPLY_DOMAIN>
 * Must stay in sync with backend/services/crm_email_inbound/parse.py (tests cover both).
 */

import { randomBytes } from 'crypto'

const TOKEN_RE = /^[a-f0-9]{32}$/

export function generateThreadToken(): string {
  return randomBytes(16).toString('hex')
}

export function buildReplyToAddress(threadToken: string, replyDomain: string): string {
  if (!validateThreadTokenFormat(threadToken)) {
    throw new Error('Invalid thread token format: expected 32 lowercase hex chars')
  }
  const d = replyDomain.trim().toLowerCase()
  if (!d) throw new Error('RESEND_REPLY_DOMAIN is empty')
  return `reply+${threadToken}@${d}`
}

export function validateThreadTokenFormat(token: string): boolean {
  return typeof token === 'string' && TOKEN_RE.test(token)
}

/**
 * Extract token from a full recipient like reply+abc...@send.example.com
 * Returns null if local part does not match reply+<token> or domain mismatch.
 */
export function parseThreadTokenFromRecipient(recipient: string, expectedReplyDomain: string): string | null {
  const trimmed = recipient.trim()
  const at = trimmed.lastIndexOf('@')
  if (at <= 0) return null
  const local = trimmed.slice(0, at).toLowerCase()
  const domain = trimmed.slice(at + 1).toLowerCase()
  if (domain !== expectedReplyDomain.trim().toLowerCase()) return null
  if (!local.startsWith('reply+')) return null
  const token = local.slice('reply+'.length)
  return validateThreadTokenFormat(token) ? token : null
}
