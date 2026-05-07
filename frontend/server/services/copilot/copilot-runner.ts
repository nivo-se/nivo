import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages'
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions'
import type { CrmDb } from '../crm/db-interface.js'
import { DealsService } from '../crm/deals.service.js'
import { ContactsService } from '../crm/contacts.service.js'
import { InteractionsService } from '../crm/interactions.service.js'
import { EmailsService } from '../crm/emails.service.js'
import { CRMOverviewService } from '../crm/overview.service.js'
import { OutreachEmailService } from '../ai/outreach-email.service.js'
import { ResendEmailService } from '../resend/resend-email.service.js'
import type { GmailOutboundService } from '../gmail/gmail-outbound.service.js'
import { searchUniverseForCopilot } from './universe-search.js'
import { getPlaybookById } from './playbooks.js'
import {
  openAiChatToolsToAnthropic,
  resolveCopilotLlmVendor,
} from './llm-provider.js'

const MAX_TOOL_ROUNDS = 8
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'

export interface CopilotMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface CopilotContext {
  page?: 'crm' | 'crm_workspace' | 'universe' | 'deep_research' | 'sourcing'
  companyId?: string
  orgnr?: string
}

export interface CopilotSavedDraft {
  email_id: string
  company_id: string
  subject?: string
}

export interface CopilotRunResult {
  reply: string
  toolTrace: Array<{ name: string; ok: boolean; summary: string }>
  /** Drafts successfully written to CRM (`emails` row, status draft) during this turn */
  savedDrafts?: CopilotSavedDraft[]
}

async function loadOutreachContext(db: CrmDb, companyId: string) {
  const [company, profile, strategy, valueCreation] = await Promise.all([
    db.getCompany(companyId),
    db.getCompanyProfile(companyId),
    db.getStrategy(companyId),
    db.getValueCreation(companyId),
  ])
  return { company, profile, strategy, valueCreation }
}

function compactOverview(raw: Awaited<ReturnType<CRMOverviewService['companyOverview']>>) {
  const timeline = (raw.activity_timeline ?? []) as Array<Record<string, unknown>>
  const tail = timeline.slice(-10).map((t) => ({
    type: t.type,
    at: t.occurred_at ?? t.at,
    label: (t.summary as string) ?? (t.note as string) ?? (t.kind as string) ?? 'event',
  }))
  return {
    company: raw.company
      ? {
          id: raw.company.id,
          name: raw.company.name,
          orgnr: raw.company.orgnr,
          industry: raw.company.industry,
          website: raw.company.website,
        }
      : null,
    deal: raw.deal
      ? {
          id: raw.deal.id,
          status: raw.deal.status,
          next_action_at: raw.deal.next_action_at,
        }
      : null,
    contacts: (raw.contacts ?? []).map((c: Record<string, unknown>) => ({
      id: c.id,
      email: c.email,
      full_name: c.full_name,
      title: c.title,
      is_primary: c.is_primary,
    })),
    latest_outbound_email: raw.latest_outbound_email
      ? {
          id: (raw.latest_outbound_email as Record<string, unknown>).id,
          status: (raw.latest_outbound_email as Record<string, unknown>).status,
          subject: (raw.latest_outbound_email as Record<string, unknown>).subject,
        }
      : null,
    next_action: raw.next_action,
    engagement_summary: raw.engagement_summary,
    timeline_tail: tail,
  }
}

const BASE_COPILOT_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_universe',
      description:
        'Search the local Universe database (read-only) for Swedish companies. Revenue filter uses stored latest revenue in SEK.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Substring match on legal name or orgnr' },
          min_revenue_sek: { type: 'number', description: 'Minimum latest annual revenue, SEK' },
          limit: { type: 'integer', description: 'Max companies to return (1–25)', default: 8 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_crm_companies',
      description: 'List companies already in CRM (Postgres).',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Optional name filter' },
          limit: { type: 'integer', default: 15 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_crm_deal_summary',
      description:
        'Summarize one CRM company: contacts, deal status, recent timeline, engagement. Pass company_id (UUID) or orgnr.',
      parameters: {
        type: 'object',
        properties: {
          company_id: { type: 'string', description: 'CRM company UUID' },
          orgnr: { type: 'string', description: 'If company_id unknown, resolve via orgnr' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_email_draft',
      description:
        'REQUIRED to persist an email in Nivo CRM: writes a row in `emails` with status draft (same as workspace). ' +
        'Does NOT send mail. If you only type email prose in chat without calling this tool, nothing is saved. ' +
        'Prefer get_crm_deal_summary first for context. company_id defaults to the active workspace company when omitted. ' +
        'contact_id defaults to the primary contact (or first contact) when omitted.',
      parameters: {
        type: 'object',
        properties: {
          company_id: {
            type: 'string',
            description: 'CRM company UUID; omit when the user already has this company open in the workspace',
          },
          contact_id: {
            type: 'string',
            description: 'Contact UUID; omit to use primary / first contact for the company',
          },
          user_instructions: { type: 'string' },
          reason_for_interest: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'build_deep_research_handoff_url',
      description:
        'Returns a relative URL that opens Deep Research wizard with prefill (orgnr required). User must confirm in UI.',
      parameters: {
        type: 'object',
        properties: {
          orgnr: { type: 'string' },
          name: { type: 'string' },
          website: { type: 'string' },
          from: {
            type: 'string',
            enum: ['company', 'screening', 'gpt_target'],
            description: 'Maps to wizard handoff source',
          },
          campaign: { type: 'string', description: 'Optional campaign name for screening handoff' },
        },
        required: ['orgnr'],
      },
    },
  },
]

function copilotToolsForContext(context?: CopilotContext): ChatCompletionTool[] {
  if (context?.page !== 'sourcing') return BASE_COPILOT_TOOLS
  return BASE_COPILOT_TOOLS.map((t) => {
    if (t.type !== 'function') return t
    const name = t.function.name
    if (name === 'search_universe') {
      return {
        ...t,
        function: {
          ...t.function,
          description:
            'Primary discovery tool for Sourcing: query Nivo’s Universe company database (read-only Postgres/SQLite mirror of screened Swedish companies). '
            + 'Use for new target ideas, sector/size screens, name/orgnr look-ups. Revenue filter is latest annual revenue in SEK. '
            + 'Combine with list_crm_companies to avoid duplicating work already in the CRM pipeline.',
        },
      }
    }
    if (name === 'list_crm_companies') {
      return {
        ...t,
        function: {
          ...t.function,
          description:
            'List companies already stored in Nivo CRM (pipeline DB). On Sourcing, use after search_universe to mark which Universe hits are net-new vs already tracked, or to sanity-check overlap before outreach.',
        },
      }
    }
    if (name === 'get_crm_deal_summary') {
      return {
        ...t,
        function: {
          ...t.function,
          description:
            'Summarize one CRM deal/company: contacts, deal status, timeline, engagement. On Sourcing, use when the user cares about relationship state for an orgnr or selected row; pass orgnr or company_id.',
        },
      }
    }
    if (name === 'build_deep_research_handoff_url') {
      return {
        ...t,
        function: {
          ...t.function,
          description:
            'Build /deep-research prefill URL. On Sourcing flows prefer from=screening or from=gpt_target when it matches how the user is working.',
        },
      }
    }
    return t
  })
}

function baseSystem(context?: CopilotContext, playbookHint?: string): string {
  const isSourcing = context?.page === 'sourcing'

  const bits: string[] = isSourcing
    ? [
        'You are Nivo Sourcing Copilot — focused on finding acquisition targets in Nivo’s Universe (local Swedish company database) and cross-checking Nivo CRM so pipeline work stays coherent.',
        'Universe vs CRM: Use search_universe to surface candidates from the company dataset (names, orgnr, revenue in SEK). Use list_crm_companies and get_crm_deal_summary to see what is already in the CRM pipeline, deal stage, and recent engagement.',
        'When the user describes sectors, size bands, or “ companies like X ”, translate that into concrete search_universe calls (search, min_revenue_sek, limit). Never invent orgnr, revenue, or emails — only report tool output.',
        'After listing Universe hits on Sourcing, prefer calling list_crm_companies (or get_crm_deal_summary per orgnr) when they need to know “are we already on this?”',
        'If orgnr is provided in context or by the user, use get_crm_deal_summary for CRM state; use search_universe with that orgnr/name for raw universe listing context.',
        'Deep research handoffs from Sourcing: prefer build_deep_research_handoff_url with from=screening or from=gpt_target unless the user says they came from a company record.',
        'You cannot send email. create_email_draft only creates a draft; humans approve and send in CRM. If they ask for a saved outreach draft, you MUST call create_email_draft (after get_crm_deal_summary when contacts are needed).',
        'Prefer short bullet lists when returning many companies; include orgnr when the tool returns it.',
      ]
    : [
        'You are Nivo Copilot — a scoped assistant for Universe discovery, CRM, and Deep Research handoff.',
        'Rules: Use tools for factual company data; never invent orgnr or email addresses.',
        'You cannot send email. create_email_draft only creates a draft; humans approve and send in CRM.',
        'Email drafts in CRM: If the user asks to draft, write, compose, save, or prepare an email and they want it in Nivo, you MUST call create_email_draft. '
          + 'Pasting email text only in your reply does NOT save anything to the database.',
        'Workflow: call get_crm_deal_summary when you need contacts, then create_email_draft (you may omit contact_id to use the primary contact).',
        'Prefer concise answers with short bullets when listing companies.',
      ]

  if (context?.page && !isSourcing) bits.push(`Current page context: ${context.page}.`)
  if (isSourcing) bits.push('Surface: Sourcing chat — user is also using the left-panel sourcing assistant for universe filters; you complement that with authoritative DB lookups via tools.')
  if (context?.companyId) bits.push(`Active CRM company UUID: ${context.companyId}.`)
  if (context?.orgnr) bits.push(`Context orgnr hint: ${context.orgnr}.`)
  if (playbookHint) bits.push(playbookHint)
  return bits.join('\n')
}

function parseToolArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw || '{}') as Record<string, unknown>
  } catch {
    return {}
  }
}

/** User asked for an email draft that should live in CRM (not chat-only). */
function wantsSavedEmailDraft(userText: string): boolean {
  const t = userText.toLowerCase()
  if (
    /don't save|do not save|just (show|give|write it here)|in chat only|don't (put|store)|no need to save/i.test(
      t
    )
  ) {
    return false
  }
  return (
    /\b(draft|compose)\b/.test(t) ||
    /write (an? )?email/.test(t) ||
    /email draft/.test(t) ||
    /save (a |the )?draft/.test(t) ||
    /prepare (an? )?email/.test(t) ||
    /\boutreach\b/.test(t) ||
    /follow[- ]?up (email|message)?/.test(t)
  )
}

function lastUserMessageText(messages: CopilotMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'user') return messages[i]!.content
  }
  return ''
}

function anthropicMessageText(msg: Anthropic.Message): string {
  const parts: string[] = []
  for (const b of msg.content) {
    if (b.type === 'text') parts.push(b.text)
  }
  return parts.join('\n').trim()
}

export async function runNivoCopilot(opts: {
  messages: CopilotMessage[]
  playbookId?: string
  context?: CopilotContext
  db: CrmDb
  getGmailOutbound: () => GmailOutboundService | null
}): Promise<CopilotRunResult> {
  const vendor = resolveCopilotLlmVendor()
  if (vendor === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY is not configured (CRM_LLM_PROVIDER or COPILOT_LLM_PROVIDER is anthropic)'
    )
  }
  if (vendor === 'openai' && !process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured')
  }

  const openai =
    vendor === 'openai' ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }) : null
  const anthropic =
    vendor === 'anthropic' ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! }) : null
  const playbook = getPlaybookById(opts.playbookId)

  const deals = new DealsService(opts.db)
  const contacts = new ContactsService(opts.db)
  const interactions = new InteractionsService(opts.db)
  const resend = new ResendEmailService()
  const emails = new EmailsService(opts.db, interactions, resend, deals, opts.getGmailOutbound())
  const overview = new CRMOverviewService(opts.db, deals, contacts, emails, interactions)

  const toolTrace: CopilotRunResult['toolTrace'] = []
  const savedDrafts: CopilotSavedDraft[] = []

  async function resolveCompanyIdToUuid(raw: string | undefined | null): Promise<string | null> {
    const trimmed = typeof raw === 'string' ? raw.trim() : ''
    if (!trimmed) return null
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (uuidRegex.test(trimmed)) return trimmed
    const by = await opts.db.getCompanyByOrgnr(trimmed)
    return by?.id ? String(by.id) : null
  }

  async function runTool(name: string, argsRaw: string): Promise<string> {
    const args = parseToolArgs(argsRaw)
    try {
      if (name === 'search_universe') {
        const out = searchUniverseForCopilot({
          search: typeof args.search === 'string' ? args.search : undefined,
          min_revenue_sek: typeof args.min_revenue_sek === 'number' ? args.min_revenue_sek : undefined,
          limit: typeof args.limit === 'number' ? args.limit : 8,
        })
        toolTrace.push({
          name,
          ok: out.ok,
          summary: out.ok ? `${out.rows?.length ?? 0} universe rows` : out.error ?? 'failed',
        })
        return JSON.stringify(out)
      }

      if (name === 'list_crm_companies') {
        const search = typeof args.search === 'string' ? args.search : undefined
        const limit =
          typeof args.limit === 'number' ? Math.min(50, Math.max(1, args.limit)) : 15
        const rows = await opts.db.listCompanies(search, limit, 'name')
        toolTrace.push({ name, ok: true, summary: `${rows.length} CRM companies` })
        return JSON.stringify({
          companies: rows.map((r: Record<string, unknown>) => ({
            id: r.id,
            name: r.name,
            orgnr: r.orgnr,
            deal_status: r.deal_status,
          })),
        })
      }

      if (name === 'get_crm_deal_summary') {
        let companyId =
          typeof args.company_id === 'string' ? args.company_id.trim() : opts.context?.companyId
        const orgnrArg = typeof args.orgnr === 'string' ? args.orgnr.trim() : undefined
        const orgnrCtx = opts.context?.orgnr?.trim() || undefined
        const orgnrResolved = orgnrArg || orgnrCtx
        if (!companyId && orgnrResolved) {
          const by = await opts.db.getCompanyByOrgnr(orgnrResolved)
          companyId = by?.id as string | undefined
        }
        if (!companyId) {
          toolTrace.push({ name, ok: false, summary: 'missing company_id' })
          return JSON.stringify({ error: 'Provide company_id or orgnr (or open a company in CRM).' })
        }
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        let cid = companyId
        if (!uuidRegex.test(cid)) {
          const by = await opts.db.getCompanyByOrgnr(cid)
          if (!by?.id) {
            toolTrace.push({ name, ok: false, summary: 'company not found' })
            return JSON.stringify({ error: 'Company not found for id/orgnr' })
          }
          cid = by.id as string
        }
        const full = await overview.companyOverview(cid)
        const compact = compactOverview(full)
        toolTrace.push({ name, ok: true, summary: compact.company?.name?.toString() ?? cid })
        return JSON.stringify(compact)
      }

      if (name === 'create_email_draft') {
        const fromArgs =
          typeof args.company_id === 'string' && args.company_id.trim()
            ? args.company_id.trim()
            : opts.context?.companyId?.trim() || ''
        const orgFallback = opts.context?.orgnr?.trim() || ''
        const resolvedCompany = await resolveCompanyIdToUuid(
          fromArgs || orgFallback || null
        )
        if (!resolvedCompany) {
          toolTrace.push({ name, ok: false, summary: 'missing company' })
          return JSON.stringify({
            error:
              'Could not resolve company. Pass company_id or orgnr, open a company workspace, or ask the user which CRM company to use.',
          })
        }

        let contactId =
          typeof args.contact_id === 'string' && args.contact_id.trim()
            ? args.contact_id.trim()
            : ''
        if (!contactId) {
          const list = await opts.db.listContactsByCompany(resolvedCompany)
          const pick =
            (list as Array<Record<string, unknown>>).find((c) => c.is_primary === true) ??
            list[0]
          if (!pick?.id) {
            toolTrace.push({ name, ok: false, summary: 'no contacts' })
            return JSON.stringify({
              error:
                'No contacts on this company. Add a contact in the CRM workspace first, then ask again.',
            })
          }
          contactId = String(pick.id)
        }

        const deal = await deals.getOrCreateByCompany(resolvedCompany)
        const contact = await opts.db.getContactById(contactId)
        if (!contact) {
          toolTrace.push({ name, ok: false, summary: 'contact not found' })
          return JSON.stringify({ error: 'Contact not found' })
        }
        if (String(contact.company_id) !== resolvedCompany) {
          toolTrace.push({ name, ok: false, summary: 'contact mismatch' })
          return JSON.stringify({ error: 'Contact does not belong to company' })
        }
        const aiService = new OutreachEmailService()
        const ctx = await loadOutreachContext(opts.db, resolvedCompany)
        const draft = await aiService.generateDraft({
          companyName: ctx.company?.name,
          industry: ctx.company?.industry,
          companyProfile: ctx.profile?.summary,
          strategicStrengths: ctx.strategy?.investment_thesis,
          reasonForInterest:
            (typeof args.reason_for_interest === 'string' ? args.reason_for_interest : undefined) ||
            ctx.strategy?.acquisition_rationale,
          valueCreationAngle: JSON.stringify(ctx.valueCreation?.initiatives || {}),
          contactName: contact?.full_name,
          contactTitle: contact?.title,
          userInstructions:
            typeof args.user_instructions === 'string' ? args.user_instructions : undefined,
        })
        const email = await emails.createDraft({
          deal_id: deal.id,
          contact_id: contactId,
          subject: draft.subject,
          body_text: draft.body_text,
          body_html: draft.body_html,
          ai_prompt_version: draft.prompt_version,
          generation_context: ctx,
        })
        toolTrace.push({ name, ok: true, summary: `draft ${email.id as string}` })
        savedDrafts.push({
          email_id: String(email.id),
          company_id: resolvedCompany,
          subject: typeof draft.subject === 'string' ? draft.subject : undefined,
        })
        return JSON.stringify({
          ok: true,
          email_id: email.id,
          company_id: resolvedCompany,
          subject: draft.subject,
          message:
            'Draft saved in CRM (emails table, status draft). User must review, approve if required, and send from the workspace — copilot cannot send.',
        })
      }

      if (name === 'build_deep_research_handoff_url') {
        const orgnr = typeof args.orgnr === 'string' ? args.orgnr.trim() : ''
        if (!orgnr) {
          toolTrace.push({ name, ok: false, summary: 'missing orgnr' })
          return JSON.stringify({ error: 'orgnr required' })
        }
        const qs = new URLSearchParams()
        qs.set('orgnr', orgnr)
        if (typeof args.name === 'string' && args.name.trim()) qs.set('name', args.name.trim())
        if (typeof args.website === 'string' && args.website.trim()) qs.set('website', args.website.trim())
        if (typeof args.from === 'string' && args.from) qs.set('from', args.from)
        if (typeof args.campaign === 'string' && args.campaign.trim()) qs.set('campaign', args.campaign.trim())
        const path = `/deep-research?${qs.toString()}`
        toolTrace.push({ name, ok: true, summary: `handoff ${orgnr}` })
        return JSON.stringify({
          path,
          note: 'Open this path in the app to launch the research wizard with prefill.',
        })
      }

      toolTrace.push({ name, ok: false, summary: 'unknown tool' })
      return JSON.stringify({ error: `Unknown tool ${name}` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      toolTrace.push({ name, ok: false, summary: msg.slice(0, 120) })
      return JSON.stringify({ error: msg })
    }
  }

  const sys = baseSystem(opts.context, playbook?.systemHint)
  const tools = copilotToolsForContext(opts.context)

  let reply = ''
  let openaiHistory: ChatCompletionMessageParam[] | null = null
  let anthropicConv: MessageParam[] | null = null
  let anthropicTools: ReturnType<typeof openAiChatToolsToAnthropic> | null = null

  if (vendor === 'openai' && openai) {
    openaiHistory = [
      { role: 'system', content: sys },
      ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
    ]

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        temperature: 0.35,
        messages: openaiHistory,
        tools: tools,
        tool_choice: 'auto',
      })

      const choice = completion.choices[0]?.message
      if (!choice) {
        reply = 'The model returned an empty response.'
        break
      }

      if (!choice.tool_calls?.length) {
        reply = choice.content?.trim() || ''
        break
      }

      openaiHistory.push({
        role: 'assistant',
        content: choice.content ?? null,
        tool_calls: choice.tool_calls,
      })

      for (const tc of choice.tool_calls) {
        if (tc.type !== 'function') continue
        const out = await runTool(tc.function.name, tc.function.arguments)
        openaiHistory.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: out,
        })
      }
    }

    if (!reply) {
      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        temperature: 0.35,
        messages: openaiHistory,
      })
      reply =
        completion.choices[0]?.message?.content?.trim() ||
        'Could not generate a reply. Check OpenAI logs and try again.'
    }
  } else if (anthropic) {
    anthropicTools = openAiChatToolsToAnthropic(tools)
    anthropicConv = opts.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 8192,
        temperature: 0.35,
        system: sys,
        messages: anthropicConv,
        tools: anthropicTools,
      })

      if (response.stop_reason === 'tool_use') {
        anthropicConv.push({ role: 'assistant', content: response.content })
        const toolResults: ToolResultBlockParam[] = []
        for (const block of response.content) {
          if (block.type === 'tool_use') {
            const argsRaw = JSON.stringify(block.input ?? {})
            const out = await runTool(block.name, argsRaw)
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: out,
            })
          }
        }
        if (toolResults.length === 0) {
          reply = anthropicMessageText(response) || 'Tool loop had no tool_use blocks.'
          break
        }
        anthropicConv.push({ role: 'user', content: toolResults })
        continue
      }

      reply = anthropicMessageText(response)
      break
    }

    if (!reply) {
      const final = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 4096,
        temperature: 0.35,
        system: sys,
        messages: anthropicConv,
      })
      reply =
        anthropicMessageText(final) ||
        'Could not generate a reply. Check ANTHROPIC_MODEL and server logs.'
    }
  }

  const lastUserText = lastUserMessageText(opts.messages)
  const draftNudge =
    'The user asked for a CRM-saved email draft. Call create_email_draft once now. ' +
    'Omit company_id if the active workspace company applies. ' +
    'Set user_instructions to what they asked for (from the conversation above).'

  if (
    savedDrafts.length === 0 &&
    (opts.context?.companyId || opts.context?.orgnr?.trim()) &&
    wantsSavedEmailDraft(lastUserText)
  ) {
    if (openai && openaiHistory) {
      openaiHistory.push({ role: 'user', content: draftNudge })
      const forced = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        temperature: 0.35,
        messages: openaiHistory,
        tools: tools,
        tool_choice: { type: 'function', function: { name: 'create_email_draft' } },
      })
      const choice = forced.choices[0]?.message
      if (choice?.tool_calls?.length) {
        openaiHistory.push({
          role: 'assistant',
          content: choice.content ?? null,
          tool_calls: choice.tool_calls,
        })
        for (const tc of choice.tool_calls) {
          if (tc.type !== 'function') continue
          const out = await runTool(tc.function.name, tc.function.arguments)
          openaiHistory.push({ role: 'tool', tool_call_id: tc.id, content: out })
        }
        const wrapUp = await openai.chat.completions.create({
          model: OPENAI_MODEL,
          temperature: 0.35,
          messages: openaiHistory,
        })
        const extra = wrapUp.choices[0]?.message?.content?.trim() || ''
        reply = reply && extra ? `${reply}\n\n${extra}` : reply || extra
      }
    } else if (anthropic && anthropicConv && anthropicTools) {
      anthropicConv.push({ role: 'user', content: draftNudge })
      const forced = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 8192,
        temperature: 0.35,
        system: sys,
        messages: anthropicConv,
        tools: anthropicTools,
        tool_choice: { type: 'tool', name: 'create_email_draft' },
      })
      if (forced.stop_reason === 'tool_use') {
        anthropicConv.push({ role: 'assistant', content: forced.content })
        const toolResults: ToolResultBlockParam[] = []
        for (const block of forced.content) {
          if (block.type === 'tool_use') {
            const out = await runTool(block.name, JSON.stringify(block.input ?? {}))
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: out,
            })
          }
        }
        if (toolResults.length > 0) {
          anthropicConv.push({ role: 'user', content: toolResults })
          const wrapUp = await anthropic.messages.create({
            model: ANTHROPIC_MODEL,
            max_tokens: 4096,
            temperature: 0.35,
            system: sys,
            messages: anthropicConv,
            tools: anthropicTools,
          })
          const extra = anthropicMessageText(wrapUp)
          reply = reply && extra ? `${reply}\n\n${extra}` : reply || extra
        }
      }
    }
  }

  if (savedDrafts.length > 0) {
    const lines = savedDrafts.map((d) => {
      const sub = d.subject ? ` · ${d.subject}` : ''
      return `- [Open workspace to review draft${sub}](/crm/company/${d.company_id}) · email \`${d.email_id}\``
    })
    const footer = ['', '---', '**Saved to CRM as draft** (review in Mailbox workspace):', ...lines].join('\n')
    reply = reply.includes('**Saved to CRM as draft**') ? reply : `${reply}${footer}`
  }

  return {
    reply,
    toolTrace,
    savedDrafts: savedDrafts.length > 0 ? savedDrafts : undefined,
  }
}
