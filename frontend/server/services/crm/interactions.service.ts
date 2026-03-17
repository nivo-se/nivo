import type { CrmDb } from './db-interface.js'
import type { InteractionType } from './types.js'

export class InteractionsService {
  constructor(private readonly db: CrmDb) {}

  async create(input: {
    deal_id: string
    contact_id?: string | null
    email_id?: string | null
    type: InteractionType
    summary: string
    metadata?: Record<string, any>
    created_by_user_id?: string | null
  }) {
    const payload: Record<string, any> = { ...input }
    if (payload.contact_id === undefined) delete payload.contact_id
    if (payload.email_id === undefined) delete payload.email_id
    if (payload.metadata === undefined) delete payload.metadata
    if (payload.created_by_user_id === undefined) delete payload.created_by_user_id
    return this.db.insertInteraction(payload)
  }

  async timeline(dealId: string) {
    return this.db.getTimelineByDeal(dealId)
  }
}
