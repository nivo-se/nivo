import type { CrmDb } from './db-interface.js'
import { ContactsService } from './contacts.service.js'
import { EmailsService } from './emails.service.js'
import { InteractionsService } from './interactions.service.js'
import { DealsService } from './deals.service.js'

export class CRMOverviewService {
  constructor(
    private readonly db: CrmDb,
    private readonly dealsService: DealsService,
    private readonly contactsService: ContactsService,
    private readonly emailsService: EmailsService,
    private readonly interactionsService: InteractionsService,
  ) {}

  async companyOverview(companyId: string) {
    const company = await this.db.getCompany(companyId)
    const deal = await this.dealsService.getOrCreateByCompany(companyId)
    const contacts = await this.contactsService.listByCompany(companyId)
    const latestOutboundEmail = await this.emailsService.latestOutboundByDeal(deal.id)
    const timeline = await this.interactionsService.timeline(deal.id)

    const emailIds = timeline.filter((t: any) => t.email_id).map((t: any) => t.email_id)
    const opens = emailIds.length
      ? await this.db.countTrackingEventsByEmailIds(emailIds, 'open')
      : 0
    const clicks = emailIds.length
      ? await this.db.countTrackingEventsByEmailIds(emailIds, 'click')
      : 0

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
        open_count: opens,
        click_count: clicks,
        interaction_count: timeline.length,
      },
    }
  }
}
