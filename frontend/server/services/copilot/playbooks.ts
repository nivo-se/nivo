/** Pages that can scope playbook visibility or sort order (matches CRM copilot `context.page`). */
export const COPILOT_PAGE_KEYS = [
  'crm',
  'crm_workspace',
  'universe',
  'deep_research',
  'sourcing',
] as const
export type CopilotPageKey = (typeof COPILOT_PAGE_KEYS)[number]

export interface CopilotPlaybook {
  id: string
  title: string
  description: string
  /** Extra instructions merged into the system prompt when this playbook is selected. */
  systemHint: string
  /** Optional first user message suggestion (UI only). */
  starterPrompt?: string
  /**
   * If set, this playbook is only offered when the client passes this `context.page`
   * (e.g. sourcing-only flows). Omit to show on every surface.
   */
  onlyOnPages?: CopilotPageKey[]
}

export const COPILOT_PLAYBOOKS: CopilotPlaybook[] = [
  {
    id: 'sourcing_scan_universe',
    title: 'Scan Universe for targets',
    description:
      'Search Nivo’s Universe company dataset (names, orgnr, revenue bands) to surface new acquisition-style targets.',
    systemHint:
      'Lead with search_universe for discovery. Translate vague asks (sector, size, geography) into concrete tool calls: search string, min_revenue_sek in SEK, limit 8–25. ' +
      'Summarize hits with orgnr and revenue when present. Suggest next steps: cross-check CRM, open company profile, or deep research handoff.',
    starterPrompt:
      'Scan the Universe for profitable B2B services companies in Sweden around SEK 80–150m revenue; give 8 candidates with orgnr.',
    onlyOnPages: ['sourcing'],
  },
  {
    id: 'sourcing_vs_pipeline',
    title: 'New target vs CRM pipeline',
    description:
      'Compare Universe candidates to companies already in Nivo CRM so you do not double-work tracked deals.',
    systemHint:
      'When the user names companies or segments, use search_universe for the Universe view, then list_crm_companies (and get_crm_deal_summary with orgnr when needed) to flag overlap. ' +
      'Clearly label which rows are already in CRM, deal status if known, and which look net-new.',
    starterPrompt:
      'I’m looking at niche industrial distributors — search the Universe for a few, then tell me which are already in our CRM.',
    onlyOnPages: ['sourcing'],
  },
  {
    id: 'sourcing_handoff_research',
    title: 'Screening → Deep research',
    description:
      'Build a handoff URL that opens the Deep Research wizard with the right source tag for sourcing workflows.',
    systemHint:
      'For IC-style work, call build_deep_research_handoff_url. Prefer from=screening or from=gpt_target when the user is on Sourcing; use from=company when they explicitly opened from a company page context.',
    starterPrompt:
      'Give me a deep research handoff link for orgnr from my shortlist (I’ll paste it) with source set for screening.',
    onlyOnPages: ['sourcing'],
  },
  {
    id: 'find_targets',
    title: 'Find targets',
    description: 'Search the Universe (local company database) by name, revenue, or filters.',
    systemHint:
      'Help discover companies using search_universe. Name matching uses SQL LIKE; min_revenue_sek is in SEK (same units as stored KPIs). Suggest concrete next steps: open company profile (/company/:id), add to CRM, or deep research handoff. Never invent an orgnr.',
    starterPrompt:
      'Find manufacturing companies above 50 MSEK revenue whose name mentions "verkstad".',
  },
  {
    id: 'draft_outreach',
    title: 'Draft outreach',
    description: 'Use CRM context to draft an email; sending always stays manual in the workspace.',
    systemHint:
      'When the user wants an email in Nivo, you MUST call create_email_draft — that is the only action that saves a draft to the database. ' +
      'Call get_crm_deal_summary first if you need contacts or context. You may omit contact_id to use the primary contact. ' +
      'Never claim a draft was saved unless create_email_draft returned ok: true in the tool result.',
    starterPrompt: 'Draft a first-touch email for the primary contact and save it as a CRM draft.',
  },
  {
    id: 'follow_up',
    title: 'Follow-up plan',
    description: 'Review engagement and suggest next steps or a follow-up draft.',
    systemHint:
      'Use get_crm_deal_summary. Look at latest outbound status, timeline tail, next_action_at, and engagement_summary. ' +
      'If the user wants a follow-up written into CRM, call create_email_draft (not just text in chat). Never imply an email was sent.',
    starterPrompt: 'What should we do next with this deal based on recent activity?',
  },
  {
    id: 'deep_research',
    title: 'Deep research handoff',
    description: 'Build a link that opens the research wizard pre-filled for an orgnr.',
    systemHint:
      'When the user wants IC-style research, call build_deep_research_handoff_url with orgnr and optional name, website, from=company|screening|gpt_target. Tell them the wizard opens at /deep-research with query params and they must confirm before a run starts.',
    starterPrompt: 'Give me a handoff link for deep research on orgnr 5560000143.',
  },
]

function isCopilotPageKey(raw: string | undefined): raw is CopilotPageKey {
  return (
    raw !== undefined &&
    (COPILOT_PAGE_KEYS as readonly string[]).includes(raw)
  )
}

/** Playbooks visible for the given UI surface; sourcing puts sourcing-only rows first. */
export function listPlaybooksForPage(page?: string): CopilotPlaybook[] {
  const key = isCopilotPageKey(page) ? page : undefined
  const filtered = COPILOT_PLAYBOOKS.filter((p) => {
    if (!p.onlyOnPages?.length) return true
    if (!key) return false
    return p.onlyOnPages.includes(key)
  })
  if (key === 'sourcing') {
    return [...filtered].sort((a, b) => {
      const sourcingOnly = (x: CopilotPlaybook) =>
        Boolean(x.onlyOnPages?.length === 1 && x.onlyOnPages[0] === 'sourcing')
      return (sourcingOnly(a) ? 0 : 1) - (sourcingOnly(b) ? 0 : 1)
    })
  }
  return filtered
}

export function getPlaybookById(id: string | undefined): CopilotPlaybook | null {
  if (!id) return null
  return COPILOT_PLAYBOOKS.find((p) => p.id === id) ?? null
}
