import OpenAI from 'openai'
import { OutreachDraft } from '../crm/types.js'

export class OutreachEmailService {
  private readonly openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

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
    const prompt = `Write a first outreach email using the following context.

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

Return JSON: {"subject":"string","body_text":"string","body_html":"string","prompt_version":"v1"}`

    const response = await this.openai.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.4,
      input: [
        {
          role: 'system',
          content: 'You write highly personalized first-touch outreach emails for an investment firm. Keep the tone professional, discreet, respectful, concise, and non-spammy.',
        },
        { role: 'user', content: prompt },
      ],
    })

    const raw = response.output_text || '{}'
    const parsed = JSON.parse(raw)
    return {
      subject: parsed.subject,
      body_text: parsed.body_text,
      body_html: parsed.body_html,
      prompt_version: parsed.prompt_version || 'v1',
    }
  }
}
