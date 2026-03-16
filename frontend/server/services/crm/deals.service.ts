import { CRM_SCHEMA, DealStatus } from './types.js'

export class DealsService {
  constructor(private readonly supabase: any) {}

  async getOrCreateByCompany(companyId: string) {
    const query = this.supabase.schema(CRM_SCHEMA).from('deals')
    const { data: existing } = await query.select('*').eq('company_id', companyId).maybeSingle()
    if (existing) return existing

    const { data, error } = await query
      .insert({ company_id: companyId, status: 'target_identified' satisfies DealStatus })
      .select('*')
      .single()
    if (error) throw error
    return data
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
