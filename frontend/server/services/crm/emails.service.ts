import { randomUUID } from 'crypto'
import type { CrmDb } from './db-interface.js'
import type { InteractionsService } from './interactions.service.js'
import type { ResendEmailService } from '../resend/resend-email.service.js'
import type { DealsService } from './deals.service.js'
import type { GmailOutboundService } from '../gmail/gmail-outbound.service.js'
import { buildReplyToAddress } from './reply-to-address.js'
import { resolveCrmFromAddress, resolveCrmReplyDomain } from '../resend/crm-resend-env.js'
import { isOpenPixelOnlyOrEmpty, plainTextToSimpleEmailHtml } from './plain-text-to-html.js'

export type CrmSendProvider = 'auto' | 'resend' | 'gmail'

export type SendEmailOptions = {
  sendProvider?: CrmSendProvider
  /** Auth0 `sub` — used for Gmail send and for `auto` when the user has connected Gmail. */
  auth0Sub?: string | null
}

export class EmailsService {
  constructor(
    private readonly db: CrmDb,
    private readonly interactions: InteractionsService,
    private readonly resendService: ResendEmailService,
    private readonly dealsService: DealsService,
    private readonly gmail: GmailOutboundService | null = null,
  ) {}

  /**
   * @param bodyTextFallback — when `baseHtml` is empty, we wrap this as simple HTML so the MIME
   *  `text/html` part is not just the open-tracking pixel.
   */
  buildInstrumentedHtml(
    baseHtml: string | null | undefined,
    trackingId: string,
    bodyTextFallback?: string | null,
  ): string {
    const appBase = (process.env.APP_BASE_URL || 'http://localhost:3001').replace(/\/$/, '')
    const trimmed = baseHtml?.trim() ?? ''
    const html =
      trimmed
        ? baseHtml as string
        : bodyTextFallback?.trim()
          ? plainTextToSimpleEmailHtml(bodyTextFallback)
          : ''
    const withLinks = html.replace(/href="(https?:\/\/[^"]+)"/g, (_m: string, href: string) => {
      let targetUrl = href
      try {
        const u = new URL(href)
        if (u.pathname === '/intro' || u.pathname.endsWith('/intro') || u.pathname === '/sellers' || u.pathname.endsWith('/sellers')) {
          u.searchParams.set('tid', trackingId)
          targetUrl = u.toString()
        }
      } catch {
        // leave href as-is if URL parsing fails
      }
      const wrapped = `${appBase}/track/click/${trackingId}?url=${encodeURIComponent(targetUrl)}`
      return `href="${wrapped}"`
    })
    const pixel = `<img src="${appBase}/track/open/${trackingId}" width="1" height="1" style="display:none;" alt="" />`
    return `${withLinks}${pixel}`
  }

  async createDraft(input: {
    deal_id: string
    contact_id: string
    subject: string
    body_text: string
    body_html?: string
    ai_prompt_version?: string
    generation_context?: Record<string, any>
  }) {
    const trackingId = randomUUID()
    const instrumentedHtml = this.buildInstrumentedHtml(
      input.body_html,
      trackingId,
      input.body_text,
    )
    const data = await this.db.insertEmail({
      ...input,
      body_html: instrumentedHtml,
      tracking_id: trackingId,
      status: 'draft',
      direction: 'outbound',
    })

    await this.interactions.create({
      deal_id: input.deal_id,
      contact_id: input.contact_id,
      email_id: data.id,
      type: 'email_generated',
      summary: `Generated outreach draft: ${input.subject}`,
    })

    return data
  }

  async approve(emailId: string, payload: Record<string, any>) {
    const email = await this.db.getEmailById(emailId)
    let body_html: string | undefined
    if (payload.body_html) {
      body_html = this.buildInstrumentedHtml(
        payload.body_html,
        email.tracking_id,
        payload.body_text ?? email.body_text,
      )
    } else if (payload.body_text !== undefined) {
      body_html = this.buildInstrumentedHtml(
        null,
        email.tracking_id,
        payload.body_text,
      )
    }
    const data = await this.db.updateEmail(emailId, { ...payload, body_html, status: 'approved' })
    return data
  }

  async send(emailId: string, options: SendEmailOptions = {}) {
    const email = await this.db.getEmailById(emailId)
    if (email.status !== 'approved') throw new Error('Email must be approved before send')

    const contact = await this.db.getContactById(email.contact_id)
    if (!contact?.email) throw new Error('Contact email missing')

    const sendProvider: CrmSendProvider = options.sendProvider ?? 'auto'
    const auth0Sub = options.auth0Sub ?? null

    let useGmail = false
    if (sendProvider === 'gmail') {
      if (!this.gmail) throw new Error('Gmail send is not configured (set Google OAuth env vars on the server)')
      if (!auth0Sub) throw new Error('Sign in is required to send from your Google account')
      const conn = await this.gmail.getConnection(auth0Sub)
      if (!conn) throw new Error('Connect Gmail in the CRM mailbox first (Connect Gmail).')
      useGmail = true
    } else if (sendProvider === 'resend') {
      useGmail = false
    } else {
      if (this.gmail && auth0Sub) {
        const conn = await this.gmail.getConnection(auth0Sub)
        useGmail = Boolean(conn)
      } else {
        useGmail = false
      }
    }

    const { id: threadId, token } = await this.db.ensureCrmEmailThread(email.deal_id, email.contact_id)
    await this.db.updateEmail(emailId, { crm_thread_id: threadId })

    const replyDomain = resolveCrmReplyDomain()
    const replyTo =
      replyDomain && token ? buildReplyToAddress(token, replyDomain) : undefined

    const storedHtml = email.body_html
    let outboundHtml = storedHtml
    if (isOpenPixelOnlyOrEmpty(outboundHtml)) {
      outboundHtml = this.buildInstrumentedHtml(
        null,
        email.tracking_id as string,
        email.body_text,
      )
    }
    const persistRepairedHtml = isOpenPixelOnlyOrEmpty(storedHtml) && Boolean(outboundHtml)

    if (useGmail && this.gmail && auth0Sub) {
      const conn = await this.gmail.getConnection(auth0Sub)
      if (!conn) throw new Error('Gmail connection was removed; connect Gmail again.')
      const gmsg = await this.gmail.sendMail(auth0Sub, {
        to: contact.email,
        subject: email.subject,
        text: email.body_text,
        html: outboundHtml,
        fromEmail: conn.google_email,
        fromDisplayName: conn.google_display_name,
        replyTo: replyTo ?? null,
      })

      const dedupeKey = `gmail:sent:${gmsg.id}`
      await this.db.insertCrmEmailMessage({
        thread_id: threadId,
        direction: 'outbound',
        provider: 'gmail',
        provider_message_id: gmsg.id,
        deep_research_email_id: emailId,
        from_email: conn.google_email,
        to_emails: [contact.email],
        subject: email.subject,
        text_body: email.body_text,
        html_body: outboundHtml,
        dedupe_key: dedupeKey,
        sent_at: new Date().toISOString(),
      })

      const data = await this.db.updateEmail(emailId, {
        status: 'sent',
        outbound_provider_message_id: gmsg.id,
        sent_at: new Date().toISOString(),
        ...(persistRepairedHtml ? { body_html: outboundHtml } : {}),
      })

      await this.interactions.create({
        deal_id: email.deal_id,
        contact_id: email.contact_id,
        email_id: email.id,
        type: 'email_sent',
        summary: `Sent email: ${email.subject}`,
      })

      const count = await this.db.countSentEmailsByDeal(email.deal_id)
      if (count === 1) await this.dealsService.updateStatus(email.deal_id, 'outreach_sent')
      await this.dealsService.touchLastContacted(email.deal_id)

      return data
    }

    const from = resolveCrmFromAddress()
    if (!from) {
      throw new Error('RESEND_FROM_EMAIL (or CRM_SENDER_FROM / RESEND_FROM) is required for CRM send via Resend')
    }
    if (!replyDomain) {
      throw new Error(
        'RESEND_REPLY_DOMAIN is required, or set From to user@your-verified-domain so Reply-To can use that domain'
      )
    }
    if (!replyTo) {
      throw new Error('Could not build Reply-To for this thread; check RESEND_REPLY_DOMAIN.')
    }

    const resend = await this.resendService.sendEmail({
      to: contact.email,
      from,
      subject: email.subject,
      bodyText: email.body_text,
      bodyHtml: outboundHtml,
      replyTo,
    })

    const dedupeKey = `resend:sent:${resend.id}`
    await this.db.insertCrmEmailMessage({
      thread_id: threadId,
      direction: 'outbound',
      provider: 'resend',
      provider_message_id: resend.id,
      deep_research_email_id: emailId,
      from_email: from,
      to_emails: [contact.email],
      subject: email.subject,
      text_body: email.body_text,
      html_body: outboundHtml,
      dedupe_key: dedupeKey,
      sent_at: new Date().toISOString(),
    })

    const data = await this.db.updateEmail(emailId, {
      status: 'sent',
      outbound_provider_message_id: resend.id,
      sent_at: new Date().toISOString(),
      ...(persistRepairedHtml ? { body_html: outboundHtml } : {}),
    })

    await this.interactions.create({
      deal_id: email.deal_id,
      contact_id: email.contact_id,
      email_id: email.id,
      type: 'email_sent',
      summary: `Sent email: ${email.subject}`,
    })

    const count = await this.db.countSentEmailsByDeal(email.deal_id)
    if (count === 1) await this.dealsService.updateStatus(email.deal_id, 'outreach_sent')
    await this.dealsService.touchLastContacted(email.deal_id)

    return data
  }

  async latestOutboundByDeal(dealId: string) {
    return this.db.getLatestOutboundEmailByDeal(dealId)
  }

  async findById(emailId: string) {
    return this.db.getEmailById(emailId)
  }
}
