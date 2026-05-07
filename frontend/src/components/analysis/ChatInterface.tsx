import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Send, Bot, User, Sparkles, ListPlus } from "lucide-react";
import { fetchWithAuth } from "@/lib/backendFetch";
import { createListFromSourcing } from "@/lib/services/listsService";
import { NivoCopilotPanel } from "@/pages/crm/NivoCopilotPanel";

/** Rows returned in chat `sample_companies`; shown in Analysis right pane before a workflow run. */
export interface SourcingPreviewRow {
  orgnr: string;
  company_name: string;
  latest_revenue_sek: number | null;
  avg_ebitda_margin: number | null;
}

export interface SourcingChatPreview {
  count: number;
  samples: SourcingPreviewRow[];
  filterSummary: string | null;
}

function normalizeSampleRow(row: unknown): SourcingPreviewRow {
  const r = row as Record<string, unknown>;
  const org = r.orgnr != null ? String(r.orgnr) : "";
  const name = typeof r.company_name === "string" ? r.company_name : "—";
  const rev = r.latest_revenue_sek;
  const margin = r.avg_ebitda_margin;
  return {
    orgnr: org,
    company_name: name,
    latest_revenue_sek:
      typeof rev === "number"
        ? rev
        : rev != null && rev !== ""
          ? Number(rev)
          : null,
    avg_ebitda_margin:
      typeof margin === "number"
        ? margin
        : margin != null && margin !== ""
          ? Number(margin)
          : null,
  };
}

interface ChatInterfaceProps {
  onCriteriaChange: (criteria: Record<string, unknown> | null) => void;
  onStartAnalysis: () => void;
  isRunning: boolean;
  /** Latest sourcing match count + sample companies for the workflow results panel. */
  onSourcingPreview?: (preview: SourcingChatPreview | null) => void;
  /** When a company is selected in sourcing/analysis results, pass orgnr so Nivo Copilot can resolve CRM context. */
  copilotOrgnrHint?: string | null;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

interface ChatApiResponse {
  message: string;
  criteria: Record<string, unknown>;
  count: number;
  sample_companies: unknown[];
  suggestions?: string[];
  filter_summary?: string;
  conversation_id?: string | null;
  nivo_context_version?: string;
  chat_persisted?: boolean;
  /** Postgres host/db this API used for the filter (should match Universe data). */
  data_source?: string;
}

export function ChatInterface({
  onCriteriaChange,
  onStartAnalysis,
  isRunning,
  onSourcingPreview,
  copilotOrgnrHint = null,
}: ChatInterfaceProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Describe the companies you want (e.g. profitable logistics in Sweden, roughly 50–200 MSEK). You can refine in follow-up messages — your thread is saved when you’re signed in.",
      timestamp: new Date(),
      suggestions: [
        "Profitable B2B services in the Nordics",
        "Manufacturing with recurring revenue",
        "High growth, SEK 80–150M revenue",
      ],
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentCriteria, setCurrentCriteria] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [filterSummary, setFilterSummary] = useState<string | null>(null);
  const [saveListOpen, setSaveListOpen] = useState(false);
  const [listName, setListName] = useState("");
  const [savingList, setSavingList] = useState(false);
  const [saveListError, setSaveListError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [thesisVersion, setThesisVersion] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<{
    type: "success" | "error";
    message: string;
    listId?: string;
  } | null>(null);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!actionBanner) return;
    const t = setTimeout(() => setActionBanner(null), 8000);
    return () => clearTimeout(t);
  }, [actionBanner]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg = text;
    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMsg, timestamp: new Date() },
    ]);
    setIsLoading(true);

    try {
      const response = await fetchWithAuth("/api/analysis/chat/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          current_criteria: currentCriteria,
          conversation_id: conversationId,
        }),
      });

      const raw = await response.text();
      let data: ChatApiResponse;
      try {
        data = JSON.parse(raw) as ChatApiResponse;
      } catch {
        if (!response.ok) {
          throw new Error(
            raw.trim().slice(0, 400) || `Request failed (HTTP ${response.status})`
          );
        }
        throw new Error("The server sent an invalid response. Is the API running?");
      }
      if (!response.ok) {
        throw new Error(
          (data as { detail?: string }).detail || `Request failed (HTTP ${response.status})`
        );
      }

      if (data.nivo_context_version) {
        setThesisVersion(data.nivo_context_version);
      }
      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }
      if (data.data_source?.trim()) {
        setDataSource(data.data_source.trim());
      }

      const bodyText = `${data.message}\n\nFound ${data.count} matching companies.`;

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: bodyText,
          timestamp: new Date(),
          suggestions: data.suggestions,
        },
      ]);

      setCurrentCriteria(data.criteria);
      setMatchCount(data.count);
      setFilterSummary((data.filter_summary || "").trim() || null);
      onCriteriaChange(data.criteria);
      const rawSamples = Array.isArray(data.sample_companies) ? data.sample_companies : [];
      onSourcingPreview?.({
        count: data.count,
        samples: rawSamples.map(normalizeSampleRow),
        filterSummary: (data.filter_summary || "").trim() || null,
      });
    } catch (error) {
      console.error("Chat error:", error);
      const reason =
        error instanceof Error
          ? error.message
          : "Unexpected error. Check the browser network tab and API logs.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Could not run the sourcing assistant.\n\n${reason}\n\nTypical fix: set OPENAI_API_KEY in the project .env and restart the API, or for a local model set LLM_BASE_URL (see .env.example).`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewThread = () => {
    setConversationId(null);
    setFilterSummary(null);
    setDataSource(null);
    setMessages([
      {
        role: "assistant",
        content:
          "New conversation. What kind of companies are you looking for?",
        timestamp: new Date(),
        suggestions: [
          "Profitable B2B services in the Nordics",
          "Manufacturing with recurring revenue",
        ],
      },
    ]);
    setMatchCount(null);
    setCurrentCriteria(null);
    onCriteriaChange(null);
    onSourcingPreview?.(null);
  };

  const openSaveListDialog = () => {
    if (!currentCriteria) return;
    setSaveListError(null);
    const d = new Date();
    const label = `Sourcing ${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
    setListName(label);
    setSaveListOpen(true);
  };

  const saveAsList = async () => {
    if (!currentCriteria) return;
    const name = listName.trim();
    if (!name) {
      setSaveListError("Enter a name for the list.");
      return;
    }
    setSavingList(true);
    setSaveListError(null);
    try {
      const res = await createListFromSourcing({
        name,
        scope: "private",
        criteria: currentCriteria,
      });
      setSaveListOpen(false);
      setActionBanner({
        type: "success",
        message: `Saved list with ${res.insertedCount.toLocaleString()} companies (${res.totalMatched.toLocaleString()} matched).`,
        listId: res.listId,
      });
    } catch (e) {
      setSaveListError(e instanceof Error ? e.message : "Could not save list.");
    } finally {
      setSavingList(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="p-4 border-b border-border flex items-center justify-between gap-2 bg-muted/40">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-5 h-5 text-primary shrink-0" />
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground">Sourcing assistant</h2>
            <p className="text-xs text-muted-foreground">
              Refine your universe in plain language
              {thesisVersion ? (
                <span className="text-muted-foreground/80">
                  {" "}
                  · Mandate <code className="text-[10px] bg-muted px-1 rounded">v{thesisVersion}</code>
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 text-xs gap-1"
            onClick={() => setCopilotOpen(true)}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Nivo Copilot
          </Button>
          <Button type="button" variant="ghost" size="sm" className="shrink-0 text-xs" onClick={startNewThread}>
            New chat
          </Button>
        </div>
      </div>

      {actionBanner ? (
        <div
          className={`mx-4 mt-3 rounded-lg border px-3 py-2 text-sm ${
            actionBanner.type === "success"
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          }`}
        >
          <p>{actionBanner.message}</p>
          {actionBanner.type === "success" && actionBanner.listId ? (
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-primary"
              onClick={() => navigate(`/lists/${actionBanner.listId}`)}
            >
              Open list
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="flex-1 overflow-hidden relative">
        <ScrollArea className="h-full p-4" ref={scrollRef}>
          <div className="space-y-4 pb-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`flex gap-3 max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className={`
                    w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                    ${msg.role === "assistant" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}
                  `}
                  >
                    {msg.role === "assistant" ? <Bot size={16} /> : <User size={16} />}
                  </div>
                  <div
                    className={`
                    rounded-lg p-3 text-sm
                    ${
                      msg.role === "assistant"
                        ? "bg-primary/10 text-foreground border border-primary/30"
                        : "bg-muted text-foreground"
                    }
                  `}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>

                {msg.role === "assistant" && msg.suggestions && msg.suggestions.length > 0 ? (
                  <div className="flex flex-wrap gap-2 ml-11 mt-1">
                    {msg.suggestions.map((suggestion, sIdx) => (
                      <button
                        key={sIdx}
                        type="button"
                        onClick={() => void sendMessage(suggestion)}
                        disabled={isLoading}
                        className="text-xs bg-card border border-primary/40 text-primary px-3 py-1.5 rounded-full hover:bg-primary/10 transition-colors text-left"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {isLoading ? (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                  <Bot size={16} />
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </div>

      {dataSource ? (
        <p
          className="px-4 py-1.5 border-t border-border bg-muted/15 text-[10px] leading-snug text-muted-foreground"
          title="Sourcing counts use this Postgres database — it should match where Universe companies and company_kpis are loaded."
        >
          Universe data: {dataSource}
        </p>
      ) : null}

      {filterSummary ? (
        <details className="px-4 py-2 border-t border-border bg-muted/20 text-sm open:bg-muted/30">
          <summary className="cursor-pointer font-medium text-foreground list-none flex items-center justify-between gap-2">
            <span>Why this list</span>
            <span className="text-xs font-normal text-muted-foreground">Plain-language filters</span>
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-muted-foreground pl-0.5 pr-1">{filterSummary}</p>
        </details>
      ) : null}

      {matchCount !== null ? (
        <div className="px-4 py-2 bg-primary/10 border-t border-primary/30 flex justify-between items-center gap-2 flex-wrap">
          <span className="text-sm text-primary font-medium">{matchCount} matches</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={openSaveListDialog}
              disabled={isRunning || matchCount === 0 || !currentCriteria}
            >
              <ListPlus className="w-3 h-3 mr-1.5" />
              Save as list
            </Button>
            <Button
              size="sm"
              onClick={onStartAnalysis}
              disabled={isRunning || matchCount === 0}
            >
              {isRunning ? (
                <Loader2 className="w-3 h-3 animate-spin mr-2" />
              ) : (
                <Sparkles className="w-3 h-3 mr-2" />
              )}
              Run deep analysis
            </Button>
          </div>
        </div>
      ) : null}

      <div className="p-4 border-t border-border bg-card">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage(input);
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your target companies…"
            className="flex-1"
            disabled={isLoading || isRunning}
          />
          <Button type="submit" size="icon" disabled={isLoading || isRunning || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>

      <Dialog open={saveListOpen} onOpenChange={setSaveListOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save as Pipeline list</DialogTitle>
            <DialogDescription>
              Companies that match the current financial filters (same engine as the match count) are added to
              a static list. A short &quot;why this list&quot; note is stored on the list.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="sourcing-list-name">Name</Label>
            <Input
              id="sourcing-list-name"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder="e.g. Nordic B2B services — Jan 2026"
            />
            {saveListError ? <p className="text-sm text-destructive">{saveListError}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSaveListOpen(false)} disabled={savingList}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveAsList()} disabled={savingList}>
              {savingList ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
              Save list
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NivoCopilotPanel
        open={copilotOpen}
        onOpenChange={setCopilotOpen}
        context={{
          page: "sourcing",
          orgnr: copilotOrgnrHint?.trim() || undefined,
        }}
      />
    </div>
  );
}
