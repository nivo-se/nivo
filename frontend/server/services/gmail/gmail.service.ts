import { Buffer } from 'node:buffer'

interface GmailSendInput {
  to: string
  from: string
  subject: string
  bodyText: string
  bodyHtml?: string | null
}

export class GmailService {
  async sendEmail(input: GmailSendInput): Promise<{ messageId: string | null; threadId: string | null }> {
    const token = await this.getAccessToken()
    const raw = this.buildRawMessage(input)
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Gmail send failed: ${response.status} ${body}`)
    }

    const data = await response.json()
    return { messageId: data.id ?? null, threadId: data.threadId ?? null }
  }

  private buildRawMessage(input: GmailSendInput): string {
    const boundary = `nivo-${Date.now()}`
    const mime = [
      `From: ${input.from}`,
      `To: ${input.to}`,
      `Subject: ${input.subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      input.bodyText,
      '',
      input.bodyHtml
        ? [`--${boundary}`, 'Content-Type: text/html; charset="UTF-8"', '', input.bodyHtml, ''].join('\r\n')
        : '',
      `--${boundary}--`,
    ]
      .filter(Boolean)
      .join('\r\n')

    return Buffer.from(mime).toString('base64url')
  }

  private async getAccessToken(): Promise<string> {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Missing Google OAuth credentials for Gmail API')
    }

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    })

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    })

    if (!response.ok) {
      throw new Error(`Failed to refresh Google token: ${response.status}`)
    }

    const data = await response.json()
    if (!data.access_token) throw new Error('Google token refresh returned no access token')
    return data.access_token as string
  }
}
