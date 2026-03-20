import type { Express, Request, Response, NextFunction } from 'express'
import type { CrmDb } from '../services/crm/db-interface.js'
import { addNoteSchema, approveEmailSchema, createContactSchema, enrollSequenceSchema, fromCompanySchema, generateEmailSchema, updateContactSchema, updateStatusSchema } from '../services/crm/validation.js'
import { DealsService } from '../services/crm/deals.service.js'
import { ContactsService } from '../services/crm/contacts.service.js'
import { InteractionsService } from '../services/crm/interactions.service.js'
import { TrackingService } from '../services/crm/tracking.service.js'
import { SequencesService } from '../services/crm/sequences.service.js'
import { GmailService } from '../services/gmail/gmail.service.js'
import { EmailsService } from '../services/crm/emails.service.js'
import { OutreachEmailService } from '../services/ai/outreach-email.service.js'
import { CRMOverviewService } from '../services/crm/overview.service.js'

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

export function registerCrmRoutes(app: Express, getCrmDb: () => CrmDb | null) {
  app.get('/crm/companies', asyncHandler(async (req, res) => {
    const db = getCrmDb()
    if (!requireCrmDb(res, db)) return
    const search = typeof req.query.search === 'string' ? req.query.search : undefined
    const limit = typeof req.query.limit === 'string' ? Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50)) : 50
    const data = await db.listCompanies(search, limit)
    return res.json({ success: true, data })
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
    const emails = new EmailsService(db, interactions, new GmailService(), deals)
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
    const emails = new EmailsService(db, interactions, new GmailService(), deals)
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

  app.post('/crm/emails/:emailId/approve', asyncHandler(async (req, res) => {
    const parsed = approveEmailSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() })
    const db = getCrmDb()
    if (!requireCrmDb(res, db)) return

    const deals = new DealsService(db)
    const interactions = new InteractionsService(db)
    const service = new EmailsService(db, interactions, new GmailService(), deals)
    const data = await service.approve(req.params.emailId, parsed.data)
    return res.json({ success: true, data })
  }))

  app.post('/crm/emails/:emailId/send', asyncHandler(async (req, res) => {
    const db = getCrmDb()
    if (!requireCrmDb(res, db)) return

    const deals = new DealsService(db)
    const interactions = new InteractionsService(db)
    const service = new EmailsService(db, interactions, new GmailService(), deals)
    const data = await service.send(req.params.emailId)
    return res.json({ success: true, data })
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
