import { crmFetchJson } from "@/lib/api/crm";

export interface CopilotPlaybook {
  id: string;
  title: string;
  description: string;
  systemHint: string;
  starterPrompt?: string;
  /** Present when server scopes this playbook to specific surfaces (e.g. sourcing-only). */
  onlyOnPages?: CopilotPageContext[];
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

export type CopilotPageContext =
  | "crm"
  | "crm_workspace"
  | "universe"
  | "deep_research"
  | "sourcing";

export async function listCopilotPlaybooks(
  page?: CopilotPageContext
): Promise<CopilotPlaybook[]> {
  const q = page != null && page !== "" ? `?page=${encodeURIComponent(page)}` : "";
  return crmFetchJson<CopilotPlaybook[]>(`/crm/copilot/playbooks${q}`);
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
