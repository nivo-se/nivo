import type { CrmDb } from './db-interface.js'
import type { DealStatus } from './types.js'

export class DealsService {
  constructor(private readonly db: CrmDb) {}

  async getOrCreateByCompany(companyId: string) {
    try {
      return await this.db.insertDeal(companyId)
    } catch (err: any) {
      if (err?.code === '23505') {
        const existing = await this.db.getDealByCompanyId(companyId)
        if (existing) return existing
      }
      throw err
    }
  }

  async updateStatus(dealId: string, status: DealStatus) {
    return this.db.updateDealStatus(dealId, status)
  }

  async touchLastContacted(dealId: string) {
    return this.db.touchDealLastContacted(dealId)
  }
}
