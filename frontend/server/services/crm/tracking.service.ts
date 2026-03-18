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

  async trackPageView(trackingId: string, context: Record<string, string | undefined>) {
    return this.track('page_view', trackingId, context)
  }

  async trackSectionView(trackingId: string, sectionId: string, context: Record<string, string | undefined>) {
    return this.track('section_view', trackingId, { ...context, metadata: { section_id: sectionId } })
  }

  async track(type: 'open' | 'click' | 'page_view' | 'section_view', trackingId: string, context: Record<string, any>) {
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
      const interactionType =
        type === 'open'
          ? 'email_opened'
          : type === 'click'
            ? 'email_clicked'
            : type === 'page_view'
              ? 'email_clicked'
              : null
      const summary =
        type === 'open'
          ? 'Email opened'
          : type === 'click'
            ? 'Tracked link clicked'
            : type === 'page_view'
              ? 'Intro page viewed'
              : 'Tracked'
      if (interactionType) {
        await this.interactionsService.create({
          deal_id: email.deal_id,
          contact_id: email.contact_id,
          email_id: email.id,
          type: interactionType,
          summary,
        })
      }
      // section_view events are stored in tracking_events only (metadata.section_id)
      // for analytics; no interaction created to avoid timeline noise
    }
  }
}
