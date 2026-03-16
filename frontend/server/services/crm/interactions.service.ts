import { CRM_SCHEMA, InteractionType } from './types.js'

export class InteractionsService {
  constructor(private readonly supabase: any) {}

  async create(input: {
    deal_id: string
    contact_id?: string | null
    email_id?: string | null
    type: InteractionType
    summary: string
    metadata?: Record<string, any>
    created_by_user_id?: string | null
  }) {
    const { data, error } = await this.supabase.schema(CRM_SCHEMA).from('interactions').insert(input).select('*').single()
    if (error) throw error
    return data
  }

  async timeline(dealId: string) {
    const { data, error } = await this.supabase
      .schema(CRM_SCHEMA)
      .from('interactions')
      .select('*')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  }
}
