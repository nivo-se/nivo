import { randomUUID } from 'crypto'
import type { CrmDb } from './db-interface.js'
import type { InteractionsService } from './interactions.service.js'
import type { ResendEmailService } from '../resend/resend-email.service.js'
import type { DealsService } from './deals.service.js'
import { buildReplyToAddress } from './reply-to-address.js'

export class EmailsService {
  constructor(
    private readonly db: CrmDb,
    private readonly interactions: InteractionsService,
    private readonly resendService: ResendEmailService,
    private readonly dealsService: DealsService,
  ) {}

  buildInstrumentedHtml(baseHtml: string | null | undefined, trackingId: string): string {
    const appBase = (process.env.APP_BASE_URL || 'http://localhost:3001').replace(/\/$/, '')
    const html = baseHtml || ''
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
    const instrumentedHtml = this.buildInstrumentedHtml(input.body_html, trackingId)
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
    const body_html = payload.body_html
      ? this.buildInstrumentedHtml(payload.body_html, email.tracking_id)
      : undefined
    const data = await this.db.updateEmail(emailId, { ...payload, body_html, status: 'approved' })
    return data
  }

  async send(emailId: string) {
    const email = await this.db.getEmailById(emailId)
    if (email.status !== 'approved') throw new Error('Email must be approved before send')

    const contact = await this.db.getContactById(email.contact_id)
    if (!contact?.email) throw new Error('Contact email missing')

    const from =
      process.env.RESEND_FROM_EMAIL || process.env.CRM_SENDER_FROM || process.env.RESEND_FROM
    if (!from) {
      throw new Error('RESEND_FROM_EMAIL (or CRM_SENDER_FROM / RESEND_FROM) is required for CRM send')
    }
    const replyDomain = process.env.RESEND_REPLY_DOMAIN?.trim()
    if (!replyDomain) {
      throw new Error('RESEND_REPLY_DOMAIN is required (e.g. send.nivogroup.se)')
    }

    const { id: threadId, token } = await this.db.ensureCrmEmailThread(email.deal_id, email.contact_id)
    await this.db.updateEmail(emailId, { crm_thread_id: threadId })

    const replyTo = buildReplyToAddress(token, replyDomain)
    const resend = await this.resendService.sendEmail({
      to: contact.email,
      from,
      subject: email.subject,
      bodyText: email.body_text,
      bodyHtml: email.body_html,
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
      html_body: email.body_html,
      dedupe_key: dedupeKey,
      sent_at: new Date().toISOString(),
    })

    const data = await this.db.updateEmail(emailId, {
      status: 'sent',
      outbound_provider_message_id: resend.id,
      sent_at: new Date().toISOString(),
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
