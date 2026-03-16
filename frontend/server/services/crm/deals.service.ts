import { CRM_SCHEMA, DealStatus } from './types.js'

export class DealsService {
  constructor(private readonly supabase: any) {}

  async getOrCreateByCompany(companyId: string) {
    const table = this.supabase.schema(CRM_SCHEMA).from('deals')
    const { data: inserted, error: insertError } = await table
      .insert({ company_id: companyId, status: 'target_identified' satisfies DealStatus })
      .select('*')
      .single()
    if (!insertError) return inserted
    // Unique constraint violation: row exists, fetch it (atomic for concurrent requests)
    if (insertError.code === '23505') {
      const { data: existing, error: selectError } = await table
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle()
      if (selectError) throw selectError
      if (existing) return existing
    }
    throw insertError
  }

  async updateStatus(dealId: string, status: DealStatus) {
    const { data, error } = await this.supabase
      .schema(CRM_SCHEMA)
      .from('deals')
      .update({ status })
      .eq('id', dealId)
      .select('*')
      .single()
    if (error) throw error
    return data
  }

  async touchLastContacted(dealId: string) {
    const { error } = await this.supabase
      .schema(CRM_SCHEMA)
      .from('deals')
      .update({ last_contacted_at: new Date().toISOString() })
      .eq('id', dealId)
    if (error) throw error
  }
}
