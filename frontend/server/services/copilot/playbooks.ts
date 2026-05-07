export interface CopilotPlaybook {
  id: string
  title: string
  description: string
  /** Extra instructions merged into the system prompt when this playbook is selected. */
  systemHint: string
  /** Optional first user message suggestion (UI only). */
  starterPrompt?: string
}

export const COPILOT_PLAYBOOKS: CopilotPlaybook[] = [
  {
    id: 'find_targets',
    title: 'Find targets',
    description: 'Search the Universe (local company database) by name, revenue, or filters.',
    systemHint:
      'Help discover companies using search_universe. Name matching uses SQL LIKE; min_revenue_sek is in SEK (same units as stored KPIs). Suggest concrete next steps: open company profile (/company/:id), add to CRM, or deep research handoff. Never invent an orgnr.',
    starterPrompt: 'Find manufacturing companies above 50 MSEK revenue whose name mentions "verkstad".',
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

export function getPlaybookById(id: string | undefined): CopilotPlaybook | null {
  if (!id) return null
  return COPILOT_PLAYBOOKS.find((p) => p.id === id) ?? null
}
