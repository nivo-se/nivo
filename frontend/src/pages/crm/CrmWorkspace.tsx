import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ExternalLink,
  Loader2,
  Mail,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Send,
  Share2,
  Sparkles,
  StickyNote,
  UserRound,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  addDealNote,
  approveEmail,
  createContact,
  createManualDraft,
  generateEmail,
  getCrmCompanyOverview,
  getDealEmails,
  getThreadMessages,
  patchContact,
  patchCrmCompany,
  patchDealNextAction,
  patchDraftEmail,
  sendEmail,
  updateDealStatus,
  type CrmCompanyOverview,
  type CrmOutboundEmailRow,
  type CrmThreadMessage,
} from "@/lib/api/crm";
import {
  isAttioDisabledError,
  sendCompanyToAttio,
  type SendCompanyResult,
} from "@/lib/api/attio";
import { ApiRequestError } from "@/lib/api/httpClient";

function formatStatus(status: string | null | undefined): string {
  if (!status) return "—";
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatDateTime(ts: string | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function emailStatusBadgeVariant(
  status: string
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "sent" || status === "replied") return "secondary";
  if (status === "approved") return "default";
  if (status === "bounced" || status === "failed") return "destructive";
  return "outline";
}

const DEAL_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "target_identified", label: "Target identified" },
  { value: "outreach_ready", label: "Outreach ready" },
  { value: "outreach_sent", label: "Outreach sent" },
  { value: "replied", label: "Replied" },
  { value: "in_dialogue", label: "In dialogue" },
  { value: "meeting_scheduled", label: "Meeting scheduled" },
  { value: "declined", label: "Declined" },
  { value: "parked", label: "Parked" },
  { value: "closed", label: "Closed" },
];

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface CrmWorkspaceProps {
  companyIdParam: string;
  onBack: () => void;
}

export function CrmWorkspace({ companyIdParam, onBack }: CrmWorkspaceProps) {
  const { toast } = useToast();
  const [overview, setOverview] = useState<CrmCompanyOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  const [emails, setEmails] = useState<CrmOutboundEmailRow[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);

  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [editorSubject, setEditorSubject] = useState("");
  const [editorBody, setEditorBody] = useState("");

  const [threadMessages, setThreadMessages] = useState<CrmThreadMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);

  const [attioSending, setAttioSending] = useState(false);
  const [attioLastResult, setAttioLastResult] = useState<SendCompanyResult | null>(null);

  const [nextActionInput, setNextActionInput] = useState("");

  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateContactId, setGenerateContactId] = useState<string | null>(null);
  const [generateInstructions, setGenerateInstructions] = useState("");
  const [generateReason, setGenerateReason] = useState("");
  const [generateBusy, setGenerateBusy] = useState(false);

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeContactId, setComposeContactId] = useState<string | null>(null);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeBusy, setComposeBusy] = useState(false);

  const [editContactOpen, setEditContactOpen] = useState(false);
  const [editContactId, setEditContactId] = useState<string | null>(null);
  const [editContactFullName, setEditContactFullName] = useState("");
  const [editContactTitle, setEditContactTitle] = useState("");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editContactBusy, setEditContactBusy] = useState(false);

  const [companySubtitleEditing, setCompanySubtitleEditing] = useState(false);
  const [industryDraft, setIndustryDraft] = useState("");
  const [websiteDraft, setWebsiteDraft] = useState("");
  const [companySubtitleBusy, setCompanySubtitleBusy] = useState(false);

  const [addContactEmail, setAddContactEmail] = useState("");
  const [addContactName, setAddContactName] = useState("");
  const [addContactTitle, setAddContactTitle] = useState("");
  const [addContactBusy, setAddContactBusy] = useState(false);

  const [saveDraftBusy, setSaveDraftBusy] = useState(false);
  const [approveBusy, setApproveBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [nextActionBusy, setNextActionBusy] = useState(false);

  const [noteDraft, setNoteDraft] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [dealStatusBusy, setDealStatusBusy] = useState(false);

  const refreshOverview = useCallback(async () => {
    setLoadingOverview(true);
    setLoadError(null);
    try {
      const data = await getCrmCompanyOverview(companyIdParam);
      setOverview(data);
      const deal = data.deal as { id?: string; next_action_at?: string | null };
      setNextActionInput(toDatetimeLocalValue(deal?.next_action_at ?? null));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load company");
      setOverview(null);
    } finally {
      setLoadingOverview(false);
    }
  }, [companyIdParam]);

  useEffect(() => {
    void refreshOverview();
  }, [refreshOverview]);

  const dealId = overview?.deal && typeof overview.deal === "object" ? (overview.deal as { id: string }).id : null;
  const companyId =
    overview?.company && typeof overview.company === "object"
      ? String((overview.company as { id: string }).id)
      : null;

  const refreshEmails = useCallback(async () => {
    if (!dealId) return;
    setLoadingEmails(true);
    try {
      const rows = await getDealEmails(dealId);
      setEmails(Array.isArray(rows) ? rows : []);
    } catch {
      setEmails([]);
      toast({ title: "Could not load emails", variant: "destructive" });
    } finally {
      setLoadingEmails(false);
    }
  }, [dealId, toast]);

  useEffect(() => {
    void refreshEmails();
  }, [refreshEmails]);

  /** Keep review panel useful: select a row when list loads or current id is missing. */
  useEffect(() => {
    if (loadingEmails || emails.length === 0) return;
    const valid = selectedEmailId != null && emails.some((e) => e.id === selectedEmailId);
    if (!valid) {
      setSelectedEmailId(emails[0].id);
    }
  }, [loadingEmails, emails, selectedEmailId]);

  const selectedEmail = useMemo(
    () => emails.find((e) => e.id === selectedEmailId) ?? null,
    [emails, selectedEmailId]
  );

  useEffect(() => {
    if (!selectedEmail) {
      setEditorSubject("");
      setEditorBody("");
      return;
    }
    setEditorSubject(selectedEmail.subject ?? "");
    setEditorBody(selectedEmail.body_text ?? "");
  }, [selectedEmail]);

  const refetchThread = useCallback(
    async (opts?: { showSpinner?: boolean; silent?: boolean }) => {
      const tid = selectedEmail?.crm_thread_id;
      if (!tid || selectedEmail?.status !== "sent") {
        setThreadMessages([]);
        return;
      }
      const showSpinner = opts?.showSpinner !== false;
      if (showSpinner) setLoadingThread(true);
      try {
        const rows = await getThreadMessages(tid);
        setThreadMessages(Array.isArray(rows) ? rows : []);
      } catch {
        setThreadMessages([]);
        if (!opts?.silent) {
          toast({ title: "Could not load thread", variant: "destructive" });
        }
      } finally {
        if (showSpinner) setLoadingThread(false);
      }
    },
    [selectedEmail?.crm_thread_id, selectedEmail?.status, toast]
  );

  useEffect(() => {
    void refetchThread({ showSpinner: true });
  }, [selectedEmail?.crm_thread_id, selectedEmail?.status, selectedEmail?.id, refetchThread]);

  useEffect(() => {
    const tid = selectedEmail?.crm_thread_id;
    if (!tid || selectedEmail?.status !== "sent") return;
    const iv = setInterval(() => void refetchThread({ showSpinner: false, silent: true }), 25000);
    return () => clearInterval(iv);
  }, [selectedEmail?.crm_thread_id, selectedEmail?.status, refetchThread]);

  const lastSentSubjectForContact = useCallback(
    (contactId: string) => {
      const list = Array.isArray(emails) ? emails : [];
      const sent = list.filter((e) => e.contact_id === contactId && e.status === "sent");
      sent.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return sent[0]?.subject ?? null;
    },
    [emails]
  );

  const openGenerate = (contactId: string, presetInstructions?: string) => {
    setGenerateContactId(contactId);
    setGenerateInstructions(presetInstructions ?? "");
    setGenerateReason("");
    setGenerateOpen(true);
  };

  const openEditContact = (c: Record<string, unknown>) => {
    setEditContactId(String(c.id));
    setEditContactFullName(typeof c.full_name === "string" ? c.full_name : "");
    setEditContactTitle(typeof c.title === "string" ? c.title : "");
    setEditContactEmail(String(c.email ?? ""));
    setEditContactOpen(true);
  };

  const handleEditContactSubmit = async () => {
    if (!editContactId) return;
    const email = editContactEmail.trim();
    if (!email) {
      toast({ title: "Email is required", variant: "destructive" });
      return;
    }
    setEditContactBusy(true);
    try {
      await patchContact(editContactId, {
        full_name: editContactFullName.trim(),
        title: editContactTitle.trim(),
        email,
      });
      toast({ title: "Contact updated" });
      setEditContactOpen(false);
      await refreshOverview();
      await refreshEmails();
    } catch (e) {
      toast({
        title: "Could not update contact",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setEditContactBusy(false);
    }
  };

  const handleGenerateSubmit = async () => {
    if (!companyId || !generateContactId) return;
    setGenerateBusy(true);
    try {
      const result = await generateEmail({
        company_id: companyId,
        contact_id: generateContactId,
        user_instructions: generateInstructions.trim() || undefined,
        reason_for_interest: generateReason.trim() || undefined,
      });
      toast({ title: "Draft created" });
      setGenerateOpen(false);
      await refreshOverview();
      await refreshEmails();
      if (result.email_id) {
        setSelectedEmailId(result.email_id);
      }
    } catch (e) {
      toast({
        title: "Generate failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setGenerateBusy(false);
    }
  };

  const handleComposeSubmit = async () => {
    if (!companyId || !composeContactId || !composeSubject.trim() || !composeBody.trim()) return;
    setComposeBusy(true);
    try {
      const row = await createManualDraft({
        company_id: companyId,
        contact_id: composeContactId,
        subject: composeSubject.trim(),
        body_text: composeBody.trim(),
      });
      toast({ title: "Draft saved" });
      setComposeOpen(false);
      setComposeSubject("");
      setComposeBody("");
      await refreshEmails();
      const id = row.id as string | undefined;
      if (id) setSelectedEmailId(id);
    } catch (e) {
      toast({
        title: "Could not create draft",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setComposeBusy(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedEmail || selectedEmail.status !== "draft") return;
    setSaveDraftBusy(true);
    try {
      await patchDraftEmail(selectedEmail.id, {
        subject: editorSubject,
        body_text: editorBody,
      });
      toast({ title: "Draft saved" });
      await refreshEmails();
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSaveDraftBusy(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedEmail) return;
    setApproveBusy(true);
    try {
      await approveEmail(selectedEmail.id, {
        subject: editorSubject,
        body_text: editorBody,
      });
      toast({ title: "Approved" });
      await refreshEmails();
      await refreshOverview();
    } catch (e) {
      toast({
        title: "Approve failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setApproveBusy(false);
    }
  };

  const handleSend = async () => {
    if (!selectedEmail) return;
    setSendBusy(true);
    try {
      if (selectedEmail.status === "approved") {
        await approveEmail(selectedEmail.id, {
          subject: editorSubject,
          body_text: editorBody,
        });
      }
      await sendEmail(selectedEmail.id);
      toast({ title: "Sent" });
      await refreshEmails();
      await refreshOverview();
    } catch (e) {
      toast({
        title: "Send failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSendBusy(false);
    }
  };

  const handleSaveNextAction = async () => {
    if (!dealId) return;
    setNextActionBusy(true);
    try {
      const iso = nextActionInput.trim() ? new Date(nextActionInput).toISOString() : null;
      await patchDealNextAction(dealId, iso);
      toast({ title: "Follow-up date saved" });
      await refreshOverview();
    } catch (e) {
      toast({
        title: "Could not save date",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setNextActionBusy(false);
    }
  };

  const handleSendToAttio = async () => {
    if (!companyId || attioSending) return;
    setAttioSending(true);
    try {
      const result = await sendCompanyToAttio(companyId);
      setAttioLastResult(result);
      const summary =
        `${result.contacts_pushed}/${result.contacts_total} contacts` +
        (result.notes_appended ? ` · ${result.notes_appended} note` : "");
      const errList = Array.isArray(result?.errors) ? result.errors : [];
      toast({
        title: errList.length ? "Sent to Attio (with warnings)" : "Sent to Attio",
        description: errList.length
          ? `${summary}. Issues: ${errList.join("; ")}`
          : summary,
        variant: errList.length ? "destructive" : "default",
      });
    } catch (e) {
      if (isAttioDisabledError(e)) {
        toast({
          title: "Attio sync is off",
          description:
            "Set ATTIO_SYNC_ENABLED=true and ATTIO_API_KEY in the API env, then restart.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Could not send to Attio",
          description:
            e instanceof ApiRequestError
              ? `${e.status ?? "?"}: ${e.message}`
              : e instanceof Error
              ? e.message
              : String(e),
          variant: "destructive",
        });
      }
    } finally {
      setAttioSending(false);
    }
  };

  const handleDealStatusChange = async (next: string) => {
    if (!dealId) return;
    setDealStatusBusy(true);
    try {
      await updateDealStatus(dealId, {
        status: next,
        summary: `Deal status set to ${next}`,
      });
      toast({ title: "Deal status updated" });
      await refreshOverview();
    } catch (e) {
      toast({
        title: "Could not update status",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setDealStatusBusy(false);
    }
  };

  const handleAddNote = async () => {
    if (!dealId || !noteDraft.trim()) return;
    setNoteBusy(true);
    try {
      await addDealNote(dealId, { summary: noteDraft.trim() });
      toast({ title: "Note saved" });
      setNoteDraft("");
      await refreshOverview();
    } catch (e) {
      toast({
        title: "Could not save note",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setNoteBusy(false);
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !addContactEmail.trim()) return;
    setAddContactBusy(true);
    try {
      await createContact({
        company_id: companyId,
        email: addContactEmail.trim(),
        full_name: addContactName.trim() || undefined,
        title: addContactTitle.trim() || undefined,
        is_primary: (overview?.contacts?.length ?? 0) === 0,
      });
      toast({ title: "Contact added" });
      setAddContactEmail("");
      setAddContactName("");
      setAddContactTitle("");
      await refreshOverview();
    } catch (err) {
      toast({
        title: "Could not add contact",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setAddContactBusy(false);
    }
  };

  const openCompanySubtitleEdit = useCallback(() => {
    const c = overview?.company as Record<string, unknown> | null | undefined;
    if (!c) return;
    setIndustryDraft(typeof c.industry === "string" ? c.industry : "");
    setWebsiteDraft(typeof c.website === "string" ? c.website : "");
    setCompanySubtitleEditing(true);
  }, [overview?.company]);

  const cancelCompanySubtitleEdit = useCallback(() => {
    setCompanySubtitleEditing(false);
  }, []);

  const handleSaveCompanySubtitle = useCallback(async () => {
    if (!companyId) return;
    setCompanySubtitleBusy(true);
    try {
      await patchCrmCompany(companyId, {
        industry: industryDraft.trim() || null,
        website: websiteDraft.trim() || null,
      });
      toast({ title: "Company details updated" });
      setCompanySubtitleEditing(false);
      await refreshOverview();
    } catch (e) {
      toast({
        title: "Could not save",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setCompanySubtitleBusy(false);
    }
  }, [companyId, industryDraft, websiteDraft, toast, refreshOverview]);

  useEffect(() => {
    setCompanySubtitleEditing(false);
  }, [companyIdParam]);

  if (loadingOverview && !overview) {
    return (
      <div className="p-8 flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading company…
      </div>
    );
  }

  if (loadError || !overview) {
    return (
      <div className="p-8">
        <p className="text-sm text-destructive">{loadError ?? "Not found"}</p>
        <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />
          Back
        </Button>
      </div>
    );
  }

  const company = overview.company as Record<string, unknown> | null;
  const deal = overview.deal as { id: string; status?: string; next_action_at?: string | null };
  const contacts = Array.isArray(overview.contacts) ? overview.contacts : [];

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs"
        role="region"
        aria-label="Attio sync"
      >
        <div className="text-muted-foreground">
          CRM source of truth lives in Attio. Push this company ad-hoc when you're
          ready — re-running just refreshes Attio with the latest data.
        </div>
        <div className="flex items-center gap-2">
          {attioLastResult?.company_attio_url ? (
            <a
              href={attioLastResult.company_attio_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Open in Attio
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void handleSendToAttio()}
            disabled={!companyId || attioSending}
          >
            {attioSending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" aria-hidden />
            ) : (
              <Share2 className="h-3.5 w-3.5 mr-1.5" aria-hidden />
            )}
            {attioSending ? "Sending…" : "Send to Attio"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <Button type="button" variant="ghost" size="sm" className="mb-2 -ml-2 h-8" onClick={onBack}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1" aria-hidden />
            Back to list
          </Button>
          <h2 className="text-xl font-semibold text-foreground tracking-tight">
            {(company?.name as string) ?? "—"}
          </h2>
          {!companySubtitleEditing ? (
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="text-sm text-muted-foreground">
                {(company?.industry as string) || "—"}
                {company?.website ? (
                  <>
                    {" · "}
                    <a
                      href={String(company.website)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline font-medium"
                    >
                      Website
                    </a>
                  </>
                ) : null}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={openCompanySubtitleEdit}
              >
                <Pencil className="h-3.5 w-3.5 mr-1" aria-hidden />
                Edit industry / website
              </Button>
            </div>
          ) : (
            <div className="mt-2 flex flex-col gap-2 max-w-md">
              <div className="space-y-1">
                <Label htmlFor="co-industry" className="text-xs">
                  Industry
                </Label>
                <Input
                  id="co-industry"
                  value={industryDraft}
                  onChange={(e) => setIndustryDraft(e.target.value)}
                  placeholder="e.g. Software"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="co-website" className="text-xs">
                  Website URL
                </Label>
                <Input
                  id="co-website"
                  value={websiteDraft}
                  onChange={(e) => setWebsiteDraft(e.target.value)}
                  placeholder="https://example.com"
                  autoComplete="url"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Leave fields empty to clear. A scheme is added automatically if you omit https://
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleSaveCompanySubtitle()}
                  disabled={companySubtitleBusy}
                >
                  {companySubtitleBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={cancelCompanySubtitleEdit}
                  disabled={companySubtitleBusy}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Label htmlFor="deal-status" className="text-xs text-muted-foreground sr-only">
              Deal status
            </Label>
            <Select
              value={deal?.status ?? "target_identified"}
              onValueChange={(v) => void handleDealStatusChange(v)}
              disabled={dealStatusBusy}
            >
              <SelectTrigger id="deal-status" className="h-8 w-[min(100%,220px)] text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {DEAL_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground shrink-0">
          <p className="font-medium text-foreground text-[11px] uppercase tracking-wide">Engagement</p>
          <p className="mt-1 tabular-nums">
            Opens {overview.engagement_summary?.open_count ?? 0} · Clicks{" "}
            {overview.engagement_summary?.click_count ?? 0}
            {overview.engagement_summary?.interaction_count != null
              ? ` · ${overview.engagement_summary.interaction_count} events`
              : ""}
          </p>
        </div>
      </div>

      <Separator className="my-2" />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Plan follow-up</CardTitle>
          <CardDescription>Optional reminder date for this deal.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="next-action" className="text-xs">
              Next touch
            </Label>
            <Input
              id="next-action"
              type="datetime-local"
              value={nextActionInput}
              onChange={(e) => setNextActionInput(e.target.value)}
              className="w-[220px]"
            />
          </div>
          <Button type="button" size="sm" onClick={() => void handleSaveNextAction()} disabled={nextActionBusy}>
            {nextActionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save date"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setNextActionInput("");
              void (async () => {
                if (!dealId) return;
                setNextActionBusy(true);
                try {
                  await patchDealNextAction(dealId, null);
                  toast({ title: "Date cleared" });
                  await refreshOverview();
                } catch (e) {
                  toast({
                    title: "Could not clear",
                    description: e instanceof Error ? e.message : String(e),
                    variant: "destructive",
                  });
                } finally {
                  setNextActionBusy(false);
                }
              })();
            }}
            disabled={nextActionBusy}
          >
            Clear
          </Button>
        </CardContent>
      </Card>

      <Card>
        <Collapsible defaultOpen={false} className="group">
          <CardHeader className="pb-2">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-md py-1 text-left hover:bg-muted/40 outline-none focus-visible:ring-2 focus-visible:ring-ring -mx-1 px-1">
              <div>
                <CardTitle className="text-sm font-medium">Activity & notes</CardTitle>
                <CardDescription>Interaction history and internal notes on this deal.</CardDescription>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <div className="space-y-2">
                <Label htmlFor="deal-note" className="text-xs">
                  Add note
                </Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Textarea
                    id="deal-note"
                    rows={2}
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Visible in timeline — use for context the team should share."
                    className="min-h-[72px] sm:flex-1"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="sm:self-end shrink-0"
                    disabled={noteBusy || !noteDraft.trim()}
                    onClick={() => void handleAddNote()}
                  >
                    {noteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><StickyNote className="h-3.5 w-3.5 mr-1" />Save note</>}
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Recent activity</p>
                {Array.isArray(overview.activity_timeline) && overview.activity_timeline.length > 0 ? (
                  <ul className="max-h-56 overflow-y-auto space-y-2 rounded-md border bg-muted/20 p-3 text-sm">
                    {(overview.activity_timeline as Record<string, unknown>[]).map((ev, idx) => {
                      const t = typeof ev.type === "string" ? ev.type : "event";
                      const sum = typeof ev.summary === "string" ? ev.summary : "";
                      const at =
                        typeof ev.created_at === "string"
                          ? ev.created_at
                          : typeof ev.created_at === "object" && ev.created_at
                            ? String(ev.created_at)
                            : "";
                      return (
                        <li key={idx} className="border-b border-border/60 pb-2 last:border-0 last:pb-0">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-xs font-medium text-foreground">{formatStatus(t)}</span>
                            <time className="text-[11px] text-muted-foreground tabular-nums">
                              {formatDateTime(at)}
                            </time>
                          </div>
                          {sum ? <p className="text-xs text-muted-foreground mt-1 leading-snug">{sum}</p> : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">No activity yet.</p>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Contacts</CardTitle>
          <CardDescription>Prospects to email for this company.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {contacts.length === 0 ? (
            <form onSubmit={handleAddContact} className="space-y-3 max-w-md border border-dashed rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Add a contact to start outreach.</p>
              <div className="space-y-1">
                <Label htmlFor="new-email">Email</Label>
                <Input
                  id="new-email"
                  type="email"
                  required
                  value={addContactEmail}
                  onChange={(e) => setAddContactEmail(e.target.value)}
                  placeholder="name@company.com"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-name">Name</Label>
                <Input
                  id="new-name"
                  value={addContactName}
                  onChange={(e) => setAddContactName(e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-title">Title</Label>
                <Input
                  id="new-title"
                  value={addContactTitle}
                  onChange={(e) => setAddContactTitle(e.target.value)}
                  placeholder="Role"
                />
              </div>
              <Button type="submit" size="sm" disabled={addContactBusy}>
                {addContactBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add contact"}
              </Button>
            </form>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Email</TableHead>
                  <TableHead className="text-xs text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((c) => {
                  const id = String((c as { id: string }).id);
                  const name = (c as { full_name?: string }).full_name ?? "—";
                  const email = String((c as { email: string }).email);
                  const subj = lastSentSubjectForContact(id);
                  return (
                    <TableRow key={id}>
                      <TableCell className="text-sm">{name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{email}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="outline" size="sm" className="h-8 gap-1">
                              <span className="sr-only">Open actions for {name}</span>
                              <MoreHorizontal className="h-4 w-4" aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem
                              onClick={() => openEditContact(c as Record<string, unknown>)}
                            >
                              <UserRound className="h-3.5 w-3.5 mr-2" />
                              Edit name and email
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openGenerate(id)}>
                              <Sparkles className="h-3.5 w-3.5 mr-2" />
                              AI draft
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setComposeContactId(id);
                                setComposeSubject("");
                                setComposeBody("");
                                setComposeOpen(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5 mr-2" />
                              Compose manually
                            </DropdownMenuItem>
                            {subj ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() =>
                                    openGenerate(
                                      id,
                                      `Short follow-up to our previous email (“${subj}”). Stay concise and reference the earlier message.`
                                    )
                                  }
                                >
                                  <Wand2 className="h-3.5 w-3.5 mr-2" />
                                  Follow-up draft
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {contacts.length > 0 && (
            <form onSubmit={handleAddContact} className="flex flex-wrap gap-2 items-end pt-2 border-t">
              <div className="space-y-1 flex-1 min-w-[140px]">
                <Label htmlFor="add-email-2" className="text-xs">
                  Add contact
                </Label>
                <Input
                  id="add-email-2"
                  type="email"
                  required
                  value={addContactEmail}
                  onChange={(e) => setAddContactEmail(e.target.value)}
                  placeholder="email"
                  className="h-8"
                />
              </div>
              <Input
                placeholder="Name"
                value={addContactName}
                onChange={(e) => setAddContactName(e.target.value)}
                className="h-8 max-w-[140px]"
              />
              <Input
                placeholder="Title"
                value={addContactTitle}
                onChange={(e) => setAddContactTitle(e.target.value)}
                className="h-8 max-w-[120px]"
              />
              <Button type="submit" size="sm" className="h-8" disabled={addContactBusy}>
                {addContactBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Outbound emails</CardTitle>
          <CardDescription>Drafts and sent messages for this deal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingEmails ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </p>
          ) : emails.length === 0 ? (
            <p className="text-sm text-muted-foreground">No emails yet. Generate or compose from a contact.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Subject</TableHead>
                  <TableHead className="text-xs">Contact</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emails.map((row) => (
                  <TableRow
                    key={row.id}
                    className={`cursor-pointer ${selectedEmailId === row.id ? "bg-muted/50" : ""}`}
                    onClick={() => setSelectedEmailId(row.id)}
                  >
                    <TableCell className="text-sm max-w-[200px] truncate" title={row.subject}>
                      {row.subject}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.contact_name || row.contact_email || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={emailStatusBadgeVariant(row.status)} className="text-xs font-normal capitalize">
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(row.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {selectedEmail && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Review</span>
                <Badge variant={emailStatusBadgeVariant(selectedEmail.status)} className="text-xs capitalize">
                  {selectedEmail.status}
                </Badge>
              </div>
              <div className="space-y-1">
                <Label htmlFor="subj">Subject</Label>
                <Input
                  id="subj"
                  value={editorSubject}
                  onChange={(e) => setEditorSubject(e.target.value)}
                  disabled={selectedEmail.status !== "draft" && selectedEmail.status !== "approved"}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="body">Body</Label>
                <Textarea
                  id="body"
                  rows={12}
                  value={editorBody}
                  onChange={(e) => setEditorBody(e.target.value)}
                  disabled={selectedEmail.status !== "draft" && selectedEmail.status !== "approved"}
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedEmail.status === "draft" && (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleSaveDraft()}
                      disabled={saveDraftBusy}
                    >
                      {saveDraftBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save draft"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleApprove()}
                      disabled={approveBusy}
                    >
                      {approveBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
                    </Button>
                  </>
                )}
                {selectedEmail.status === "approved" && (
                  <Button type="button" size="sm" onClick={() => void handleSend()} disabled={sendBusy}>
                    {sendBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-3.5 w-3.5 mr-1" />Send</>}
                  </Button>
                )}
                {selectedEmail.status === "sent" && selectedEmail.crm_thread_id && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    Thread synced
                  </span>
                )}
              </div>
            </div>
          )}

          {selectedEmail?.status === "sent" && selectedEmail.crm_thread_id && (
            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Conversation</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7"
                  onClick={() => void refetchThread({ showSpinner: true })}
                  disabled={loadingThread}
                >
                  {loadingThread ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      Refresh
                    </>
                  )}
                </Button>
              </div>
              {loadingThread && threadMessages.length === 0 ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : threadMessages.length === 0 ? (
                <p className="text-xs text-muted-foreground">No thread messages yet (replies appear after inbound mail).</p>
              ) : (
                <ul className="space-y-3">
                  {threadMessages.map((m) => (
                    <li
                      key={m.id}
                      className={`text-sm rounded-md p-3 border ${
                        m.direction === "inbound" ? "bg-background border-primary/20" : "bg-muted/30"
                      }`}
                    >
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span className="font-medium text-foreground">{m.direction}</span>
                        <span>{formatDateTime(m.received_at || m.sent_at || m.created_at)}</span>
                      </div>
                      {m.subject ? <p className="text-xs font-medium mb-1">{m.subject}</p> : null}
                      <pre className="whitespace-pre-wrap font-sans text-sm">{m.text_body || "(no body)"}</pre>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Sending uses your connected Gmail when available, otherwise Resend. Inbound replies still use the
        Resend Reply-To path when configured — see{" "}
        <code className="bg-muted px-1 rounded">docs/email_inbound_resend.md</code>.
      </p>

      <Dialog open={editContactOpen} onOpenChange={setEditContactOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit contact</DialogTitle>
            <DialogDescription>
              Name appears in the table and in AI drafts. Email must stay valid for sending.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="edit-contact-name">Name</Label>
              <Input
                id="edit-contact-name"
                value={editContactFullName}
                onChange={(e) => setEditContactFullName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-contact-title">Title (optional)</Label>
              <Input
                id="edit-contact-title"
                value={editContactTitle}
                onChange={(e) => setEditContactTitle(e.target.value)}
                placeholder="Role"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-contact-email">Email</Label>
              <Input
                id="edit-contact-email"
                type="email"
                required
                value={editContactEmail}
                onChange={(e) => setEditContactEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditContactOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleEditContactSubmit()} disabled={editContactBusy}>
              {editContactBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate draft</DialogTitle>
            <DialogDescription>Optional instructions tailor the AI output for this prospect.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="instr">Instructions</Label>
              <Textarea
                id="instr"
                rows={4}
                value={generateInstructions}
                onChange={(e) => setGenerateInstructions(e.target.value)}
                placeholder="e.g. Mention their recent expansion; keep tone formal."
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="reason">Reason for interest (optional)</Label>
              <Input
                id="reason"
                value={generateReason}
                onChange={(e) => setGenerateReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setGenerateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleGenerateSubmit()} disabled={generateBusy}>
              {generateBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Compose manually</DialogTitle>
            <DialogDescription>Write subject and body without AI.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="csub">Subject</Label>
              <Input id="csub" value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cbody">Body</Label>
              <Textarea id="cbody" rows={8} value={composeBody} onChange={(e) => setComposeBody(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setComposeOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleComposeSubmit()}
              disabled={composeBusy || !composeSubject.trim() || !composeBody.trim()}
            >
              {composeBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
