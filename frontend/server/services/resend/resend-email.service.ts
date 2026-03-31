/**
 * Outbound email via Resend HTTP API.
 * Threading (replies in same thread): https://resend.com/docs/dashboard/receiving/reply-to-emails
 * — set headers In-Reply-To (and References for multi-reply) to the inbound message_id from email.received webhooks.
 */
export interface ResendSendInput {
  to: string
  from: string
  subject: string
  bodyText: string
  bodyHtml?: string | null
  cc?: string[]
  bcc?: string[]
  /** Reply-To — CRM structured address reply+<token>@RESEND_REPLY_DOMAIN */
  replyTo?: string | null
  /** RFC 5322 headers, e.g. In-Reply-To / References when replying in-thread. */
  headers?: Record<string, string>
}

export class ResendEmailService {
  async sendEmail(input: ResendSendInput): Promise<{ id: string }> {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) throw new Error('RESEND_API_KEY is not configured')

    const payload: Record<string, unknown> = {
      from: input.from,
      to: [input.to],
      subject: input.subject,
      text: input.bodyText,
    }
    if (input.bodyHtml) payload.html = input.bodyHtml
    if (input.cc?.length) payload.cc = input.cc
    if (input.bcc?.length) payload.bcc = input.bcc
    if (input.replyTo) payload.reply_to = input.replyTo
    if (input.headers && Object.keys(input.headers).length > 0) payload.headers = input.headers

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payload),
    })

    const bodyText = await response.text()
    if (!response.ok) {
      throw new Error(`Resend send failed: ${response.status} ${bodyText}`)
    }

    const data = JSON.parse(bodyText) as { id?: string }
    if (!data.id) throw new Error('Resend send returned no id')
    return { id: data.id }
  }
}
