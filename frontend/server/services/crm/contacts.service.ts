import type { CrmDb } from './db-interface.js'

export class ContactsService {
  constructor(private readonly db: CrmDb) {}

  async listByCompany(companyId: string) {
    return this.db.listContactsByCompany(companyId)
  }

  async create(payload: Record<string, any>) {
    return this.db.createContact(payload)
  }

  async update(contactId: string, payload: Record<string, any>) {
    return this.db.updateContact(contactId, payload)
  }
}
