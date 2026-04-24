import type { Express, Request, Response, NextFunction } from 'express'
import type { CrmDb } from '../services/crm/db-interface.js'
import { randomUUID } from 'node:crypto'
import {
  addNoteSchema,
  approveEmailSchema,
  createContactSchema,
  createExternalCompanySchema,
  draftEmailSchema,
  enrollSequenceSchema,
  fromCompanySchema,
  generateBatchEmailSchema,
  generateEmailSchema,
  patchCompanySchema,
  patchDealSchema,
  quickSendSchema,
  updateContactSchema,
  updateDraftEmailSchema,
  updateStatusSchema,
  sendCrmEmailSchema,
  crmGoogleCalendarEventsQuerySchema,
  crmGoogleDriveCreateFileSchema,
} from '../services/crm/validation.js'
import { DealsService } from '../services/crm/deals.service.js'
import { ContactsService } from '../services/crm/contacts.service.js'
import { InteractionsService } from '../services/crm/interactions.service.js'
import { TrackingService } from '../services/crm/tracking.service.js'
import { SequencesService } from '../services/crm/sequences.service.js'
import { ResendEmailService } from '../services/resend/resend-email.service.js'
import { getCrmEmailConfigPayload } from '../services/resend/crm-resend-env.js'
import { EmailsService } from '../services/crm/emails.service.js'
import { OutreachEmailService } from '../services/ai/outreach-email.service.js'
import { CRMOverviewService } from '../services/crm/overview.service.js'
import { getAuth0SubFromBearer } from '../auth0-verify.js'
import { signGmailOAuthState, verifyGmailOAuthState } from '../services/gmail/gmail-oauth-state.js'
import type { GmailOutboundService } from '../services/gmail/gmail-outbound.service.js'
import { CrmGoogleCalendarService } from '../services/google/crm-google-calendar.service.js'
import { CrmGoogleDriveService } from '../services/google/crm-google-drive.service.js'

const PIXEL_BUFFER = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64')

function requireCrmDb(res: Response, db: CrmDb | null): db is CrmDb {
  if (!db) {
    res.status(500).json({ success: false, error: 'Database client unavailable' })
    return false
  }
  return true
}

function isSafeRedirect(url?: string): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

async function loadOutreachContext(db: CrmDb, companyId: string) {
  const [company, profile, strategy, valueCreation] = await Promise.all([
    db.getCompany(companyId),
    db.getCompanyProfile(companyId),
    db.getStrategy(companyId),
    db.getValueCreation(companyId),
  ])

  return {
    company,
    profile,
    strategy,
    valueCreation,
  }
}

export function registerCrmRoutes(
  app: Express,
  getCrmDb: () => CrmDb | null,
  getGmailOutbound: () => GmailOutboundService | null = () => null,
) {
  const resendOutbound = new ResendEmailService()

  app.get('/crm/companies', asyncHandler(async (req, res) => {
    const db = getCrmDb()
    if (!requireCrmDb(res, db)) return
    const search = typeof req.query.search === 'string' ? req.query.search : undefined
    const limit = typeof req.query.limit === 'string' ? Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50)) : 50
    const data = await db.listCompanies(search, limit)
    return res.json({ success: true, data })
  }))

  /** Minimal company row for prospects not yet in Universe (unique orgnr: auto crm-ext-*) */
  app.post('/crm/companies', asyncHandler(async (req, res) => {
    const parsed = createExternalCompanySchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() })
    const db = getCrmDb()
    if (!requireCrmDb(res, db)) return

    const orgnr =
      parsed.data.orgnr?.trim() || `crm-ext-${randomUUID().replace(/-/g, '')}`
    const existing = await db.getCompanyByOrgnr(orgnr)
    if (existing) {
      return res.json({ success: true, data: existing, existing: true })
    }
    const row = await db.insertCompany({
      orgnr,
      name: parsed.data.name.trim(),
      website: parsed.data.website?.trim() || undefined,
    })
    return res.json({ success: true, data: row })
  }))

  app.patch('/crm/companies/:companyId', asyncHandler(async (req, res) => {
    const parsed = patchCompanySchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() })
    const db = getCrmDb()
    if (!requireCrmDb(res, db)) return

    let companyId = req.params.companyId
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(companyId)) {
      const byOrgnr = await db.getCompanyByOrgnr(companyId)
      if (!byOrgnr) return res.status(404).json({ success: false, error: 'Company not found' })
      companyId = byOrgnr.id as string
    }

    const existing = await db.getCompany(companyId)
    if (!existing) return res.status(404).json({ success: false, error: 'Company not found' })

    const patch: { industry?: string | null; website?: string | null } = {}
    if ('industry' in parsed.data) {
      const v = parsed.data.industry
      patch.industry = v == null || v === '' ? null : v.trim()
    }
    if ('website' in parsed.data) {
      const v = parsed.data.website
      if (v == null || v === '') {
        patch.website = null
      } else {
        const t = v.trim()
        patch.website = /^https?:\/\//i.test(t) ? t : `https://${t}`
      }
    }

    const data = await db.patchCompany(companyId, patch)
    return res.json({ success: true, data })
  }))

  app.get('/crm/email-config', asyncHandler(async (_req, res) => {
    return res.json({ success: true, data: getCrmEmailConfigPayload() })
  }))

  /** Returns a Google OAuth URL; open in the same window to connect Gmail, Drive (app files), and Calendar. */
  app.post('/crm/gmail/oauth/url', asyncHandler(async (req, res) => {
    const sub = await getAuth0SubFromBearer(req.headers?.authorization)
    if (!sub) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }
    const g = getGmailOutbound()
    if (!g?.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Gmail OAuth is not configured on this server (set Google OAuth env vars).',
      })
    }
    const state = await signGmailOAuthState(sub)
    const url = g.createAuthorizationUrl(state)
    return res.json({ success: true, data: { url } })
  }))

  /** Google redirects here after consent (browser hit; no Authorization header). */
  app.get('/crm/gmail/oauth/callback', asyncHandler(async (req, res) => {
    const err = typeof req.query.error === 'string' ? req.query.error : null
    if (err) {
      return res.status(400).type('text/plain').send(`Google OAuth error: ${err}`)
    }
    const code = typeof req.query.code === 'string' ? req.query.code : null
    const state = typeof req.query.state === 'string' ? req.query.state : null
    if (!code || !state) {
      return res.status(400).type('text/plain').send('Missing code or state.')
    }
    let userId: string
    try {
      userId = await verifyGmailOAuthState(state)
    } catch {
      return res
        .status(400)
        .type('text/plain')
        .send('Invalid or expired OAuth state. Open the app and try Connect Gmail again.')
    }
    const g = getGmailOutbound()
    if (!g?.isReady()) {
      return res.status(503).type('text/plain').send('Gmail OAuth is not configured on this server.')
    }
    try {
      await g.exchangeCodeAndStore(userId, code)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return res.status(400).type('text/plain').send(msg)
    }
    const base =
      process.env.CRM_GMAIL_OAUTH_SUCCESS_URL?.trim() ||
      process.env.APP_BASE_URL?.trim() ||
      'http://localhost:5173'
    const target = `${base.replace(/\/$/, '')}/crm?gmail=connected`
    return res.redirect(302, target)
  }))

  app.get('/crm/gmail/status', asyncHandler(async (req, res) => {
    const sub = await getAuth0SubFromBearer(req.headers?.authorization)
    if (!sub) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }
    const g = getGmailOutbound()
    if (!g?.isReady()) {
      return res.json({
        success: true,
        data: {
          server_configured: false,
          connected: false,
          google_email: null as string | null,
          google_display_name: null as string | null,
          workspace: { gmail_send: false, drive_file: false, calendar_events: false },
        },
      })
    }
    const row = await g.getConnection(sub)
    const workspace = row
      ? g.scopeFlags(row.granted_scopes)
      : { gmail_send: false, drive_file: false, calendar_events: false }
    return res.json({
      success: true,
      data: {
        server_configured: true,
        connected: Boolean(row),
        google_email: row?.google_email ?? null,
        google_display_name: row?.google_display_name ?? null,
        workspace,
      },
    })
  }))

  /** List calendar events for the connected Google account (primary calendar by default). */
  app.get('/crm/google/calendar/events', asyncHandler(async (req, res) => {
    const sub = await getAuth0SubFromBearer(req.headers?.authorization)
    if (!sub) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }
    const g = getGmailOutbound()
    if (!g?.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Google OAuth is not configured on this server.',
      })
    }
    const parsed = crmGoogleCalendarEventsQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() })
    }
    const cal = new CrmGoogleCalendarService(g)
    try {
      const data = await cal.listEvents(sub, parsed.data)
      return res.json({ success: true, data })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return res.status(400).json({ success: false, error: msg })
    }
  }))

  /** Create a file in the user’s Drive (`drive.file` scope: app-created files; optional shared-folder parents). */
  app.post('/crm/google/drive/files', asyncHandler(async (req, res) => {
    const sub = await getAuth0SubFromBearer(req.headers?.authorization)
    if (!sub) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }
    const g = getGmailOutbound()
    if (!g?.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Google OAuth is not configured on this server.',
      })
    }
    const parsed = crmGoogleDriveCreateFileSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() })
    }
    let buf: Buffer
    try {
      buf = Buffer.from(parsed.data.contentBase64, 'base64')
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid base64 content' })
    }
    if (!buf.length) {
      return res.status(400).json({ success: false, error: 'Empty file body' })
    }
    const driveSvc = new CrmGoogleDriveService(g)
    try {
      const data = await driveSvc.createFile(sub, {
        name: parsed.data.name,
        mimeType: parsed.data.mimeType,
        body: buf,
        parentIds: parsed.data.parentIds,
      })
      return res.json({ success: true, data })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return res.status(400).json({ success: false, error: msg })
    }
  }))

  app.delete('/crm/gmail/oauth', asyncHandler(async (req, res) => {
    const sub = await getAuth0SubFromBearer(req.headers?.authorization)
    if (!sub) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }
    const g = getGmailOutbound()
    if (!g) {
      return res.status(503).json({ success: false, error: 'Gmail OAuth is not configured' })
    }
    await g.disconnect(sub)
    return res.json({ success: true, data: { disconnected: true } })
  }))

  app.get('/crm/inbound/recent', asyncHandler(async (req, res) => {
    const db = getCrmDb()
    if (!requireCrmDb(res, db)) return
    const raw = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 50
    const limit = Math.min(100, Math.max(1, Number.isFinite(raw) ? raw : 50))
    const data = await db.listRecentInboundMessages(limit)
    return res.json({ success: true, data })
  }))

  app.get('/crm/inbound/unmatched', asyncHandler(async (req, res) => {
    const db = getCrmDb()
    if (!requireCrmDb(res, db)) return
    const raw = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 50
    const limit = Math.min(100, Math.max(1, Number.isFinite(raw) ? raw : 50))
    const data = await db.listInboundUnmatched(limit)
    return res.json({ success: true, data })
  }))

  app.post('/crm/emails/generate-batch', asyncHandler(async (req, res) => {
    const parsed = generateBatchEmailSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() })
    const db = getCrmDb()
    if (!requireCrmDb(res, db)) return

    const listOk = await db.savedListExists(parsed.data.list_id)
    if (!listOk) return res.status(404).json({ success: false, error: 'List not found' })

    const orgnrs = await db.listSavedListOrgnrs(parsed.data.list_id)
    if (orgnrs.length === 0) {
      return res.json({
        success: true,
        data: { drafts: [] as unknown[], skipped: [{ reason: 'empty_list' as const }] },
      })
    }

    const deals = new DealsService(db)
    const interactions = new InteractionsService(db)
    const emails = new EmailsService(db, interactions, resendOutbound, deals, getGmailOutbound())
    const aiService = new OutreachEmailService()

    const drafts: {
      email_id: string
      company_id: string
      contact_id: string
      orgnr: string
      subject: string
      company_name?: string
    }[] = []
    const skipped: { orgnr: string; company_id?: string; reason: string }[] = []

    for (const orgnr of orgnrs) {
      const resolved = await db.resolveOrCreateCompanyByOrgnr(orgnr)
      if (!resolved) {
        skipped.push({ orgnr, reason: 'could_not_resolve_company' })
        continue
      }
      const companyId = resolved.id
      const company = await db.getCompany(companyId)
      const contact = await db.getPrimaryOrFirstContact(companyId)
      if (!contact) {
        skipped.push({ orgnr, company_id: companyId, reason: 'no_contact' })
        continue
      }
      const deal = await deals.getOrCreateByCompany(companyId)
      const context = await loadOutreachContext(db, companyId)
      const draft = await aiService.generateDraft({
        companyName: context.company?.name,
        industry: context.company?.industry,
        companyProfile: context.profile?.summary,
        strategicStrengths: context.strategy?.investment_thesis,
        reasonForInterest: parsed.data.reason_for_interest || context.strategy?.acquisition_rationale,
        valueCreationAngle: JSON.stringify(context.valueCreation?.initiatives || {}),
        contactName: contact?.full_name,
        contactTitle: contact?.title,
        userInstructions: parsed.data.user_instructions,
      })

      const email = await emails.createDraft({
        deal_id: deal.id,
        contact_id: contact.id as string,
        subject: draft.subject,
        body_text: draft.body_text,
        body_html: draft.body_html,
        ai_prompt_version: draft.prompt_version,
        generation_context: context,
      })

      drafts.push({
        email_id: email.id,
        company_id: companyId,
        contact_id: contact.id as string,
        orgnr,
        subject: draft.subject,
        company_name: company?.name as string | undefined,
      })
    }

    return res.json({ success: true, data: { drafts, skipped } })
  }))

  app.post('/crm/deals/from-company', asyncHandler(async (req, res) => {
    const parsed = fromCompanySchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() })

    const db = getCrmDb()
    if (!requireCrmDb(res, db)) return
    const dealsService = new DealsService(db)
    const deal = await dealsService.getOrCreateByCompany(parsed.data.company_id)
    return res.json({ success: true, data: deal })
  }))

  /** Resolve company by UUID or orgnr; orgnr enables Prospects/Universe -> CRM linking */
  app.get('/crm/company/:companyId', asyncHandler(async (req, res) => {
    const db = getCrmDb()
    if (!requireCrmDb(res, db)) return
    let companyId = req.params.companyId
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(companyId)) {
      const byOrgnr = await db.getCompanyByOrgnr(companyId)
      if (!byOrgnr) return res.status(404).json({ success: false, error: 'Company not found by orgnr' })
      companyId = byOrgnr.id
    }
    const interactions = new InteractionsService(db)
    const deals = new DealsService(db)
    const contacts = new ContactsService(db)
    const emails = new EmailsService(db, interactions, resendOutbound, deals, getGmailOutbound())
    const overview = new CRMOverviewService(db, deals, contacts, emails, interactions)
    const payload = await overview.companyOverview(companyId)
    return res.json({ success: true, data: payload })
  }))

  app.post('/crm/contacts', asyncHandler(async (req, res) => {
    const parsed = createContactSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() })
    const db = getCrmDb()
    if (!requireCrmDb(res, db)) return
    const service = new ContactsService(db)
    const data = await service.create(parsed.data)
    return res.json({ success: true, data })
  }))

  app.patch('/crm/contacts/:contactId', asyncHandler(async (req, res) => {
    const parsed = updateContactSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() })
    const db = getCrmDb()
    if (!requireCrmDb(res, db)) return
    const service = new ContactsService(db)
    const data = await service.update(req.params.contactId, parsed.data)
    return res.json({ success: true, data })
  }))

  app.post('/crm/emails/generate', asyncHandler(async (req, res) => {
    const parsed = generateEmailSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() })
    const db = getCrmDb()
    if (!requireCrmDb(res, db)) return

    const deals = new DealsService(db)
    const interactions = new InteractionsService(db)
    const emails = new EmailsService(db, interactions, resendOutbound, deals, getGmailOutbound())
    const aiService = new OutreachEmailService()

    const deal = await deals.getOrCreateByCompany(parsed.data.company_id)
    const contact = await db.getContactById(parsed.data.contact_id)
    if (!contact) return res.status(404).json({ success: false, error: 'Contact not found' })
    if (contact.company_id !== parsed.data.company_id) return res.status(400).json({ success: false, error: 'Contact does not belong to the specified company' })

    const context = await loadOutreachContext(db, parsed.data.company_id)

    const draft = await aiService.generateDraft({
      companyName: context.company?.name,
      industry: context.company?.industry,
      companyProfile: context.profile?.summary,
      strategicStrengths: context.strategy?.investment_thesis,
      reasonForInterest: parsed.data.reason_for_interest || context.strategy?.acquisition_rationale,
      valueCreationAngle: JSON.stringify(context.valueCreation?.initiatives || {}),
      contactName: contact?.full_name,
      contactTitle: contact?.title,
      userInstructions: parsed.data.user_instructions,
    })

    const email = await emails.createDraft({
      deal_id: deal.id,
      contact_id: parsed.data.contact_id,
      subject: draft.subject,
      body_text: draft.body_text,
      body_html: draft.body_html,
      ai_prompt_version: draft.prompt_version,
      generation_context: context,
    })

    return res.json({ success: true, data: { ...draft, email_id: email.id, tracking_id: email.tracking_id } })
  }))

  app.post('/crm/emails/draft', asyncHandler(async (req, res) => {
    const parsed = draftEmailSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() })
    const db = getCrmDb()
    if (!requireCrmDb(res, db)) return

    const deals = new DealsService(db)
    const interactions = new InteractionsService(db)
    const emails = new EmailsService(db, interactions, resendOutbound, deals, getGmailOutbound())

    const deal = await deals.getOrCreateByCompany(parsed.data.company_id)
    const contact = await db.getContactById(parsed.data.contact_id)
    if (!contact) return res.status(404).json({ success: false, error: 'Contact not found' })
    if (contact.company_id !== parsed.data.company_id) {
      return res.status(400).json({ success: false, error: 'Contact does not belong to the specified company' })
    }

    const email = await emails.createDraft({
      deal_id: deal.id,
      contact_id: parsed.data.contact_id,
      subject: parsed.data.subject,
      body_text: parsed.data.body_text,
      body_html: parsed.data.body_html,
    })

    return res.json({ success: true, data: email })
  }))

  /**
   * Quick send: paste subject + body, target a contact email at a company, send in one shot.
   * Resolves/creates company, contact, and deal as needed; runs createDraft → approve → send.
   * Use this for the Step-1 paste-from-Claude UX so the user does not navigate the workspace flow.
   */
  app.post('/crm/quick-send', asyncHandler(async (req, res) => {
    const parsed = quickSendSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() })
    const db = getCrmDb()
    if (!requireCrmDb(res, db)) return

    const deals = new DealsService(db)
    const interactions = new InteractionsService(db)
    const emails = new EmailsService(db, interactions, resendOutbound, deals, getGmailOutbound())

    let companyId: string | null = parsed.data.company_id ?? null

    if (!companyId && parsed.data.orgnr) {
      const byOrgnr = await db.getCompanyByOrgnr(parsed.data.orgnr)
      if (byOrgnr?.id) companyId = byOrgnr.id as string
    }

    if (!companyId) {
      if (!parsed.data.company_name) {
        return res
          .status(400)
          .json({ success: false, error: 'company_id or company_name is required' })
      }
      const orgnr = parsed.data.orgnr?.trim() || `crm-ext-${randomUUID().replace(/-/g, '')}`
      const created = await db.insertCompany({
        orgnr,
        name: parsed.data.company_name.trim(),
        website: parsed.data.website?.trim() || undefined,
      })
      companyId = created.id as string
    } else {
      const exists = await db.getCompany(companyId)
      if (!exists) return res.status(404).json({ success: false, error: 'Company not found' })
    }

    const targetEmail = parsed.data.to_email.trim().toLowerCase()
    const existingContacts = await db.listContactsByCompany(companyId)
    let contact = existingContacts.find(
      (c) => typeof c.email === 'string' && c.email.toLowerCase() === targetEmail
    ) ?? null

    if (!contact) {
      const hasPrimary = existingContacts.some((c) => c.is_primary === true)
      contact = await db.createContact({
        company_id: companyId,
        email: parsed.data.to_email.trim(),
        full_name: parsed.data.recipient_name?.trim() || undefined,
        is_primary: !hasPrimary,
      })
    } else if (parsed.data.recipient_name && !contact.full_name) {
      const updated = await db.updateContact(contact.id as string, {
        full_name: parsed.data.recipient_name.trim(),
      })
      contact = updated ?? contact
    }

    const deal = await deals.getOrCreateByCompany(companyId)

    const draft = await emails.createDraft({
      deal_id: deal.id as string,
      contact_id: contact.id as string,
      subject: parsed.data.subject,
      body_text: parsed.data.body_text,
      body_html: parsed.data.body_html,
    })

    try {
      await emails.approve(draft.id as string, {})
      const sub = await getAuth0SubFromBearer(req.headers?.authorization)
      const sent = await emails.send(draft.id as string, { auth0Sub: sub })
      return res.json({
        success: true,
        data: {
          email_id: draft.id,
          deal_id: deal.id,
          company_id: companyId,
          contact_id: contact.id,
          status: sent.status,
          sent_at: sent.sent_at,
        },
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[CRM] POST /crm/quick-send failed during send:', msg)
      const lower = msg.toLowerCase()
      const isClient =
        lower.includes('contact email missing') ||
        lower.includes('required for crm send') ||
        lower.includes('resend_reply_domain is required') ||
        lower.includes('deal and contact must belong') ||
        lower.includes('connect gmail') ||
        lower.includes('sign in is required') ||
        lower.includes('gmail is not connected') ||
        lower.includes('gmail send is not configured')
      const isResend = lower.includes('resend')
      const status = isClient ? 400 : isResend ? 502 : 500
      // Draft was created and may be left in 'approved' state; surface so caller can retry/edit.
      return res.status(status).json({
        success: false,
        error: msg,
        data: {
          email_id: draft.id,
          deal_id: deal.id,
          company_id: companyId,
          contact_id: contact.id,
        },
      })
    }
  }))

  app.get('/crm/deals/:dealId/emails', asyncHandler(async (req, res) => {
    const db = getCrmDb()
    if (!requireCrmDb(res, db)) return
    const rows = await db.listOutboundEmailsByDeal(req.params.dealId)
    return res.json({ success: true, data: rows })
  }))

  /** Recent outbound emails across all deals — feeds the CRM home "Sent" panel. */
  app.get('/crm/recent-sent', asyncHandler(async (req, res) => {
    const db = getCrmDb()
    if (!requireCrmDb(res, db)) return
    const limit =
      typeof req.query.limit === 'string'
        ? Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20))
        : 20
    const rows = await db.listRecentOutboundEmails(limit)
    return res.json({ success: true, data: rows })
  }))

  app.patch('/crm/deals/:dealId', asyncHandler(async (req, res) => {
    const parsed = patchDealSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() })
    const db = getCrmDb()
    if (!requireCrmDb(res, db)) return
    const existing = await db.getDealById(req.params.dealId)
    if (!existing) return res.status(404).json({ success: false, error: 'Deal not found' })
    const updated = await db.patchDeal(req.params.dealId, { next_action_at: parsed.data.next_action_at })
    return res.json({ success: true, data: updated })
  }))

  app.patch('/crm/emails/:emailId', asyncHandler(async (req, res) => {
    const parsed = updateDraftEmailSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() })
    const db = getCrmDb()
    if (!requireCrmDb(res, db)) return

    const email = await db.getEmailById(req.params.emailId)
    if (!email) return res.status(404).json({ success: false, error: 'Email not found' })
    if (email.status !== 'draft') {
      return res.status(400).json({ success: false, error: 'Only draft emails can be edited here' })
    }

    const deals = new DealsService(db)
    const interactions = new InteractionsService(db)
    const service = new EmailsService(db, interactions, resendOutbound, deals, getGmailOutbound())

    const payload: Record<string, string> = {}
    if (parsed.data.subject !== undefined) payload.subject = parsed.data.subject
    if (parsed.data.body_text !== undefined) payload.body_text = parsed.data.body_text
    if (parsed.data.body_html !== undefined) {
      const t =
        parsed.data.body_text !== undefined ? parsed.data.body_text : (email.body_text as string)
      payload.body_html = service.buildInstrumentedHtml(
        parsed.data.body_html,
        email.tracking_id as string,
        t,
      )
    } else if (parsed.data.body_text !== undefined) {
      payload.body_html = service.buildInstrumentedHtml(
        null,
        email.tracking_id as string,
        parsed.data.body_text,
      )
    }
    const data = await db.updateEmail(req.params.emailId, payload)
    return res.json({ success: true, data })
  }))

  app.post('/crm/emails/:emailId/approve', asyncHandler(async (req, res) => {
    const parsed = approveEmailSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() })
    const db = getCrmDb()
    if (!requireCrmDb(res, db)) return

    const deals = new DealsService(db)
    const interactions = new InteractionsService(db)
    const service = new EmailsService(db, interactions, resendOutbound, deals, getGmailOutbound())
    const data = await service.approve(req.params.emailId, parsed.data)
    return res.json({ success: true, data })
  }))

  app.get('/crm/email-threads/:threadId/messages', asyncHandler(async (req, res) => {
    const db = getCrmDb()
    if (!requireCrmDb(res, db)) return
    const rows = await db.listCrmEmailMessagesByThreadId(req.params.threadId)
    return res.json({ success: true, data: rows })
  }))

  app.post('/crm/emails/:emailId/send', asyncHandler(async (req, res) => {
    const parsed = sendCrmEmailSchema.safeParse(req.body ?? {})
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() })
    const db = getCrmDb()
    if (!requireCrmDb(res, db)) return

    const deals = new DealsService(db)
    const interactions = new InteractionsService(db)
    const service = new EmailsService(db, interactions, resendOutbound, deals, getGmailOutbound())
    const sub = await getAuth0SubFromBearer(req.headers?.authorization)
    try {
      const data = await service.send(req.params.emailId, {
        sendProvider: parsed.data.send_provider,
        auth0Sub: sub,
      })
      return res.json({ success: true, data })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[CRM] POST /crm/emails/:emailId/send failed:', msg)
      const lower = msg.toLowerCase()
      const isClient =
        lower.includes('must be approved') ||
        lower.includes('contact email missing') ||
        lower.includes('required for crm send') ||
        lower.includes('resend_reply_domain is required') ||
        lower.includes('deal and contact must belong') ||
        lower.includes('connect gmail') ||
        lower.includes('sign in is required') ||
        lower.includes('gmail is not connected') ||
        lower.includes('gmail send is not configured')
      const isResend = lower.includes('resend')
      const status = isClient ? 400 : isResend ? 502 : 500
      return res.status(status).json({ success: false, error: msg })
    }
  }))

  app.post('/crm/deals/:dealId/notes', asyncHandler(async (req, res) => {
    const parsed = addNoteSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() })
    const db = getCrmDb()
    if (!requireCrmDb(res, db)) return
    const interactions = new InteractionsService(db)
    const data = await interactions.create({
      deal_id: req.params.dealId,
      type: 'note_added',
      summary: parsed.data.summary,
      metadata: parsed.data.metadata,
    })
    return res.json({ success: true, data })
  }))

  app.post('/crm/deals/:dealId/status', asyncHandler(async (req, res) => {
    const parsed = updateStatusSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() })
    const db = getCrmDb()
    if (!requireCrmDb(res, db)) return
    const deals = new DealsService(db)
    const interactions = new InteractionsService(db)
    const updated = await deals.updateStatus(req.params.dealId, parsed.data.status as any)
    await interactions.create({
      deal_id: req.params.dealId,
      type: 'status_changed',
      summary: parsed.data.summary || `Deal status changed to ${parsed.data.status}`,
      metadata: { status: parsed.data.status },
    })
    return res.json({ success: true, data: updated })
  }))

  app.get('/crm/deals/:dealId/timeline', asyncHandler(async (req, res) => {
    const db = getCrmDb()
    if (!requireCrmDb(res, db)) return
    const interactions = new InteractionsService(db)
    const data = await interactions.timeline(req.params.dealId)
    return res.json({ success: true, data })
  }))

  app.post('/crm/deals/:dealId/enroll-sequence', asyncHandler(async (req, res) => {
    const parsed = enrollSequenceSchema.safeParse(req.body || {})
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() })
    const db = getCrmDb()
    if (!requireCrmDb(res, db)) return
    const interactions = new InteractionsService(db)
    const sequences = new SequencesService(db, interactions)
    const sequenceId = parsed.data.sequence_id || (await sequences.getDefaultSequenceId())
    if (!sequenceId) return res.status(400).json({ success: false, error: 'No sequence available' })
    const data = await sequences.enrollDeal(req.params.dealId, sequenceId)
    return res.json({ success: true, data })
  }))

  app.get('/track/open/:trackingId', asyncHandler(async (req, res) => {
    const db = getCrmDb()
    if (!requireCrmDb(res, db)) return
    const tracking = new TrackingService(db, new InteractionsService(db))

    await tracking.trackOpen(req.params.trackingId, {
      user_agent: req.get('user-agent'),
      ip_address: req.ip,
      referer: req.get('referer'),
    })

    res.setHeader('Content-Type', 'image/gif')
    res.setHeader('Cache-Control', 'no-store')
    return res.send(PIXEL_BUFFER)
  }))

  app.get('/track/page/:trackingId', asyncHandler(async (req, res) => {
    const db = getCrmDb()
    if (!requireCrmDb(res, db)) return
    const tracking = new TrackingService(db, new InteractionsService(db))

    await tracking.trackPageView(req.params.trackingId, {
      user_agent: req.get('user-agent'),
      ip_address: req.ip,
      referer: req.get('referer'),
    })

    res.setHeader('Content-Type', 'image/gif')
    res.setHeader('Cache-Control', 'no-store')
    return res.send(PIXEL_BUFFER)
  }))

  app.get('/track/section/:trackingId', asyncHandler(async (req: Request, res: Response) => {
    const sectionId = typeof req.query.section === 'string' ? req.query.section : undefined
    if (!sectionId) return res.status(400).send('Missing section query param')

    const db = getCrmDb()
    if (!requireCrmDb(res, db)) return
    const tracking = new TrackingService(db, new InteractionsService(db))

    await tracking.trackSectionView(req.params.trackingId, sectionId, {
      user_agent: req.get('user-agent'),
      ip_address: req.ip,
      referer: req.get('referer'),
    })

    res.setHeader('Content-Type', 'image/gif')
    res.setHeader('Cache-Control', 'no-store')
    return res.send(PIXEL_BUFFER)
  }))

  app.get('/track/click/:trackingId', asyncHandler(async (req: Request, res: Response) => {
    const redirectUrl = typeof req.query.url === 'string' ? req.query.url : undefined
    if (!isSafeRedirect(redirectUrl)) return res.status(400).send('Invalid redirect URL')

    const db = getCrmDb()
    if (!requireCrmDb(res, db)) return
    const tracking = new TrackingService(db, new InteractionsService(db))

    await tracking.trackClick(req.params.trackingId, {
      user_agent: req.get('user-agent'),
      ip_address: req.ip,
      referer: req.get('referer'),
      redirect_url: redirectUrl,
    })

    return res.redirect(302, redirectUrl!)
  }))
}
