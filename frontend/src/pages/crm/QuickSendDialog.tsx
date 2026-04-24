import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/hooks/useDebounce";
import { useToast } from "@/hooks/use-toast";
import {
  getCrmEmailConfig,
  getCrmGmailStatus,
  listCrmCompanies,
  quickSend,
  type CrmEmailConfig,
  type CrmGmailStatus,
  type QuickSendResult,
} from "@/lib/api/crm";

interface CrmCompanyMatch {
  id: string;
  name: string;
  industry: string | null;
}

interface QuickSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful send so the parent can navigate or refresh. */
  onSent?: (result: QuickSendResult) => void;
}

/**
 * Single-screen "paste from Claude → send" composer.
 * Creates company/contact/deal under the hood; sends via your connected Gmail or Resend.
 */
export function QuickSendDialog({ open, onOpenChange, onSent }: QuickSendDialogProps) {
  const { toast } = useToast();

  const [toEmail, setToEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const [matches, setMatches] = useState<CrmCompanyMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const debouncedCompany = useDebounce(companyName, 250);

  const [emailConfig, setEmailConfig] = useState<CrmEmailConfig | null>(null);
  const [gmailStatus, setGmailStatus] = useState<CrmGmailStatus | null>(null);

  const reset = useCallback(() => {
    setToEmail("");
    setRecipientName("");
    setCompanyName("");
    setCompanyId(null);
    setSubject("");
    setBody("");
    setMatches([]);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getCrmEmailConfig()
      .then(async (cfg) => {
        if (cancelled) return;
        setEmailConfig(cfg);
        if (!cfg.gmail_oauth_server_configured) {
          setGmailStatus(null);
          return;
        }
        try {
          const g = await getCrmGmailStatus();
          if (!cancelled) setGmailStatus(g);
        } catch {
          if (!cancelled) setGmailStatus(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEmailConfig(null);
          setGmailStatus(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (companyId) {
      setMatches([]);
      return;
    }
    const term = debouncedCompany.trim();
    if (term.length < 2) {
      setMatches([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    listCrmCompanies(term, 6)
      .then((rows) => {
        if (cancelled) return;
        setMatches(
          rows.map((r) => ({ id: r.id, name: r.name, industry: r.industry }))
        );
      })
      .catch(() => {
        if (!cancelled) setMatches([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, debouncedCompany, companyId]);

  const canSend = useMemo(() => {
    return (
      !!toEmail.trim() &&
      !!companyName.trim() &&
      !!subject.trim() &&
      !!body.trim() &&
      !busy
    );
  }, [toEmail, companyName, subject, body, busy]);

  const resendOk = emailConfig?.resend_configured === true;
  const gmailOk =
    emailConfig?.gmail_oauth_server_configured === true && gmailStatus?.connected === true;
  const deliveryReady = Boolean(resendOk || gmailOk);

  const handleSubmit = async () => {
    if (!canSend) return;
    setBusy(true);
    try {
      const result = await quickSend({
        to_email: toEmail.trim(),
        recipient_name: recipientName.trim() || undefined,
        company_id: companyId ?? undefined,
        company_name: companyId ? undefined : companyName.trim(),
        subject: subject.trim(),
        body_text: body,
      });
      toast({
        title: "Email sent",
        description: `${subject.trim()} → ${toEmail.trim()}`,
      });
      reset();
      onOpenChange(false);
      onSent?.(result);
    } catch (e) {
      toast({
        title: "Send failed",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const pickMatch = (m: CrmCompanyMatch) => {
    setCompanyId(m.id);
    setCompanyName(m.name);
    setMatches([]);
  };

  const clearCompanyPick = () => {
    setCompanyId(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            Quick send
          </DialogTitle>
          <DialogDescription>
            Paste subject and body (e.g. drafted in Claude). We file it under the company and
            send from your connected Gmail, or from Resend when that is the active path.
          </DialogDescription>
        </DialogHeader>

        {emailConfig && !deliveryReady ? (
          <Alert variant="destructive" className="py-2">
            <AlertTitle className="text-xs">No send path available</AlertTitle>
            <AlertDescription className="text-xs">
              {emailConfig.gmail_oauth_server_configured && !gmailStatus?.connected
                ? "Click Connect Gmail on the CRM home, or set up Resend. "
                : null}
              {!emailConfig.gmail_oauth_server_configured
                ? "For Gmail, add Google OAuth env on the server. "
                : null}
              {!resendOk ? (
                <span>
                  Resend (optional if Gmail works):{" "}
                  {emailConfig.missing.length ? emailConfig.missing.join(", ") : "not configured"}.
                </span>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-3 py-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="qs-to">To (email)</Label>
              <Input
                id="qs-to"
                type="email"
                autoComplete="off"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                placeholder="founder@example.com"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="qs-name">Recipient name (optional)</Label>
              <Input
                id="qs-name"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="qs-company">Company</Label>
            <div className="relative">
              <Input
                id="qs-company"
                value={companyName}
                onChange={(e) => {
                  setCompanyName(e.target.value);
                  if (companyId) setCompanyId(null);
                }}
                placeholder="Acme AB (existing or new)"
                autoComplete="off"
              />
              {companyId ? (
                <button
                  type="button"
                  onClick={clearCompanyPick}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted/70"
                  aria-label="Clear linked CRM company"
                >
                  <span className="inline-flex items-center gap-1">
                    Linked <X className="h-3 w-3" />
                  </span>
                </button>
              ) : null}
            </div>
            {!companyId && matches.length > 0 ? (
              <div className="rounded-md border border-border bg-popover p-1 shadow-sm">
                {matches.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => pickMatch(m)}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    <span className="truncate">{m.name}</span>
                    {m.industry ? (
                      <span className="ml-2 truncate text-xs text-muted-foreground">
                        {m.industry}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
            <p className="text-[11px] text-muted-foreground">
              {companyId ? (
                <>
                  Using existing CRM company.{" "}
                  <Badge variant="secondary" className="ml-1 align-middle text-[10px]">
                    linked
                  </Badge>
                </>
              ) : searching ? (
                "Searching CRM…"
              ) : companyName.trim().length >= 2 && matches.length === 0 ? (
                "No match — a new CRM company will be created on send."
              ) : (
                "Type at least 2 characters to search existing CRM companies."
              )}
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="qs-subject">Subject</Label>
            <Input
              id="qs-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Quick intro re: …"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="qs-body">Body</Label>
            <Textarea
              id="qs-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Paste from Claude / your draft…"
              rows={12}
              className="font-mono text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Plain text only. Tracking pixel + link wrapping are added automatically.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={!canSend || !deliveryReady}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" /> Send now
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
