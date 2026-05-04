import type { CrmDb } from './db-interface.js'
import type { GmailOutboundService } from '../gmail/gmail-outbound.service.js'
import { InteractionsService } from './interactions.service.js'
import { DealsService } from './deals.service.js'
import { parseFromHeader, websiteHost, emailDomainMatchesWebsite } from '../gmail/gmail-inbound-parse.js'

export type GmailInboundSyncResult = {
  mailboxes_scanned: number
  messages_fetched: number
  imported: number
  skipped_not_crm: number
  skipped_duplicate: number
  errors: string[]
}

/**
 * Poll Gmail inboxes (read-only API) and append inbound messages to CRM threads when:
 * - From matches a contact email, or
 * - From domain matches a company website host (primary/first contact used for threading).
 * Unrelated mail is left in Gmail only (not stored). All CRM users see imported rows in Postgres.
 */
export class GmailInboundSyncService {
  constructor(
    private readonly db: CrmDb,
    private readonly gmail: GmailOutboundService,
    private readonly interactions: InteractionsService,
    private readonly deals: DealsService,
  ) {}

  async syncUserInbox(auth0UserId: string): Promise<GmailInboundSyncResult> {
    const result: GmailInboundSyncResult = {
      mailboxes_scanned: 0,
      messages_fetched: 0,
      imported: 0,
      skipped_not_crm: 0,
      skipped_duplicate: 0,
      errors: [],
    }

    const conn = await this.gmail.getConnection(auth0UserId)
    if (!conn) return result

    const { gmail_readonly } = this.gmail.scopeFlags(conn.granted_scopes)
    if (!gmail_readonly) {
      result.errors.push(
        'Inbox import needs Gmail read access — disconnect and connect Gmail again to approve the new permission.',
      )
      return result
    }

    result.mailboxes_scanned = 1
    const googleEmail = conn.google_email.toLowerCase()
    const query =
      process.env.CRM_GMAIL_INBOUND_QUERY?.trim() ||
      'in:inbox newer_than:60d -category:promotions'
    const maxRaw = parseInt(process.env.CRM_GMAIL_INBOUND_MAX_MESSAGES || '50', 10)
    const maxResults = Math.min(100, Math.max(5, Number.isFinite(maxRaw) ? maxRaw : 50))

    let ids: string[]
    try {
      ids = await this.gmail.listInboxMessageIds(auth0UserId, { maxResults, query })
    } catch (e) {
      result.errors.push(e instanceof Error ? e.message : String(e))
      return result
    }

    const companiesWithSites = await this.db.listCompaniesWithWebsite()

    for (const mid of ids) {
      result.messages_fetched += 1
      const dedupeKey = `gmail:inbound:${mid}`

      try {
        const full = await this.gmail.fetchMessageForInboundSync(auth0UserId, mid)
        if (!full) continue
        if (full.labelIds.includes('DRAFT')) continue
        if (!full.labelIds.includes('INBOX')) continue

        const fromParsed = parseFromHeader(full.fromHeader)
        if (!fromParsed) {
          result.skipped_not_crm += 1
          continue
        }
        if (fromParsed.email === googleEmail) {
          result.skipped_not_crm += 1
          continue
        }

        const match = await this.resolveCrmRecipient(fromParsed.email, companiesWithSites)
        if (!match) {
          result.skipped_not_crm += 1
          continue
        }

        const deal = await this.deals.getOrCreateByCompany(match.companyId)
        const dealId = deal.id as string
        const { id: threadId } = await this.db.ensureCrmEmailThread(dealId, match.contactId)

        const receivedAt =
          full.internalDateMs && /^\d+$/.test(full.internalDateMs)
            ? new Date(Number(full.internalDateMs)).toISOString()
            : null

        const toList = full.toHeader
          ? full.toHeader
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : null

        const row = await this.db.tryInsertCrmEmailMessage({
          thread_id: threadId,
          direction: 'inbound',
          provider: 'gmail',
          provider_message_id: full.id,
          deep_research_email_id: null,
          from_email: fromParsed.email,
          to_emails: toList,
          subject: full.subject,
          text_body: full.textBody,
          html_body: full.htmlBody,
          raw_payload: full.rawPayload,
          dedupe_key: dedupeKey,
          received_at: receivedAt,
        })

        if (!row) {
          result.skipped_duplicate += 1
          continue
        }

        result.imported += 1

        await this.interactions.create({
          deal_id: dealId,
          contact_id: match.contactId,
          email_id: null,
          type: 'reply_received',
          summary: `Gmail reply: ${full.subject ?? '(no subject)'}`,
          metadata: { gmail_message_id: full.id, from: fromParsed.email },
        })

        await this.deals.touchLastContacted(dealId)

        const dealRow = await this.db.getDealById(dealId)
        if (dealRow?.status === 'outreach_sent') {
          await this.deals.updateStatus(dealId, 'replied')
        }
      } catch (e) {
        result.errors.push(`${mid}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    return result
  }

  private async resolveCrmRecipient(
    fromEmail: string,
    companiesWithSites: { id: string; website: string }[],
  ): Promise<{ companyId: string; contactId: string } | null> {
    const contact = await this.db.findContactByEmailForCrm(fromEmail)
    if (contact?.company_id && contact.id) {
      return { companyId: contact.company_id as string, contactId: contact.id as string }
    }

    const host = fromEmail.split('@')[1]?.toLowerCase()
    if (!host) return null

    for (const c of companiesWithSites) {
      const siteH = websiteHost(c.website)
      if (!siteH) continue
      if (!emailDomainMatchesWebsite(host, siteH)) continue

      const primary = await this.db.getPrimaryOrFirstContact(c.id)
      if (!primary?.id) continue
      return { companyId: c.id, contactId: primary.id as string }
    }

    return null
  }

  async syncAllLinkedMailboxes(): Promise<GmailInboundSyncResult> {
    const aggregated: GmailInboundSyncResult = {
      mailboxes_scanned: 0,
      messages_fetched: 0,
      imported: 0,
      skipped_not_crm: 0,
      skipped_duplicate: 0,
      errors: [],
    }

    const userIds = await this.gmail.listCredentialUserIds()
    for (const uid of userIds) {
      const one = await this.syncUserInbox(uid)
      aggregated.mailboxes_scanned += one.mailboxes_scanned
      aggregated.messages_fetched += one.messages_fetched
      aggregated.imported += one.imported
      aggregated.skipped_not_crm += one.skipped_not_crm
      aggregated.skipped_duplicate += one.skipped_duplicate
      aggregated.errors.push(...one.errors)
    }
    return aggregated
  }
}
