/**
 * CRM database interface – implemented by PostgresCrmDb.
 */

export interface CrmCompanyListItem {
  id: string
  orgnr?: string | null
  name: string
  industry: string | null
  website: string | null
  deal_status: string | null
  last_contacted_at: string | null
}

/** Recent inbound CRM message with thread/company for Inbox tab */
export interface CrmInboundRecentRow {
  id: string
  thread_id: string
  subject: string | null
  text_body: string | null
  received_at: string | null
  created_at: string
  company_id: string
  company_name: string | null
  deal_id: string
  contact_id: string
  contact_email: string | null
}

/** Recent outbound CRM email (for the global "Sent" home feed) */
export interface CrmRecentSentRow {
  id: string
  deal_id: string
  contact_id: string | null
  company_id: string | null
  company_name: string | null
  contact_name: string | null
  contact_email: string | null
  subject: string
  status: string
  sent_at: string | null
  created_at: string
  tracking_id: string | null
}

export interface CrmInboundUnmatchedRow {
  id: string
  token_attempted: string | null
  from_email: string | null
  to_email: string | null
  subject: string | null
  provider_inbound_email_id: string | null
  created_at: string
}

export interface CrmDb {
  listCompanies(search?: string, limit?: number, sort?: 'name' | 'last_contact'): Promise<CrmCompanyListItem[]>
  getCompany(id: string): Promise<Record<string, any> | null>
  getCompanyByOrgnr(orgnr: string): Promise<Record<string, any> | null>
  patchCompany(companyId: string, fields: { industry?: string | null; website?: string | null }): Promise<Record<string, any> | null>
  insertDeal(companyId: string): Promise<Record<string, any>>
  getDealByCompanyId(companyId: string): Promise<Record<string, any> | null>
  getDealById(dealId: string): Promise<Record<string, any> | null>
  updateDealStatus(dealId: string, status: string): Promise<Record<string, any>>
  patchDeal(dealId: string, fields: { next_action_at?: string | null }): Promise<Record<string, any> | null>
  touchDealLastContacted(dealId: string): Promise<void>
  listContactsByCompany(companyId: string): Promise<Record<string, any>[]>
  createContact(payload: Record<string, any>): Promise<Record<string, any>>
  updateContact(contactId: string, payload: Record<string, any>): Promise<Record<string, any>>
  clearPrimaryContact(companyId: string): Promise<void>
  getContactById(id: string): Promise<Record<string, any> | null>
  insertEmail(payload: Record<string, any>): Promise<Record<string, any>>
  updateEmail(emailId: string, payload: Record<string, any>): Promise<Record<string, any>>
  getEmailById(id: string): Promise<Record<string, any> | null>
  getLatestOutboundEmailByDeal(dealId: string): Promise<Record<string, any> | null>
  listOutboundEmailsByDeal(dealId: string): Promise<Record<string, any>[]>
  countSentEmailsByDeal(dealId: string): Promise<number>
  getEmailByTrackingId(trackingId: string): Promise<Record<string, any> | null>
  insertInteraction(payload: Record<string, any>): Promise<Record<string, any>>
  getTimelineByDeal(dealId: string): Promise<Record<string, any>[]>
  insertTrackingEvent(payload: Record<string, any>): Promise<void>
  countTrackingEvents(trackingId: string, eventType: string): Promise<number>
  countTrackingEventsByEmailIds(emailIds: string[], eventType: string): Promise<number>
  getDefaultSequenceId(): Promise<string | null>
  upsertDealSequenceEnrollment(dealId: string, sequenceId: string): Promise<Record<string, any>>
  getCompanyProfile(companyId: string): Promise<Record<string, any> | null>
  getStrategy(companyId: string): Promise<Record<string, any> | null>
  getValueCreation(companyId: string): Promise<Record<string, any> | null>

  /** One thread per (deal, contact); token used in Reply-To. */
  ensureCrmEmailThread(dealId: string, contactId: string): Promise<{ id: string; token: string }>
  insertCrmEmailMessage(payload: Record<string, any>): Promise<Record<string, any>>
  listCrmEmailMessagesByThreadId(threadId: string): Promise<Record<string, any>[]>

  listRecentInboundMessages(limit: number): Promise<CrmInboundRecentRow[]>
  listInboundUnmatched(limit: number): Promise<CrmInboundUnmatchedRow[]>

  /** Recent outbound emails across all deals, joined with company/contact for the Sent feed. */
  listRecentOutboundEmails(limit: number): Promise<CrmRecentSentRow[]>

  /** My List membership (orgnrs) for batch draft generation */
  listSavedListOrgnrs(listId: string): Promise<string[]>
  savedListExists(listId: string): Promise<boolean>

  /** Create minimal company row (e.g. external prospect). orgnr must be unique. */
  insertCompany(payload: { orgnr: string; name: string; website?: string | null }): Promise<Record<string, any>>
  /** Resolve deep_research company by Swedish orgnr; create from public.companies or placeholder if missing */
  resolveOrCreateCompanyByOrgnr(orgnr: string): Promise<{ id: string } | null>

  /** Primary contact for company, or first by recency */
  getPrimaryOrFirstContact(companyId: string): Promise<Record<string, any> | null>

  findContactByEmailForCrm(email: string): Promise<Record<string, any> | null>
  listCompaniesWithWebsite(): Promise<{ id: string; website: string }[]>
  tryInsertCrmEmailMessage(payload: Record<string, any>): Promise<Record<string, any> | null>
}
