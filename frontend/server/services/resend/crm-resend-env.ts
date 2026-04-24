/**
 * CRM outbound Resend: resolve From + Reply-To domain from env.
 * If RESEND_REPLY_DOMAIN is unset, the domain part of RESEND_FROM_EMAIL is used so
 * a verified sending domain can double as the Reply-To host (receiving must be enabled on that domain in Resend for replies to work).
 */

import { gmailOAuthEnvMissing, isGmailOAuthEnvConfigured } from '../gmail/gmail-oauth-env.js'

export function resolveCrmFromAddress(): string | undefined {
  const v =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.CRM_SENDER_FROM?.trim() ||
    process.env.RESEND_FROM?.trim()
  return v || undefined
}

/** Explicit RESEND_REPLY_DOMAIN, or domain extracted from From (e.g. hello@send.example.com → send.example.com). */
export function resolveCrmReplyDomain(): string | undefined {
  const explicit = process.env.RESEND_REPLY_DOMAIN?.trim()
  if (explicit) return explicit
  const from = resolveCrmFromAddress()
  if (!from?.includes('@')) return undefined
  const domain = from.slice(from.lastIndexOf('@') + 1).trim().toLowerCase()
  if (!domain || domain.includes(' ') || !domain.includes('.')) return undefined
  return domain
}

export function isReplyDomainExplicit(): boolean {
  return Boolean(process.env.RESEND_REPLY_DOMAIN?.trim())
}

export function getCrmEmailConfigPayload(): {
  resend_configured: boolean
  missing: string[]
  reply_domain_inferred: boolean
  gmail_oauth_server_configured: boolean
  gmail_oauth_missing: string[]
} {
  const hasKey = Boolean(process.env.RESEND_API_KEY?.trim())
  const from = resolveCrmFromAddress()
  const replyDomain = resolveCrmReplyDomain()
  const missing: string[] = []
  if (!hasKey) missing.push('RESEND_API_KEY')
  if (!from) missing.push('RESEND_FROM_EMAIL (or CRM_SENDER_FROM / RESEND_FROM)')
  if (!replyDomain) {
    missing.push(
      'RESEND_REPLY_DOMAIN (or set From to an address @ your Resend-verified domain, e.g. outreach@updates.yourdomain.com)'
    )
  }
  const resend_configured = hasKey && Boolean(from) && Boolean(replyDomain)
  const gmail_oauth_server_configured = isGmailOAuthEnvConfigured()
  return {
    resend_configured,
    missing: resend_configured ? [] : missing,
    reply_domain_inferred: resend_configured && !isReplyDomainExplicit(),
    gmail_oauth_server_configured,
    gmail_oauth_missing: gmail_oauth_server_configured ? [] : gmailOAuthEnvMissing(),
  }
}
