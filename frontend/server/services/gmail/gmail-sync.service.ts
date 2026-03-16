export interface GmailThreadSyncRecord {
  gmail_thread_id: string
  latest_history_id?: string
}

export class GmailSyncService {
  // TODO(crm-v2): Implement Gmail push/watch setup.
  // TODO(crm-v2): Poll thread history, map replies to deep_research.emails.gmail_thread_id.
  // TODO(crm-v2): Persist inbound reply events as interactions(type=reply_received).
  async syncReplies(_input: GmailThreadSyncRecord[]): Promise<void> {
    return
  }
}
