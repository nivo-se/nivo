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

export interface CrmDb {
  listCompanies(search?: string, limit?: number): Promise<CrmCompanyListItem[]>
  getCompany(id: string): Promise<Record<string, any> | null>
  getCompanyByOrgnr(orgnr: string): Promise<Record<string, any> | null>
  insertDeal(companyId: string): Promise<Record<string, any>>
  getDealByCompanyId(companyId: string): Promise<Record<string, any> | null>
  updateDealStatus(dealId: string, status: string): Promise<Record<string, any>>
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
}
