import { CRM_SCHEMA } from './types.js'

export class ContactsService {
  constructor(private readonly supabase: any) {}

  async listByCompany(companyId: string) {
    const { data, error } = await this.supabase
      .schema(CRM_SCHEMA)
      .from('contacts')
      .select('*')
      .eq('company_id', companyId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  }

  async create(payload: Record<string, any>) {
    if (payload.is_primary) {
      await this.clearPrimary(payload.company_id)
    }
    const { data, error } = await this.supabase.schema(CRM_SCHEMA).from('contacts').insert(payload).select('*').single()
    if (error) throw error
    return data
  }

  async update(contactId: string, payload: Record<string, any>) {
    if (payload.is_primary) {
      const { data: contact } = await this.supabase.schema(CRM_SCHEMA).from('contacts').select('company_id').eq('id', contactId).single()
      if (contact?.company_id) await this.clearPrimary(contact.company_id)
    }
    const { data, error } = await this.supabase
      .schema(CRM_SCHEMA)
      .from('contacts')
      .update(payload)
      .eq('id', contactId)
      .select('*')
      .single()
    if (error) throw error
    return data
  }

  private async clearPrimary(companyId: string) {
    await this.supabase.schema(CRM_SCHEMA).from('contacts').update({ is_primary: false }).eq('company_id', companyId).eq('is_primary', true)
  }
}
