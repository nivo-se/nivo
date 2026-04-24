import { describe, it } from 'node:test'
import assert from 'node:assert'
import { buildGmailRawMessage } from './build-gmail-raw-message.js'

describe('buildGmailRawMessage', () => {
  it('produces decodable base64url with plain subject', () => {
    const raw = buildGmailRawMessage({
      from: 'me@example.com',
      to: 'you@other.com',
      subject: 'Hello',
      text: 'Body',
    })
    const pad = raw.length % 4 === 0 ? raw : raw + '='.repeat(4 - (raw.length % 4))
    const b64 = pad.replace(/-/g, '+').replace(/_/g, '/')
    const msg = Buffer.from(b64, 'base64').toString('utf8')
    assert.ok(msg.includes('From: me@example.com'))
    assert.ok(msg.includes('To: you@other.com'))
  })
})
