import type { Express, Request, Response } from 'express'
import { SupabaseClient } from '@supabase/supabase-js'
import { addNoteSchema, approveEmailSchema, createContactSchema, enrollSequenceSchema, fromCompanySchema, generateEmailSchema, updateContactSchema, updateStatusSchema } from '../services/crm/validation.js'
import { DealsService } from '../services/crm/deals.service.js'
import { ContactsService } from '../services/crm/contacts.service.js'
import { InteractionsService } from '../services/crm/interactions.service.js'
import { TrackingService } from '../services/crm/tracking.service.js'
import { SequencesService } from '../services/crm/sequences.service.js'
import { GmailService } from '../services/gmail/gmail.service.js'
import { EmailsService } from '../services/crm/emails.service.js'
import { OutreachEmailService } from '../services/ai/outreach-email.service.js'
import { CRM_SCHEMA } from '../services/crm/types.js'
import { CRMOverviewService } from '../services/crm/overview.service.js'

const PIXEL_BUFFER = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64')

function requireSupabase(res: Response, supabase: SupabaseClient | null): supabase is SupabaseClient {
  if (!supabase) {
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

async function loadOutreachContext(supabase: SupabaseClient, companyId: string) {
  const [company, profile, strategy, valueCreation] = await Promise.all([
    supabase.schema(CRM_SCHEMA).from('companies').select('id,name,industry,website,headquarters').eq('id', companyId).single(),
    supabase.schema(CRM_SCHEMA).from('company_profiles').select('summary,business_model').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.schema(CRM_SCHEMA).from('strategy').select('investment_thesis,acquisition_rationale').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.schema(CRM_SCHEMA).from('value_creation').select('initiatives').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  return {
    company: company.data,
    profile: profile.data,
    strategy: strategy.data,
    valueCreation: valueCreation.data,
  }
}

export function registerCrmRoutes(app: Express, getSupabase: () => SupabaseClient | null) {
  app.post('/crm/deals/from-company', async (req, res) => {
    const parsed = fromCompanySchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() })

    const supabase = getSupabase()
    if (!requireSupabase(res, supabase)) return
    const dealsService = new DealsService(supabase)
    const deal = await dealsService.getOrCreateByCompany(parsed.data.company_id)
    return res.json({ success: true, data: deal })
  })

  app.get('/crm/company/:companyId', async (req, res) => {
    const supabase = getSupabase()
    if (!requireSupabase(res, supabase)) return
    const interactions = new InteractionsService(supabase)
    const deals = new DealsService(supabase)
    const contacts = new ContactsService(supabase)
    const emails = new EmailsService(supabase, interactions, new GmailService(), deals)
    const overview = new CRMOverviewService(supabase, deals, contacts, emails, interactions)
    const payload = await overview.companyOverview(req.params.companyId)
    return res.json({ success: true, data: payload })
  })

  app.post('/crm/contacts', async (req, res) => {
    const parsed = createContactSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() })
    const supabase = getSupabase()
    if (!requireSupabase(res, supabase)) return
    const service = new ContactsService(supabase)
    const data = await service.create(parsed.data)
    return res.json({ success: true, data })
  })

  app.patch('/crm/contacts/:contactId', async (req, res) => {
    const parsed = updateContactSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() })
    const supabase = getSupabase()
    if (!requireSupabase(res, supabase)) return
    const service = new ContactsService(supabase)
    const data = await service.update(req.params.contactId, parsed.data)
    return res.json({ success: true, data })
  })

  app.post('/crm/emails/generate', async (req, res) => {
    const parsed = generateEmailSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() })
    const supabase = getSupabase()
    if (!requireSupabase(res, supabase)) return

    const deals = new DealsService(supabase)
    const interactions = new InteractionsService(supabase)
    const emails = new EmailsService(supabase, interactions, new GmailService(), deals)
    const aiService = new OutreachEmailService()

    const deal = await deals.getOrCreateByCompany(parsed.data.company_id)
    const { data: contact } = await supabase.schema(CRM_SCHEMA).from('contacts').select('*').eq('id', parsed.data.contact_id).single()
    const context = await loadOutreachContext(supabase, parsed.data.company_id)

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
  })

  app.post('/crm/emails/:emailId/approve', async (req, res) => {
    const parsed = approveEmailSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() })
    const supabase = getSupabase()
    if (!requireSupabase(res, supabase)) return

    const deals = new DealsService(supabase)
    const interactions = new InteractionsService(supabase)
    const service = new EmailsService(supabase, interactions, new GmailService(), deals)
    const data = await service.approve(req.params.emailId, parsed.data)
    return res.json({ success: true, data })
  })

  app.post('/crm/emails/:emailId/send', async (req, res) => {
    const supabase = getSupabase()
    if (!requireSupabase(res, supabase)) return

    const deals = new DealsService(supabase)
    const interactions = new InteractionsService(supabase)
    const service = new EmailsService(supabase, interactions, new GmailService(), deals)
    const data = await service.send(req.params.emailId)
    return res.json({ success: true, data })
  })

  app.post('/crm/deals/:dealId/notes', async (req, res) => {
    const parsed = addNoteSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() })
    const supabase = getSupabase()
    if (!requireSupabase(res, supabase)) return
    const interactions = new InteractionsService(supabase)
    const data = await interactions.create({
      deal_id: req.params.dealId,
      type: 'note_added',
      summary: parsed.data.summary,
      metadata: parsed.data.metadata,
    })
    return res.json({ success: true, data })
  })

  app.post('/crm/deals/:dealId/status', async (req, res) => {
    const parsed = updateStatusSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() })
    const supabase = getSupabase()
    if (!requireSupabase(res, supabase)) return
    const deals = new DealsService(supabase)
    const interactions = new InteractionsService(supabase)
    const updated = await deals.updateStatus(req.params.dealId, parsed.data.status as any)
    await interactions.create({
      deal_id: req.params.dealId,
      type: 'status_changed',
      summary: parsed.data.summary || `Deal status changed to ${parsed.data.status}`,
      metadata: { status: parsed.data.status },
    })
    return res.json({ success: true, data: updated })
  })

  app.get('/crm/deals/:dealId/timeline', async (req, res) => {
    const supabase = getSupabase()
    if (!requireSupabase(res, supabase)) return
    const interactions = new InteractionsService(supabase)
    const data = await interactions.timeline(req.params.dealId)
    return res.json({ success: true, data })
  })

  app.post('/crm/deals/:dealId/enroll-sequence', async (req, res) => {
    const parsed = enrollSequenceSchema.safeParse(req.body || {})
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() })
    const supabase = getSupabase()
    if (!requireSupabase(res, supabase)) return
    const interactions = new InteractionsService(supabase)
    const sequences = new SequencesService(supabase, interactions)
    const sequenceId = parsed.data.sequence_id || (await sequences.getDefaultSequenceId())
    if (!sequenceId) return res.status(400).json({ success: false, error: 'No sequence available' })
    const data = await sequences.enrollDeal(req.params.dealId, sequenceId)
    return res.json({ success: true, data })
  })

  app.get('/track/open/:trackingId', async (req, res) => {
    const supabase = getSupabase()
    if (!requireSupabase(res, supabase)) return
    const tracking = new TrackingService(supabase, new InteractionsService(supabase))

    await tracking.trackOpen(req.params.trackingId, {
      user_agent: req.get('user-agent'),
      ip_address: req.ip,
      referer: req.get('referer'),
    })

    res.setHeader('Content-Type', 'image/gif')
    res.setHeader('Cache-Control', 'no-store')
    return res.send(PIXEL_BUFFER)
  })

  app.get('/track/click/:trackingId', async (req: Request, res: Response) => {
    const redirectUrl = typeof req.query.url === 'string' ? req.query.url : undefined
    if (!isSafeRedirect(redirectUrl)) return res.status(400).send('Invalid redirect URL')

    const supabase = getSupabase()
    if (!requireSupabase(res, supabase)) return
    const tracking = new TrackingService(supabase, new InteractionsService(supabase))

    await tracking.trackClick(req.params.trackingId, {
      user_agent: req.get('user-agent'),
      ip_address: req.ip,
      referer: req.get('referer'),
      redirect_url: redirectUrl,
    })

    return res.redirect(302, redirectUrl!)
  })
}
