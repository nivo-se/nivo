import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, Sparkles } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  copilotChat,
  listCopilotPlaybooks,
  type CopilotPageContext,
  type CopilotPlaybook,
} from "@/lib/api/copilot";

export interface NivoCopilotPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context?: {
    page?: CopilotPageContext;
    companyId?: string;
    orgnr?: string;
  };
}

type ChatLine = { role: "user" | "assistant"; content: string };

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      className="prose prose-sm dark:prose-invert max-w-none break-words [&_p]:mb-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_li]:marker:text-muted-foreground [&_strong]:font-semibold"
      components={{
        a: ({ href, children }) => {
          if (href?.startsWith("/")) {
            return (
              <Link to={href} className="text-primary underline font-medium">
                {children}
              </Link>
            );
          }
          return (
            <a href={href} className="text-primary underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export function NivoCopilotPanel({ open, onOpenChange, context }: NivoCopilotPanelProps) {
  const { toast } = useToast();
  const isSourcing = context?.page === "sourcing";
  const [playbooks, setPlaybooks] = useState<CopilotPlaybook[]>([]);
  const [playbookId, setPlaybookId] = useState<string>("");
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listCopilotPlaybooks(context?.page)
      .then((list) => {
        if (!cancelled) setPlaybooks(Array.isArray(list) ? list : []);
      })
      .catch((e) => {
        if (!cancelled) {
          setPlaybooks([]);
          toast({
            title: "Copilot unavailable",
            description: e instanceof Error ? e.message : "Could not load playbooks",
            variant: "destructive",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, context?.page, toast]);

  useEffect(() => {
    if (!open || playbooks.length === 0) return;
    setPlaybookId((id) => {
      if (id && playbooks.some((p) => p.id === id)) return id;
      if (isSourcing) return playbooks[0]?.id ?? "";
      return "";
    });
  }, [open, playbooks, isSourcing]);

  useEffect(() => {
    if (!open) return;
    setLines([]);
    setInput("");
  }, [open, context?.companyId, context?.orgnr]);

  const send = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || busy) return;

    const nextUser: ChatLine = { role: "user", content: trimmed };
    const history: ChatLine[] = [...lines, nextUser];
    setLines(history);
    setInput("");
    setBusy(true);

    const apiMessages = history.map((m) => ({ role: m.role, content: m.content }));

    try {
      const result = await copilotChat({
        messages: apiMessages,
        playbookId: playbookId || undefined,
        context,
      });
      setLines((prev) => [...prev, { role: "assistant", content: result.reply }]);
      if (result.savedDrafts?.length) {
        toast({
          title: "Draft saved in CRM",
          description: `${result.savedDrafts.length} draft(s) — open the company workspace to review.`,
        });
      }
    } catch (e) {
      toast({
        title: "Copilot error",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }, [busy, context, input, lines, playbookId, toast]);

  const applyStarter = () => {
    const pb = playbooks.find((p) => p.id === playbookId);
    if (pb?.starterPrompt) setInput(pb.starterPrompt);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 border-sidebar-border bg-sidebar-bg p-0 sm:max-w-lg"
      >
        <SheetHeader className="space-y-1 border-b border-sidebar-border px-4 py-4 pr-12 text-left">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            {isSourcing ? "Sourcing copilot" : "Nivo copilot"}
          </SheetTitle>
          <SheetDescription>
            {isSourcing ? (
              <>
                Tailored for target discovery: searches Nivo&apos;s Universe company database and
                cross-checks your CRM pipeline so you see net-new candidates versus deals already in
                motion. Same server tools as CRM — drafts stay manual approval; it does not control
                your browser.
              </>
            ) : (
              <>
                Scoped assistant: Universe search, CRM summary, email drafts only (you approve
                sends), and deep research links. It runs on the server with tools (read CRM/Universe;
                write is limited to creating drafts). It does not read or control your browser or
                this panel—only the text you see here.
              </>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="shrink-0 space-y-3 border-b border-sidebar-border/80 px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select
              value={playbookId || "__none__"}
              onValueChange={(v) => setPlaybookId(v === "__none__" ? "" : v)}
            >
              <SelectTrigger className="h-9 w-full sm:max-w-[220px]" aria-label="Playbook">
                <SelectValue placeholder="Playbook (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No playbook</SelectItem>
                {playbooks.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0"
              disabled={!playbookId}
              onClick={applyStarter}
            >
              Use starter prompt
            </Button>
          </div>
          {playbookId ? (
            <p className="text-xs text-muted-foreground">
              {playbooks.find((p) => p.id === playbookId)?.description}
            </p>
          ) : null}
        </div>

        <ScrollArea className="min-h-0 flex-1 px-4">
          <div className="flex flex-col gap-3 py-4">
            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {isSourcing
                  ? "Ask for Universe scans (sectors, revenue bands, names), check whether candidates are already in CRM, get deal context for a selected orgnr, or open a deep research handoff."
                  : "Ask for targets in the Universe, a CRM deal summary, a draft email (saved as draft only), or a deep research handoff URL."}
              </p>
            ) : null}
            {lines.map((line, idx) => (
              <div
                key={idx}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  line.role === "user"
                    ? "border-primary/25 bg-primary/[0.06]"
                    : "border-border bg-muted/40"
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <Badge variant={line.role === "user" ? "default" : "secondary"} className="text-[10px]">
                    {line.role === "user" ? "You" : "Copilot"}
                  </Badge>
                </div>
                <div className="break-words text-sm">
                  {line.role === "assistant" ? (
                    <AssistantMarkdown content={line.content} />
                  ) : (
                    <span className="whitespace-pre-wrap">{line.content}</span>
                  )}
                </div>
              </div>
            ))}
            {busy ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Thinking…
              </div>
            ) : null}
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t border-sidebar-border p-4">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isSourcing
                ? "e.g. Scan Universe for logistics 50–120 M SEK · Are these orgnrs already in CRM? · Handoff URL for research…"
                : "e.g. Search the Universe for… / Summarize this deal / Draft a bump email…"
            }
            className="min-h-[88px] resize-none"
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="primary" size="sm" disabled={busy} onClick={() => void send()}>
              {busy ? (
                <>
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden />
                  Sending
                </>
              ) : (
                "Send"
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
