import { crmFetchJson } from "@/lib/api/crm";

export interface CopilotPlaybook {
  id: string;
  title: string;
  description: string;
  systemHint: string;
  starterPrompt?: string;
}

export interface CopilotToolTraceItem {
  name: string;
  ok: boolean;
  summary: string;
}

export interface CopilotSavedDraft {
  email_id: string;
  company_id: string;
  subject?: string;
}

export interface CopilotChatResult {
  reply: string;
  toolTrace: CopilotToolTraceItem[];
  savedDrafts?: CopilotSavedDraft[];
}

export type CopilotPageContext = "crm" | "crm_workspace" | "universe" | "deep_research";

export async function listCopilotPlaybooks(): Promise<CopilotPlaybook[]> {
  return crmFetchJson<CopilotPlaybook[]>("/crm/copilot/playbooks");
}

export async function copilotChat(payload: {
  messages: { role: "user" | "assistant"; content: string }[];
  playbookId?: string;
  context?: {
    page?: CopilotPageContext;
    companyId?: string;
    orgnr?: string;
  };
}): Promise<CopilotChatResult> {
  return crmFetchJson<CopilotChatResult>("/crm/copilot/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
