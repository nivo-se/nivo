import type { CrmDb } from './db-interface.js'
import type { InteractionsService } from './interactions.service.js'

export class SequencesService {
  constructor(private readonly db: CrmDb, private readonly interactions: InteractionsService) {}

  async getDefaultSequenceId(): Promise<string | null> {
    return this.db.getDefaultSequenceId()
  }

  async enrollDeal(dealId: string, sequenceId: string) {
    const data = await this.db.upsertDealSequenceEnrollment(dealId, sequenceId)

    await this.interactions.create({
      deal_id: dealId,
      type: 'sequence_enrolled',
      summary: 'Deal enrolled in sequence',
      metadata: { sequence_id: sequenceId },
    })

    return data
  }
}
