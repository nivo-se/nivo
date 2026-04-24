import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import {
  resolveCrmFromAddress,
  resolveCrmReplyDomain,
  getCrmEmailConfigPayload,
} from './crm-resend-env.js'

const ENV_KEYS = [
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'CRM_SENDER_FROM',
  'RESEND_FROM',
  'RESEND_REPLY_DOMAIN',
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'GOOGLE_OAUTH_REDIRECT_URI',
  'GMAIL_OAUTH_ENCRYPTION_KEY',
] as const

describe('crm-resend-env', () => {
  const saved: Record<string, string | undefined> = {}
  for (const k of ENV_KEYS) saved[k] = process.env[k]

  beforeEach(() => {
    for (const k of ENV_KEYS) delete process.env[k]
  })

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })

  it('resolveCrmReplyDomain uses explicit RESEND_REPLY_DOMAIN', () => {
    process.env.RESEND_FROM_EMAIL = 'a@updates.example.com'
    process.env.RESEND_REPLY_DOMAIN = 'inbound.example.com'
    assert.strictEqual(resolveCrmReplyDomain(), 'inbound.example.com')
  })

  it('resolveCrmReplyDomain infers from From when explicit unset', () => {
    process.env.RESEND_FROM_EMAIL = 'outreach@send.acme.se'
    assert.strictEqual(resolveCrmReplyDomain(), 'send.acme.se')
  })

  it('getCrmEmailConfigPayload: configured with key + from only (inferred reply)', () => {
    process.env.RESEND_API_KEY = 're_test'
    process.env.RESEND_FROM_EMAIL = 'hello@verified.example.com'
    const p = getCrmEmailConfigPayload()
    assert.strictEqual(p.resend_configured, true)
    assert.deepStrictEqual(p.missing, [])
    assert.strictEqual(p.reply_domain_inferred, true)
    assert.strictEqual(p.gmail_oauth_server_configured, false)
  })

  it('getCrmEmailConfigPayload: not configured without key', () => {
    process.env.RESEND_FROM_EMAIL = 'hello@verified.example.com'
    const p = getCrmEmailConfigPayload()
    assert.strictEqual(p.resend_configured, false)
    assert.ok(p.missing.some((m) => m.includes('RESEND_API_KEY')))
  })

  it('resolveCrmFromAddress prefers RESEND_FROM_EMAIL over aliases', () => {
    process.env.RESEND_FROM_EMAIL = ' primary@x.com '
    process.env.CRM_SENDER_FROM = 'other@y.com'
    assert.strictEqual(resolveCrmFromAddress(), 'primary@x.com')
  })
})
