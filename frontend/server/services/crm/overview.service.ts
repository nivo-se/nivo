import { CRM_SCHEMA } from './types.js'
import { ContactsService } from './contacts.service.js'
import { EmailsService } from './emails.service.js'
import { InteractionsService } from './interactions.service.js'
import { DealsService } from './deals.service.js'

export class CRMOverviewService {
  constructor(
    private readonly supabase: any,
    private readonly dealsService: DealsService,
    private readonly contactsService: ContactsService,
    private readonly emailsService: EmailsService,
    private readonly interactionsService: InteractionsService,
  ) {}

  async companyOverview(companyId: string) {
    const { data: company } = await this.supabase
      .schema(CRM_SCHEMA)
      .from('companies')
      .select('id,name,industry,website,headquarters')
      .eq('id', companyId)
      .single()

    const deal = await this.dealsService.getOrCreateByCompany(companyId)
    const contacts = await this.contactsService.listByCompany(companyId)
    const latestOutboundEmail = await this.emailsService.latestOutboundByDeal(deal.id)
    const timeline = await this.interactionsService.timeline(deal.id)

    const { count: opens } = await this.supabase
      .schema(CRM_SCHEMA)
      .from('tracking_events')
      .select('id', { head: true, count: 'exact' })
      .eq('event_type', 'open')
      .in('email_id', (timeline.filter((t: any) => t.email_id).map((t: any) => t.email_id) || ['00000000-0000-0000-0000-000000000000']))

    const { count: clicks } = await this.supabase
      .schema(CRM_SCHEMA)
      .from('tracking_events')
      .select('id', { head: true, count: 'exact' })
      .eq('event_type', 'click')
      .in('email_id', (timeline.filter((t: any) => t.email_id).map((t: any) => t.email_id) || ['00000000-0000-0000-0000-000000000000']))

    return {
      company,
      deal,
      contacts,
      latest_outbound_email: latestOutboundEmail,
      activity_timeline: timeline,
      next_action: {
        next_action_at: deal.next_action_at,
        status: deal.status,
      },
      engagement_summary: {
        open_count: opens || 0,
        click_count: clicks || 0,
        interaction_count: timeline.length,
      },
    }
  }
}
