import { randomUUID } from 'crypto'
import type { CrmDb } from './db-interface.js'
import type { InteractionsService } from './interactions.service.js'
import type { GmailService } from '../gmail/gmail.service.js'
import type { DealsService } from './deals.service.js'

export class EmailsService {
  constructor(
    private readonly db: CrmDb,
    private readonly interactions: InteractionsService,
    private readonly gmailService: GmailService,
    private readonly dealsService: DealsService,
  ) {}

  buildInstrumentedHtml(baseHtml: string | null | undefined, trackingId: string): string {
    const appBase = (process.env.APP_BASE_URL || 'http://localhost:3001').replace(/\/$/, '')
    const html = baseHtml || ''
    const withLinks = html.replace(/href="(https?:\/\/[^"]+)"/g, (_m: string, href: string) => {
      // Append tid to sellers page links so the page can report page_view and section_view
      let targetUrl = href
      try {
        const u = new URL(href)
        if (u.pathname === '/sellers' || u.pathname.endsWith('/sellers')) {
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
    const sender = process.env.GOOGLE_WORKSPACE_SENDER
    if (!sender) throw new Error('GOOGLE_WORKSPACE_SENDER is not configured')

    const gmail = await this.gmailService.sendEmail({
      to: contact.email,
      from: sender,
      subject: email.subject,
      bodyText: email.body_text,
      bodyHtml: email.body_html,
    })

    const data = await this.db.updateEmail(emailId, {
      status: 'sent',
      gmail_message_id: gmail.messageId,
      gmail_thread_id: gmail.threadId,
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
