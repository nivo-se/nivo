/**
 * Postgres-backed CRM database client.
 * Implements CrmDb for use with local Postgres (Mac mini / docker).
 * Uses local Postgres (Mac mini / docker) instead of Supabase.
 * Configure via POSTGRES_* or DATABASE_URL in .env.
 */

import pg from 'pg'
const { Pool } = pg

const SCHEMA = 'deep_research'

function getConnectionConfig(): pg.PoolConfig {
  const url = process.env.DATABASE_URL
  if (url) return { connectionString: url }
  const host = process.env.POSTGRES_HOST || 'localhost'
  const port = Number(process.env.POSTGRES_PORT || 5433)
  const database = process.env.POSTGRES_DB || 'nivo'
  const user = process.env.POSTGRES_USER || 'nivo'
  const password = process.env.POSTGRES_PASSWORD || 'nivo'
  return { host, port, database, user, password }
}

let pool: pg.Pool | null = null

export function getCrmPool(): pg.Pool | null {
  if (pool) return pool
  const config = getConnectionConfig()
  try {
    pool = new Pool(config)
    return pool
  } catch (err) {
    console.error('[CRM] Postgres pool init failed:', err)
    return null
  }
}

export function isCrmPostgresConfigured(): boolean {
  return true
}

import type { CrmDb } from './db-interface.js'

/** Postgres-backed CRM DB – replaces Supabase for CRM operations. */
export class PostgresCrmDb implements CrmDb {
  constructor(private readonly pool: pg.Pool) {}

  private async query<T = any>(text: string, params?: any[]): Promise<{ rows: T[] }> {
    const result = await this.pool.query(text, params)
    return { rows: result.rows }
  }

  // ─── Companies ─────────────────────────────────────────────────────────
  async listCompanies(search?: string, limit = 50) {
    const hasSearch = search && search.trim().length > 0
    const params: any[] = []
    if (hasSearch) params.push(`%${search.trim()}%`)
    params.push(limit)
    const whereClause = hasSearch ? 'WHERE c.name ILIKE $1' : ''
    const limitParam = `$${params.length}`
    const { rows } = await this.query(
      `SELECT c.id, c.orgnr, c.name, c.industry, c.website, d.status AS deal_status, d.last_contacted_at
       FROM ${SCHEMA}.companies c
       LEFT JOIN ${SCHEMA}.deals d ON c.id = d.company_id
       ${whereClause}
       ORDER BY c.name
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
}
