import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildReplyToAddress,
  parseThreadTokenFromRecipient,
} from './reply-to-address.ts'

describe('reply-to-address', () => {
  const tok = 'abcdef0123456789abcdef0123456789'
  const dom = 'send.nivogroup.se'

  it('builds and parses Reply-To on the inbound subdomain', () => {
    const addr = buildReplyToAddress(tok, dom)
    assert.equal(addr, `reply+${tok}@${dom}`)
    assert.equal(parseThreadTokenFromRecipient(addr, dom), tok)
  })

  it('rejects token when domain does not match', () => {
    const addr = buildReplyToAddress(tok, dom)
    assert.equal(parseThreadTokenFromRecipient(addr, 'reply.send.nivogroup.se'), null)
  })
})
