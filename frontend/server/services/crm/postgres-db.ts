/**
 * Postgres-backed CRM database client.
 * Implements CrmDb for use with local Postgres (Mac mini / docker).
 * Uses local Postgres (Mac mini / docker).
 * Configure via POSTGRES_* or DATABASE_URL in .env.
 */

import pg from 'pg'
import { PG_POOL_OPTIONS, attachPoolErrorLogging } from '../../pg-pool-options.js'

const { Pool } = pg

const SCHEMA = 'deep_research'

function getConnectionConfig(): pg.PoolConfig {
  const url = process.env.DATABASE_URL
  if (url) return { connectionString: url, ...PG_POOL_OPTIONS }
  const host = process.env.POSTGRES_HOST || 'localhost'
  const port = Number(process.env.POSTGRES_PORT || 5433)
  const database = process.env.POSTGRES_DB || 'nivo'
  const user = process.env.POSTGRES_USER || 'nivo'
  const password = process.env.POSTGRES_PASSWORD || 'nivo'
  return { host, port, database, user, password, ...PG_POOL_OPTIONS }
}

let pool: pg.Pool | null = null

export function getCrmPool(): pg.Pool | null {
  if (pool) return pool
  const config = getConnectionConfig()
  try {
    pool = new Pool(config)
    attachPoolErrorLogging(pool, 'CRM')
    return pool
  } catch (err) {
    console.error('[CRM] Postgres pool init failed:', err)
    return null
  }
}

export function isCrmPostgresConfigured(): boolean {
  return true
}

import type { CrmDb, CrmInboundRecentRow, CrmInboundUnmatchedRow, CrmRecentSentRow } from './db-interface.js'
import { generateThreadToken } from './reply-to-address.js'

/** Postgres-backed CRM DB. */
export class PostgresCrmDb implements CrmDb {
  constructor(private readonly pool: pg.Pool) {}

  private async query<T = any>(text: string, params?: any[]): Promise<{ rows: T[] }> {
    const result = await this.pool.query(text, params)
    return { rows: result.rows }
  }

  // ─── Companies ─────────────────────────────────────────────────────────
  async listCompanies(search?: string, limit = 50, sort: 'name' | 'last_contact' = 'name') {
    const hasSearch = search && search.trim().length > 0
    const params: any[] = []
    if (hasSearch) params.push(`%${search.trim()}%`)
    params.push(limit)
    const whereClause = hasSearch ? 'WHERE c.name ILIKE $1' : ''
    const limitParam = `$${params.length}`
    const orderBy =
      sort === 'last_contact'
        ? 'ORDER BY d.last_contacted_at DESC NULLS LAST, c.name ASC'
        : 'ORDER BY c.name ASC'
    const { rows } = await this.query(
      `SELECT c.id, c.orgnr, c.name, c.industry, c.website, d.status AS deal_status, d.last_contacted_at
       FROM ${SCHEMA}.companies c
       LEFT JOIN ${SCHEMA}.deals d ON c.id = d.company_id
       ${whereClause}
       ${orderBy}
       LIMIT ${limitParam}`,
      params
    )
    return rows
  }

  async getCompany(id: string) {
    const { rows } = await this.query(
      `SELECT id, orgnr, name, industry, website, headquarters FROM ${SCHEMA}.companies WHERE id = $1`,
      [id]
    )
    return rows[0] ?? null
  }

  async getCompanyByOrgnr(orgnr: string) {
    if (!orgnr || orgnr.startsWith('tmp-')) return null
    const { rows } = await this.query(
      `SELECT id, orgnr, name, industry, website, headquarters FROM ${SCHEMA}.companies WHERE orgnr = $1`,
      [orgnr]
    )
    return rows[0] ?? null
  }

  async patchCompany(companyId: string, payload: { industry?: string | null; website?: string | null }) {
    const cols = Object.keys(payload).filter((k) => (payload as Record<string, unknown>)[k] !== undefined)
    if (cols.length === 0) return this.getCompany(companyId)
    const sets = cols.map((c, i) => `${c} = $${i + 2}`).join(', ')
    const { rows } = await this.query(
      `UPDATE ${SCHEMA}.companies SET ${sets}, updated_at = now() WHERE id = $1::uuid RETURNING id, orgnr, name, industry, website, headquarters`,
      [companyId, ...cols.map((c) => (payload as Record<string, unknown>)[c])]
    )
    return rows[0] ?? null
  }

  // ─── Deals ─────────────────────────────────────────────────────────────
  async insertDeal(companyId: string) {
    const { rows } = await this.query(
      `INSERT INTO ${SCHEMA}.deals (company_id, status) VALUES ($1, 'target_identified') RETURNING *`,
      [companyId]
    )
    return rows[0]
  }

  async getDealByCompanyId(companyId: string) {
    const { rows } = await this.query(
      `SELECT * FROM ${SCHEMA}.deals WHERE company_id = $1`,
      [companyId]
    )
    return rows[0] ?? null
  }

  async getDealById(dealId: string) {
    const { rows } = await this.query(`SELECT * FROM ${SCHEMA}.deals WHERE id = $1`, [dealId])
    return rows[0] ?? null
  }

  async patchDeal(dealId: string, fields: { next_action_at?: string | null }) {
    if (fields.next_action_at === undefined) return this.getDealById(dealId)
    const { rows } = await this.query(
      `UPDATE ${SCHEMA}.deals SET next_action_at = $2 WHERE id = $1::uuid RETURNING *`,
      [dealId, fields.next_action_at]
    )
    return rows[0] ?? null
  }

  async updateDealStatus(dealId: string, status: string) {
    const { rows } = await this.query(
      `UPDATE ${SCHEMA}.deals SET status = $1 WHERE id = $2 RETURNING *`,
      [status, dealId]
    )
    return rows[0]
  }

  async touchDealLastContacted(dealId: string) {
    await this.query(
      `UPDATE ${SCHEMA}.deals SET last_contacted_at = now() WHERE id = $1`,
      [dealId]
    )
  }

  // ─── Contacts ──────────────────────────────────────────────────────────
  async listContactsByCompany(companyId: string) {
    const { rows } = await this.query(
      `SELECT * FROM ${SCHEMA}.contacts WHERE company_id = $1 ORDER BY is_primary DESC, created_at DESC`,
      [companyId]
    )
    return rows
  }

  async createContact(payload: Record<string, any>) {
    if (payload.is_primary) await this.clearPrimaryContact(payload.company_id)
    const cols = Object.keys(payload).filter((k) => payload[k] !== undefined)
    const vals = cols.map((c) => payload[c])
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ')
    const { rows } = await this.query(
      `INSERT INTO ${SCHEMA}.contacts (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      vals
    )
    return rows[0]
  }

  async updateContact(contactId: string, payload: Record<string, any>) {
    if (payload.is_primary) {
      const { rows } = await this.query(`SELECT company_id FROM ${SCHEMA}.contacts WHERE id = $1`, [contactId])
      if (rows[0]?.company_id) await this.clearPrimaryContact(rows[0].company_id)
    }
    const cols = Object.keys(payload).filter((k) => payload[k] !== undefined)
    const sets = cols.map((c, i) => `${c} = $${i + 2}`).join(', ')
    const { rows } = await this.query(
      `UPDATE ${SCHEMA}.contacts SET ${sets} WHERE id = $1 RETURNING *`,
      [contactId, ...cols.map((c) => payload[c])]
    )
    return rows[0]
  }

  async clearPrimaryContact(companyId: string) {
    await this.query(
      `UPDATE ${SCHEMA}.contacts SET is_primary = false WHERE company_id = $1 AND is_primary = true`,
      [companyId]
    )
  }

  async getContactById(id: string) {
    const { rows } = await this.query(`SELECT * FROM ${SCHEMA}.contacts WHERE id = $1`, [id])
    return rows[0] ?? null
  }

  // ─── Emails ────────────────────────────────────────────────────────────
  async insertEmail(payload: Record<string, any>) {
    const cols = Object.keys(payload).filter((k) => payload[k] !== undefined)
    const vals = cols.map((c) => payload[c])
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ')
    const { rows } = await this.query(
      `INSERT INTO ${SCHEMA}.emails (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      vals
    )
    return rows[0]
  }

  async updateEmail(emailId: string, payload: Record<string, any>) {
    const cols = Object.keys(payload).filter((k) => payload[k] !== undefined)
    const sets = cols.map((c, i) => `${c} = $${i + 2}`).join(', ')
    const { rows } = await this.query(
      `UPDATE ${SCHEMA}.emails SET ${sets} WHERE id = $1 RETURNING *`,
      [emailId, ...cols.map((c) => payload[c])]
    )
    return rows[0]
  }

  async getEmailById(id: string) {
    const { rows } = await this.query(`SELECT * FROM ${SCHEMA}.emails WHERE id = $1`, [id])
    return rows[0] ?? null
  }

  async getLatestOutboundEmailByDeal(dealId: string) {
    const { rows } = await this.query(
      `SELECT * FROM ${SCHEMA}.emails WHERE deal_id = $1 AND direction = 'outbound' ORDER BY created_at DESC LIMIT 1`,
      [dealId]
    )
    return rows[0] ?? null
  }

  async listOutboundEmailsByDeal(dealId: string) {
    const { rows } = await this.query(
      `SELECT e.id, e.deal_id, e.contact_id, e.subject, e.status, e.sent_at, e.created_at, e.updated_at,
              e.crm_thread_id, e.tracking_id, e.body_text,
              c.full_name AS contact_name, c.email AS contact_email
       FROM ${SCHEMA}.emails e
       LEFT JOIN ${SCHEMA}.contacts c ON c.id = e.contact_id
       WHERE e.deal_id = $1::uuid AND e.direction = 'outbound'
       ORDER BY e.created_at DESC`,
      [dealId]
    )
    return rows
  }

  async countSentEmailsByDeal(dealId: string) {
    const { rows } = await this.query(
      `SELECT count(*)::int FROM ${SCHEMA}.emails WHERE deal_id = $1 AND status = 'sent'`,
      [dealId]
    )
    return rows[0]?.count ?? 0
  }

  async getEmailByTrackingId(trackingId: string) {
    const { rows } = await this.query(
      `SELECT id, deal_id, contact_id FROM ${SCHEMA}.emails WHERE tracking_id = $1`,
      [trackingId]
    )
    return rows[0] ?? null
  }

  // ─── Interactions ───────────────────────────────────────────────────────
  async insertInteraction(payload: Record<string, any>) {
    const cols = Object.keys(payload).filter((k) => payload[k] !== undefined)
    const vals = cols.map((c) => payload[c])
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ')
    const { rows } = await this.query(
      `INSERT INTO ${SCHEMA}.interactions (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      vals
    )
    return rows[0]
  }

  async getTimelineByDeal(dealId: string) {
    const { rows } = await this.query(
      `SELECT * FROM ${SCHEMA}.interactions WHERE deal_id = $1 ORDER BY created_at DESC`,
      [dealId]
    )
    return rows
  }

  // ─── Tracking events ────────────────────────────────────────────────────
  async insertTrackingEvent(payload: Record<string, any>) {
    const cols = Object.keys(payload).filter((k) => payload[k] !== undefined)
    const vals = cols.map((c) => payload[c])
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ')
    await this.query(
      `INSERT INTO ${SCHEMA}.tracking_events (${cols.join(', ')}) VALUES (${placeholders})`,
      vals
    )
  }

  async countTrackingEvents(trackingId: string, eventType: string) {
    const { rows } = await this.query(
      `SELECT count(*)::int FROM ${SCHEMA}.tracking_events WHERE tracking_id = $1 AND event_type = $2`,
      [trackingId, eventType]
    )
    return rows[0]?.count ?? 0
  }

  async countTrackingEventsByEmailIds(emailIds: string[], eventType: string) {
    if (emailIds.length === 0) return 0
    const { rows } = await this.query(
      `SELECT count(*)::int FROM ${SCHEMA}.tracking_events WHERE email_id = ANY($1::uuid[]) AND event_type = $2`,
      [emailIds, eventType]
    )
    return rows[0]?.count ?? 0
  }

  // ─── Sequences ──────────────────────────────────────────────────────────
  async getDefaultSequenceId() {
    const { rows } = await this.query(
      `SELECT id FROM ${SCHEMA}.sequences WHERE name = 'Default Origination Sequence' LIMIT 1`
    )
    return rows[0]?.id ?? null
  }

  async upsertDealSequenceEnrollment(dealId: string, sequenceId: string) {
    const { rows } = await this.query(
      `INSERT INTO ${SCHEMA}.deal_sequence_enrollments (deal_id, sequence_id, status)
       VALUES ($1, $2, 'active')
       ON CONFLICT (deal_id, sequence_id) DO UPDATE SET status = 'active'
       RETURNING *`,
      [dealId, sequenceId]
    )
    return rows[0]
  }

  // ─── Outreach context (company_profiles, strategy, value_creation) ────
  async getCompanyProfile(companyId: string) {
    const { rows } = await this.query(
      `SELECT summary, business_model FROM ${SCHEMA}.company_profiles WHERE company_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [companyId]
    )
    return rows[0] ?? null
  }

  async getStrategy(companyId: string) {
    const { rows } = await this.query(
      `SELECT investment_thesis, acquisition_rationale FROM ${SCHEMA}.strategy WHERE company_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [companyId]
    )
    return rows[0] ?? null
  }

  async getValueCreation(companyId: string) {
    const { rows } = await this.query(
      `SELECT initiatives FROM ${SCHEMA}.value_creation WHERE company_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [companyId]
    )
    return rows[0] ?? null
  }

  // ─── CRM email threads (Resend Reply-To correlation) ─────────────────────
  async ensureCrmEmailThread(dealId: string, contactId: string) {
    const existing = await this.query<{ id: string; token: string }>(
      `SELECT id, token FROM ${SCHEMA}.crm_email_threads WHERE deal_id = $1 AND contact_id = $2`,
      [dealId, contactId]
    )
    if (existing.rows[0]) return existing.rows[0]

    const token = generateThreadToken()
    const { rows } = await this.query<{ id: string; token: string }>(
      `INSERT INTO ${SCHEMA}.crm_email_threads (token, deal_id, contact_id, company_id)
       SELECT $1::text, $2::uuid, $3::uuid, d.company_id
       FROM ${SCHEMA}.deals d
       INNER JOIN ${SCHEMA}.contacts c ON c.id = $3::uuid AND c.company_id = d.company_id
       WHERE d.id = $2::uuid
       RETURNING id, token`,
      [token, dealId, contactId]
    )
    if (!rows[0]) {
      throw new Error('ensureCrmEmailThread: deal and contact must belong to the same company')
    }
    return rows[0]
  }

  async insertCrmEmailMessage(payload: Record<string, any>) {
    const cols = Object.keys(payload).filter((k) => payload[k] !== undefined)
    const vals = cols.map((c) => payload[c])
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ')
    const { rows } = await this.query(
      `INSERT INTO ${SCHEMA}.crm_email_messages (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      vals
    )
    return rows[0]
  }

  async listCrmEmailMessagesByThreadId(threadId: string) {
    const { rows } = await this.query(
      `SELECT * FROM ${SCHEMA}.crm_email_messages WHERE thread_id = $1::uuid ORDER BY created_at ASC`,
      [threadId]
    )
    return rows
  }

  async listRecentInboundMessages(limit: number): Promise<CrmInboundRecentRow[]> {
    const cap = Math.min(200, Math.max(1, limit))
    const { rows } = await this.query<CrmInboundRecentRow>(
      `SELECT m.id::text, m.thread_id::text, m.subject, m.text_body,
              m.received_at::text, m.created_at::text,
              t.company_id::text, c.name AS company_name,
              t.deal_id::text, t.contact_id::text, co.email AS contact_email
       FROM ${SCHEMA}.crm_email_messages m
       INNER JOIN ${SCHEMA}.crm_email_threads t ON t.id = m.thread_id
       INNER JOIN ${SCHEMA}.companies c ON c.id = t.company_id
       LEFT JOIN ${SCHEMA}.contacts co ON co.id = t.contact_id
       WHERE m.direction = 'inbound'
       ORDER BY COALESCE(m.received_at, m.created_at) DESC
       LIMIT $1`,
      [cap]
    )
    return rows
  }

  async listRecentOutboundEmails(limit: number): Promise<CrmRecentSentRow[]> {
    const cap = Math.min(100, Math.max(1, limit))
    const { rows } = await this.query<CrmRecentSentRow>(
      `SELECT e.id::text, e.deal_id::text, e.contact_id::text,
              d.company_id::text, co.name AS company_name,
              c.full_name AS contact_name, c.email AS contact_email,
              e.subject, e.status,
              e.sent_at::text, e.created_at::text,
              e.tracking_id::text
       FROM ${SCHEMA}.emails e
       INNER JOIN ${SCHEMA}.deals d ON d.id = e.deal_id
       LEFT JOIN ${SCHEMA}.companies co ON co.id = d.company_id
       LEFT JOIN ${SCHEMA}.contacts c ON c.id = e.contact_id
       WHERE e.direction = 'outbound'
         AND e.status IN ('sent', 'failed', 'bounced')
       ORDER BY COALESCE(e.sent_at, e.created_at) DESC
       LIMIT $1`,
      [cap]
    )
    return rows
  }

  async listInboundUnmatched(limit: number): Promise<CrmInboundUnmatchedRow[]> {
    const cap = Math.min(200, Math.max(1, limit))
    const { rows } = await this.query<CrmInboundUnmatchedRow>(
      `SELECT id::text, token_attempted, from_email, to_email, subject,
              provider_inbound_email_id, created_at::text
       FROM ${SCHEMA}.crm_email_inbound_unmatched
       ORDER BY created_at DESC
       LIMIT $1`,
      [cap]
    )
    return rows
  }

  async listSavedListOrgnrs(listId: string): Promise<string[]> {
    const { rows } = await this.query<{ orgnr: string }>(
      `SELECT orgnr FROM public.saved_list_items WHERE list_id = $1::uuid`,
      [listId]
    )
    return rows.map((r) => r.orgnr).filter(Boolean)
  }

  async savedListExists(listId: string): Promise<boolean> {
    const { rows } = await this.query<{ ok: number }>(
      `SELECT 1 AS ok FROM public.saved_lists WHERE id = $1::uuid LIMIT 1`,
      [listId]
    )
    return rows.length > 0
  }

  async insertCompany(payload: { orgnr: string; name: string; website?: string | null }) {
    const { rows } = await this.query(
      `INSERT INTO ${SCHEMA}.companies (orgnr, name, website, country_code)
       VALUES ($1, $2, $3, 'SE')
       RETURNING *`,
      [payload.orgnr, payload.name, payload.website ?? null]
    )
    return rows[0]
  }

  async resolveOrCreateCompanyByOrgnr(orgnr: string): Promise<{ id: string } | null> {
    if (!orgnr || !orgnr.trim()) return null
    const trimmed = orgnr.trim()
    const existing = await this.getCompanyByOrgnr(trimmed)
    if (existing?.id) return { id: existing.id as string }

    let name = `Company ${trimmed}`
    let website: string | null = null
    try {
      const { rows: pub } = await this.query<{ company_name: string; homepage: string | null }>(
        `SELECT company_name, homepage FROM public.companies WHERE orgnr = $1 LIMIT 1`,
        [trimmed]
      )
      if (pub[0]?.company_name?.trim()) name = pub[0].company_name.trim()
      website = pub[0]?.homepage ?? null
    } catch {
      /* public.companies may be absent in some dev DBs */
    }
    try {
      const { rows } = await this.query<{ id: string }>(
        `INSERT INTO ${SCHEMA}.companies (orgnr, name, website, country_code)
         VALUES ($1, $2, $3, 'SE')
         ON CONFLICT (orgnr) DO UPDATE SET updated_at = now()
         RETURNING id::text`,
        [trimmed, name, website]
      )
      return rows[0] ? { id: rows[0].id } : null
    } catch {
      const again = await this.getCompanyByOrgnr(trimmed)
      return again?.id ? { id: again.id as string } : null
    }
  }

  async getPrimaryOrFirstContact(companyId: string) {
    const { rows } = await this.query(
      `SELECT * FROM ${SCHEMA}.contacts WHERE company_id = $1::uuid
       ORDER BY is_primary DESC, created_at DESC
       LIMIT 1`,
      [companyId]
    )
    return rows[0] ?? null
  }

  async findContactByEmailForCrm(email: string) {
    const e = email?.trim().toLowerCase()
    if (!e) return null
    const { rows } = await this.query(
      `SELECT * FROM ${SCHEMA}.contacts WHERE lower(trim(email)) = $1 LIMIT 1`,
      [e]
    )
    return rows[0] ?? null
  }

  async listCompaniesWithWebsite() {
    const { rows } = await this.query<{ id: string; website: string }>(
      `SELECT id::text, website FROM ${SCHEMA}.companies
       WHERE website IS NOT NULL AND trim(website) != ''`,
    )
    return rows
  }

  async tryInsertCrmEmailMessage(payload: Record<string, any>) {
    const dedupe = payload.dedupe_key
    if (!dedupe || typeof dedupe !== 'string') {
      throw new Error('tryInsertCrmEmailMessage: dedupe_key is required')
    }
    const cols = Object.keys(payload).filter((k) => payload[k] !== undefined)
    const vals = cols.map((c) => payload[c])
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ')
    const { rows } = await this.query(
      `INSERT INTO ${SCHEMA}.crm_email_messages (${cols.join(', ')}) VALUES (${placeholders})
       ON CONFLICT (dedupe_key) DO NOTHING RETURNING *`,
      vals
    )
    return rows[0] ?? null
  }
}
