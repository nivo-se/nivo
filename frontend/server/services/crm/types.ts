import { SupabaseClient } from '@supabase/supabase-js'

export const CRM_SCHEMA = 'deep_research'

export type DealStatus =
  | 'target_identified'
  | 'outreach_ready'
  | 'outreach_sent'
  | 'replied'
  | 'in_dialogue'
  | 'meeting_scheduled'
  | 'declined'
  | 'parked'
  | 'closed'

export type EmailStatus = 'draft' | 'approved' | 'sent' | 'bounced' | 'failed' | 'replied'

export type InteractionType =
  | 'email_generated'
  | 'email_sent'
  | 'email_opened'
  | 'email_clicked'
  | 'reply_received'
  | 'note_added'
  | 'reminder_created'
  | 'reminder_completed'
  | 'sequence_enrolled'
  | 'sequence_advanced'
  | 'meeting_logged'
  | 'status_changed'

export interface CRMDependencies {
  supabase: SupabaseClient
}

export interface OutreachDraft {
  subject: string
  body_text: string
  body_html: string
  prompt_version: string
}
