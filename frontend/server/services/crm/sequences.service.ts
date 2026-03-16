import { CRM_SCHEMA } from './types.js'
import { InteractionsService } from './interactions.service.js'

export class SequencesService {
  constructor(private readonly supabase: any, private readonly interactions: InteractionsService) {}

  async getDefaultSequenceId(): Promise<string | null> {
    const { data } = await this.supabase
      .schema(CRM_SCHEMA)
      .from('sequences')
      .select('id')
      .eq('name', 'Default Origination Sequence')
      .maybeSingle()
    return data?.id ?? null
  }

  async enrollDeal(dealId: string, sequenceId: string) {
    const { data, error } = await this.supabase
      .schema(CRM_SCHEMA)
      .from('deal_sequence_enrollments')
      .upsert({ deal_id: dealId, sequence_id: sequenceId, status: 'active' }, { onConflict: 'deal_id,sequence_id' })
      .select('*')
      .single()
    if (error) throw error

    await this.interactions.create({
      deal_id: dealId,
      type: 'sequence_enrolled',
      summary: 'Deal enrolled in sequence',
      metadata: { sequence_id: sequenceId },
    })

    return data
  }
}
