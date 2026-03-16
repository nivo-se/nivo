import { randomUUID } from 'crypto'
import { CRM_SCHEMA } from './types.js'
import { InteractionsService } from './interactions.service.js'
import { GmailService } from '../gmail/gmail.service.js'
import { DealsService } from './deals.service.js'

export class EmailsService {
  constructor(
    private readonly supabase: any,
    private readonly interactions: InteractionsService,
    private readonly gmailService: GmailService,
    private readonly dealsService: DealsService,
  ) {}

  buildInstrumentedHtml(baseHtml: string | null | undefined, trackingId: string): string {
    const appBase = (process.env.APP_BASE_URL || 'http://localhost:3001').replace(/\/$/, '')
    const html = baseHtml || ''
    const withLinks = html.replace(/href="(https?:\/\/[^"]+)"/g, (_m: string, href: string) => {
      const wrapped = `${appBase}/track/click/${trackingId}?url=${encodeURIComponent(href)}`
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
    const { data, error } = await this.supabase
      .schema(CRM_SCHEMA)
      .from('emails')
      .insert({
        ...input,
        body_html: instrumentedHtml,
        tracking_id: trackingId,
        status: 'draft',
      })
      .select('*')
      .single()
    if (error) throw error

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
    const body_html = payload.body_html ? this.buildInstrumentedHtml(payload.body_html, (await this.findById(emailId)).tracking_id) : undefined
    const { data, error } = await this.supabase
      .schema(CRM_SCHEMA)
      .from('emails')
      .update({ ...payload, body_html, status: 'approved' })
      .eq('id', emailId)
      .select('*')
      .single()
    if (error) throw error
    return data
  }

  async send(emailId: string) {
    const email = await this.findById(emailId)
    if (email.status !== 'approved') throw new Error('Email must be approved before send')

    const { data: contact } = await this.supabase.schema(CRM_SCHEMA).from('contacts').select('*').eq('id', email.contact_id).single()
    const sender = process.env.GOOGLE_WORKSPACE_SENDER
    if (!sender) throw new Error('GOOGLE_WORKSPACE_SENDER is not configured')

    const gmail = await this.gmailService.sendEmail({
      to: contact.email,
      from: sender,
      subject: email.subject,
      bodyText: email.body_text,
      bodyHtml: email.body_html,
    })

    const { data, error } = await this.supabase
      .schema(CRM_SCHEMA)
      .from('emails')
      .update({
        status: 'sent',
        gmail_message_id: gmail.messageId,
        gmail_thread_id: gmail.threadId,
        sent_at: new Date().toISOString(),
      })
      .eq('id', emailId)
      .select('*')
      .single()
    if (error) throw error

    await this.interactions.create({
      deal_id: email.deal_id,
      contact_id: email.contact_id,
      email_id: email.id,
      type: 'email_sent',
      summary: `Sent email: ${email.subject}`,
    })

    const { count } = await this.supabase
      .schema(CRM_SCHEMA)
      .from('emails')
      .select('id', { count: 'exact', head: true })
      .eq('deal_id', email.deal_id)
      .eq('status', 'sent')
    if (count === 1) await this.dealsService.updateStatus(email.deal_id, 'outreach_sent')
    await this.dealsService.touchLastContacted(email.deal_id)

    return data
  }

  async latestOutboundByDeal(dealId: string) {
    const { data, error } = await this.supabase
      .schema(CRM_SCHEMA)
      .from('emails')
      .select('*')
      .eq('deal_id', dealId)
      .eq('direction', 'outbound')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data
  }

  async findById(emailId: string) {
    const { data, error } = await this.supabase.schema(CRM_SCHEMA).from('emails').select('*').eq('id', emailId).single()
    if (error) throw error
    return data
  }
}
