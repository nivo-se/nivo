import type { Pool } from 'pg'
import type { OAuth2Client } from 'google-auth-library'
import { google } from 'googleapis'
import { buildGmailRawMessage } from './build-gmail-raw-message.js'
import { encryptGmailRefreshToken, decryptGmailRefreshToken } from './gmail-token-crypto.js'
import { isGmailOAuthEnvConfigured } from './gmail-oauth-env.js'
import { extractBodiesFromPayload } from './gmail-inbound-parse.js'

/** Requested on connect: send mail, read mail (inbox import), per-user Drive files, calendar, email + profile. */
export const GOOGLE_WORKSPACE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
] as const

export const SCOPE_GMAIL_SEND = 'https://www.googleapis.com/auth/gmail.send'
export const SCOPE_GMAIL_READONLY = 'https://www.googleapis.com/auth/gmail.readonly'
export const SCOPE_DRIVE_FILE = 'https://www.googleapis.com/auth/drive.file'
export const SCOPE_CALENDAR_EVENTS = 'https://www.googleapis.com/auth/calendar.events'

function parseGrantedScopes(raw: string | null | undefined): Set<string> {
  if (!raw?.trim()) return new Set()
  return new Set(raw.split(/\s+/).filter(Boolean))
}

/** Full name from Google userinfo (requires `userinfo.profile`). */
function displayNameFromUserinfo(data: {
  name?: string | null
  given_name?: string | null
  family_name?: string | null
}): string | null {
  const n = data.name?.trim()
  if (n) return n
  const g = data.given_name?.trim() || ''
  const f = data.family_name?.trim() || ''
  const both = [g, f].filter(Boolean).join(' ').trim()
  return both || null
}

export class GmailOutboundService {
  constructor(private readonly pool: Pool) {}

  isReady(): boolean {
    return isGmailOAuthEnvConfigured()
  }

  private makeOAuth2Client() {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim()
    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REDIRECT_URI are required')
    }
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  }

  createAuthorizationUrl(state: string): string {
    const oauth2 = this.makeOAuth2Client()
    return oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [...GOOGLE_WORKSPACE_OAUTH_SCOPES],
      state,
    })
  }

  async exchangeCodeAndStore(userId: string, code: string): Promise<{ google_email: string }> {
    const oauth2 = this.makeOAuth2Client()
    const { tokens } = await oauth2.getToken(code)
    if (!tokens.refresh_token) {
      throw new Error(
        'Google did not return a refresh token. In Google Account → Security → Third-party access, remove this app and try "Connect Gmail" again.'
      )
    }
    oauth2.setCredentials(tokens)
    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 })
    const { data } = await oauth2Api.userinfo.get()
    const email = data.email
    if (!email) throw new Error('Could not read Google account email')

    const displayName = displayNameFromUserinfo({
      name: data.name,
      given_name: data.given_name,
      family_name: data.family_name,
    })
    const enc = encryptGmailRefreshToken(tokens.refresh_token)
    const grantedScopes = typeof tokens.scope === 'string' ? tokens.scope.trim() || null : null
    await this.pool.query(
      `INSERT INTO deep_research.user_gmail_credentials
         (user_id, google_email, refresh_token_enc, granted_scopes, google_display_name)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         google_email = EXCLUDED.google_email,
         refresh_token_enc = EXCLUDED.refresh_token_enc,
         granted_scopes = EXCLUDED.granted_scopes,
         google_display_name = EXCLUDED.google_display_name,
         updated_at = now()`,
      [userId, email.toLowerCase(), enc, grantedScopes, displayName]
    )
    return { google_email: email }
  }

  async getConnection(
    userId: string,
  ): Promise<{
    google_email: string
    google_display_name: string | null
    granted_scopes: string[]
  } | null> {
    const { rows } = await this.pool.query<{
      google_email: string
      granted_scopes: string | null
      google_display_name: string | null
    }>(
      `SELECT google_email, granted_scopes, google_display_name
       FROM deep_research.user_gmail_credentials WHERE user_id = $1`,
      [userId]
    )
    const r = rows[0]
    if (!r) return null
    // Legacy rows: scope not persisted; Gmail send still works until user reconnects for Drive/Calendar.
    const granted_scopes = r.granted_scopes?.trim()
      ? r.granted_scopes.trim().split(/\s+/)
      : [SCOPE_GMAIL_SEND]
    return {
      google_email: r.google_email,
      google_display_name: r.google_display_name?.trim() || null,
      granted_scopes,
    }
  }

  scopeFlags(grantedScopes: string[]) {
    const s = parseGrantedScopes(grantedScopes.join(' '))
    return {
      gmail_send: s.has(SCOPE_GMAIL_SEND),
      gmail_readonly: s.has(SCOPE_GMAIL_READONLY),
      drive_file: s.has(SCOPE_DRIVE_FILE),
      calendar_events: s.has(SCOPE_CALENDAR_EVENTS),
    }
  }

  /** OAuth2 client with refresh token — shared by Gmail, Calendar, and Drive APIs. */
  async getOAuth2ClientForUser(userId: string): Promise<OAuth2Client | null> {
    return this.loadOAuth2ForUser(userId)
  }

  async disconnect(userId: string): Promise<void> {
    await this.pool.query(`DELETE FROM deep_research.user_gmail_credentials WHERE user_id = $1`, [userId])
  }

  private async loadOAuth2ForUser(userId: string) {
    const { rows } = await this.pool.query<{ refresh_token_enc: string }>(
      `SELECT refresh_token_enc FROM deep_research.user_gmail_credentials WHERE user_id = $1`,
      [userId]
    )
    const row = rows[0]
    if (!row) return null
    const refresh = decryptGmailRefreshToken(row.refresh_token_enc)
    const oauth2 = this.makeOAuth2Client()
    oauth2.setCredentials({ refresh_token: refresh })
    return oauth2
  }

  async sendMail(
    userId: string,
    input: {
      to: string
      subject: string
      text: string
      html?: string | null
      fromEmail: string
      /** From userinfo at connect; falls back to `CRM_GMAIL_OUTBOUND_FROM_NAME` env. */
      fromDisplayName?: string | null
      replyTo?: string | null
    }
  ): Promise<{ id: string }> {
    const auth = await this.loadOAuth2ForUser(userId)
    if (!auth) throw new Error('Gmail is not connected for this user')

    const fromDisplay =
      input.fromDisplayName?.trim() || process.env.CRM_GMAIL_OUTBOUND_FROM_NAME?.trim() || null
    const raw = buildGmailRawMessage({
      from: input.fromEmail,
      fromDisplayName: fromDisplay,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      replyTo: input.replyTo,
    })

    const gmail = google.gmail({ version: 'v1', auth })
    const sent = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    })
    const id = sent.data.id
    if (!id) throw new Error('Gmail send returned no message id')
    return { id }
  }

  /** Auth0 subs that have linked Google accounts (any teammate mailbox to scan). */
  async listCredentialUserIds(): Promise<string[]> {
    const { rows } = await this.pool.query<{ user_id: string }>(
      `SELECT user_id FROM deep_research.user_gmail_credentials ORDER BY updated_at DESC`,
    )
    return rows.map((r) => r.user_id)
  }

  /**
   * List Gmail message ids for a query (e.g. `in:inbox newer_than:30d`).
   * Caller must ensure the user granted `gmail.readonly` on the stored refresh token.
   */
  async listInboxMessageIds(userId: string, opts: { maxResults: number; query: string }): Promise<string[]> {
    const auth = await this.loadOAuth2ForUser(userId)
    if (!auth) return []
    const gmail = google.gmail({ version: 'v1', auth })
    const res = await gmail.users.messages.list({
      userId: 'me',
      maxResults: opts.maxResults,
      q: opts.query,
    })
    const ids = res.data.messages?.map((m) => m.id).filter(Boolean) as string[]
    return ids ?? []
  }

  async fetchMessageForInboundSync(
    userId: string,
    messageId: string,
  ): Promise<{
    id: string
    threadId: string
    labelIds: string[]
    fromHeader: string | null
    toHeader: string | null
    subject: string | null
    internalDateMs: string | null
    textBody: string | null
    htmlBody: string | null
    rawPayload: Record<string, unknown>
  } | null> {
    const auth = await this.loadOAuth2ForUser(userId)
    if (!auth) return null
    const gmail = google.gmail({ version: 'v1', auth })
    const res = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    })
    const msg = res.data
    const id = msg.id
    const threadId = msg.threadId
    if (!id || !threadId) return null

    const headers = msg.payload?.headers || []
    const hv = (name: string) =>
      headers.find((x) => (x.name || '').toLowerCase() === name.toLowerCase())?.value?.trim() || null

    const bodies = extractBodiesFromPayload(
      msg.payload as { mimeType?: string | null; body?: { data?: string | null }; parts?: any[] },
    )

    const rawPayload: Record<string, unknown> = {
      id: msg.id,
      threadId: msg.threadId,
      snippet: msg.snippet ?? null,
      internalDate: msg.internalDate ?? null,
      labelIds: msg.labelIds ?? [],
      sizeEstimate: msg.sizeEstimate ?? null,
    }

    return {
      id,
      threadId,
      labelIds: msg.labelIds ?? [],
      fromHeader: hv('From'),
      toHeader: hv('To'),
      subject: hv('Subject'),
      internalDateMs: msg.internalDate ?? null,
      textBody: bodies.text,
      htmlBody: bodies.html,
      rawPayload,
    }
  }
}

export function createGmailOutboundService(pool: Pool | null): GmailOutboundService | null {
  if (!pool || !isGmailOAuthEnvConfigured()) return null
  return new GmailOutboundService(pool)
}
