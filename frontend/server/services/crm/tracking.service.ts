import type { CrmDb } from './db-interface.js'
import type { InteractionsService } from './interactions.service.js'

export class TrackingService {
  constructor(private readonly db: CrmDb, private readonly interactionsService: InteractionsService) {}

  async trackOpen(trackingId: string, context: Record<string, string | undefined>) {
    return this.track('open', trackingId, context)
  }

  async trackClick(trackingId: string, context: Record<string, string | undefined>) {
    return this.track('click', trackingId, context)
  }

  async track(type: 'open' | 'click', trackingId: string, context: Record<string, any>) {
    const email = await this.db.getEmailByTrackingId(trackingId)

    await this.db.insertTrackingEvent({
      tracking_id: trackingId,
      email_id: email?.id ?? null,
      event_type: type,
      user_agent: context.user_agent ?? null,
      ip_address: context.ip_address ?? null,
      referer: context.referer ?? null,
      redirect_url: context.redirect_url ?? null,
      metadata: context.metadata ?? null,
    })

    if (!email?.id || !email?.deal_id) return
    const count = await this.db.countTrackingEvents(trackingId, type)
    if (count === 1) {
      await this.interactionsService.create({
        deal_id: email.deal_id,
        contact_id: email.contact_id,
        email_id: email.id,
        type: type === 'open' ? 'email_opened' : 'email_clicked',
        summary: type === 'open' ? 'Email opened' : 'Tracked link clicked',
      })
    }
  }
}
