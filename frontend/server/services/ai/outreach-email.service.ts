import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { OutreachDraft } from '../crm/types.js'
import { resolveOutreachLlmVendor } from '../copilot/llm-provider.js'

function buildOutreachUserPrompt(context: {
  companyName: string
  industry?: string | null
  companyProfile?: string | null
  strategicStrengths?: string | null
  reasonForInterest?: string | null
  valueCreationAngle?: string | null
  contactName?: string | null
  contactTitle?: string | null
  userInstructions?: string | null
}): string {
  return `Write a first outreach email using the following context.

Company:
${context.companyName}

Contact:
${context.contactName ?? ''}
${context.contactTitle ?? ''}

Industry:
${context.industry ?? 'N/A'}

Company profile:
${context.companyProfile ?? 'N/A'}

Strategic strengths / differentiators:
${context.strategicStrengths ?? 'N/A'}

Reason we are interested:
${context.reasonForInterest ?? 'N/A'}

Value creation perspective:
${context.valueCreationAngle ?? 'N/A'}

Additional user instructions:
${context.userInstructions ?? 'None'}

Constraints:
- 120 to 180 words
- avoid generic buzzwords
- do not explicitly push an acquisition
- sound human and thoughtful
- include a clear but soft call to action

Return JSON only, no markdown fences: {"subject":"string","body_text":"string","body_html":"string","prompt_version":"v1"}`
}

const OUTREACH_SYSTEM =
  'You write highly personalized first-touch outreach emails for an investment firm. Keep the tone professional, discreet, respectful, concise, and non-spammy.'

export class OutreachEmailService {
  private openaiClient(): OpenAI {
    const key = process.env.OPENAI_API_KEY
    if (!key) {
      throw new Error(
        'OPENAI_API_KEY is not configured (outreach provider is openai, or set CRM_LLM_PROVIDER / OUTREACH_LLM_PROVIDER)',
      )
    }
    return new OpenAI({ apiKey: key })
  }

  private async generateDraftOpenAI(context: Parameters<OutreachEmailService['generateDraft']>[0]): Promise<OutreachDraft> {
    const openai = this.openaiClient()
    const prompt = buildOutreachUserPrompt(context)
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.4,
      input: [
        { role: 'system', content: OUTREACH_SYSTEM },
        { role: 'user', content: prompt },
      ],
    })

    const raw = response.output_text || '{}'
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      subject: parsed.subject as string,
      body_text: parsed.body_text as string,
      body_html: parsed.body_html as string,
      prompt_version: (parsed.prompt_version as string) || 'v1',
    }
  }

  private async generateDraftAnthropic(context: Parameters<OutreachEmailService['generateDraft']>[0]): Promise<OutreachDraft> {
    const key = process.env.ANTHROPIC_API_KEY
    if (!key) {
      throw new Error(
        'ANTHROPIC_API_KEY is not configured (CRM_LLM_PROVIDER or OUTREACH_LLM_PROVIDER is anthropic)',
      )
    }
    const client = new Anthropic({ apiKey: key })
    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'
    const prompt = buildOutreachUserPrompt(context)

    const msg = await client.messages.create({
      model,
      max_tokens: 4096,
      temperature: 0.4,
      system: OUTREACH_SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = msg.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(cleaned || '{}') as Record<string, unknown>
    return {
      subject: parsed.subject as string,
      body_text: parsed.body_text as string,
      body_html: parsed.body_html as string,
      prompt_version: (parsed.prompt_version as string) || 'v1',
    }
  }

  async generateDraft(context: {
    companyName: string
    industry?: string | null
    companyProfile?: string | null
    strategicStrengths?: string | null
    reasonForInterest?: string | null
    valueCreationAngle?: string | null
    contactName?: string | null
    contactTitle?: string | null
    userInstructions?: string | null
  }): Promise<OutreachDraft> {
    const vendor = resolveOutreachLlmVendor()
    if (vendor === 'anthropic') {
      return this.generateDraftAnthropic(context)
    }
    return this.generateDraftOpenAI(context)
  }
}
