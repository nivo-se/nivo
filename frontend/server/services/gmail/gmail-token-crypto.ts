import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

const TAG_LEN = 16
const IV_LEN = 12
const ALGO = 'aes-256-gcm' as const

function key32(): Buffer {
  const k = process.env.GMAIL_OAUTH_ENCRYPTION_KEY?.trim()
  if (!k) {
    throw new Error('GMAIL_OAUTH_ENCRYPTION_KEY is not set (32-byte value as base64 or hex)')
  }
  if (k.length === 64 && /^[0-9a-fA-F]+$/.test(k)) {
    return Buffer.from(k, 'hex')
  }
  if (k.length === 44 || k.length === 43) {
    const b = Buffer.from(k, 'base64')
    if (b.length === 32) return b
  }
  return scryptSync(k, 'nivo-gmail-oauth', 32)
}

/**
 * Sealed string: base64(iv || ciphertext+tag) for storage in Postgres.
 */
export function encryptGmailRefreshToken(plain: string): string {
  const key = key32()
  if (key.length !== 32) {
    throw new Error('GMAIL_OAUTH_ENCRYPTION_KEY must resolve to 32 bytes')
  }
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: TAG_LEN })
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final(), cipher.getAuthTag()])
  return Buffer.concat([iv, enc]).toString('base64')
}

export function decryptGmailRefreshToken(stored: string): string {
  const key = key32()
  if (key.length !== 32) {
    throw new Error('GMAIL_OAUTH_ENCRYPTION_KEY must resolve to 32 bytes')
  }
  const raw = Buffer.from(stored, 'base64')
  if (raw.length < IV_LEN + TAG_LEN) {
    throw new Error('Invalid stored Gmail token')
  }
  const iv = raw.subarray(0, IV_LEN)
  const tag = raw.subarray(raw.length - TAG_LEN)
  const data = raw.subarray(IV_LEN, raw.length - TAG_LEN)
  const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: TAG_LEN })
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
