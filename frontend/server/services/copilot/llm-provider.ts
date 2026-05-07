import type { ChatCompletionTool } from 'openai/resources/chat/completions'

export type LlmVendor = 'openai' | 'anthropic'

function normalizeVendor(raw: string | undefined): LlmVendor {
  const v = (raw ?? 'openai').toLowerCase().trim()
  if (v === 'anthropic' || v === 'claude') return 'anthropic'
  return 'openai'
}

/** Copilot: COPILOT_LLM_PROVIDER overrides CRM_LLM_PROVIDER overrides openai */
export function resolveCopilotLlmVendor(): LlmVendor {
  return normalizeVendor(
    process.env.COPILOT_LLM_PROVIDER || process.env.CRM_LLM_PROVIDER
  )
}

/** Outreach drafts: OUTREACH_LLM_PROVIDER overrides CRM_LLM_PROVIDER overrides openai */
export function resolveOutreachLlmVendor(): LlmVendor {
  return normalizeVendor(
    process.env.OUTREACH_LLM_PROVIDER || process.env.CRM_LLM_PROVIDER
  )
}

/** Anthropic Messages API tool shape (matches SDK Tool). */
export type AnthropicToolDef = {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export function openAiChatToolsToAnthropic(tools: ChatCompletionTool[]): AnthropicToolDef[] {
  return tools.map((t) => {
    if (t.type !== 'function') {
      throw new Error(
        `Copilot: unsupported tool type ${(t as ChatCompletionTool).type}`
      )
    }
    return {
      name: t.function.name,
      description: t.function.description ?? '',
      input_schema: t.function.parameters as Record<string, unknown>,
    }
  })
}
