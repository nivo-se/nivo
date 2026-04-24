import type { Pool } from 'pg'
import type { OAuth2Client } from 'google-auth-library'
import { google } from 'googleapis'
import { buildGmailRawMessage } from './build-gmail-raw-message.js'
import { encryptGmailRefreshToken, decryptGmailRefreshToken } from './gmail-token-crypto.js'
import { isGmailOAuthEnvConfigured } from './gmail-oauth-env.js'

/** Requested on connect: send mail, per-user Drive files created by this app, calendar events, email for display. */
export const GOOGLE_WORKSPACE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
] as const

export const SCOPE_GMAIL_SEND = 'https://www.googleapis.com/auth/gmail.send'
export const SCOPE_DRIVE_FILE = 'https://www.googleapis.com/auth/drive.file'
export const SCOPE_CALENDAR_EVENTS = 'https://www.googleapis.com/auth/calendar.events'

function parseGrantedScopes(raw: string | null | undefined): Set<string> {
  if (!raw?.trim()) return new Set()
  return new Set(raw.split(/\s+/).filter(Boolean))
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

    const enc = encryptGmailRefreshToken(tokens.refresh_token)
    const grantedScopes = typeof tokens.scope === 'string' ? tokens.scope.trim() || null : null
    await this.pool.query(
      `INSERT INTO deep_research.user_gmail_credentials (user_id, google_email, refresh_token_enc, granted_scopes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         google_email = EXCLUDED.google_email,
         refresh_token_enc = EXCLUDED.refresh_token_enc,
         granted_scopes = EXCLUDED.granted_scopes,
         updated_at = now()`,
      [userId, email.toLowerCase(), enc, grantedScopes]
    )
    return { google_email: email }
  }

  async getConnection(
    userId: string,
  ): Promise<{ google_email: string; granted_scopes: string[] } | null> {
    const { rows } = await this.pool.query<{ google_email: string; granted_scopes: string | null }>(
      `SELECT google_email, granted_scopes FROM deep_research.user_gmail_credentials WHERE user_id = $1`,
      [userId]
    )
    const r = rows[0]
    if (!r) return null
    // Legacy rows: scope not persisted; Gmail send still works until user reconnects for Drive/Calendar.
    const granted_scopes = r.granted_scopes?.trim()
      ? r.granted_scopes.trim().split(/\s+/)
      : [SCOPE_GMAIL_SEND]
    return { google_email: r.google_email, granted_scopes }
  }

  scopeFlags(grantedScopes: string[]) {
    const s = parseGrantedScopes(grantedScopes.join(' '))
    return {
      gmail_send: s.has(SCOPE_GMAIL_SEND),
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
      replyTo?: string | null
    }
  ): Promise<{ id: string }> {
    const auth = await this.loadOAuth2ForUser(userId)
    if (!auth) throw new Error('Gmail is not connected for this user')

    const raw = buildGmailRawMessage({
      from: input.fromEmail,
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
}

export function createGmailOutboundService(pool: Pool | null): GmailOutboundService | null {
  if (!pool || !isGmailOAuthEnvConfigured()) return null
  return new GmailOutboundService(pool)
}
