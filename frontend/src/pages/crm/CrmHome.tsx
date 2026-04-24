import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Inbox,
  Loader2,
  Mail,
  RefreshCw,
  Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  getRecentInbound,
  getRecentSent,
  listCrmCompanies,
  type CrmInboundRecentRow,
  type CrmRecentSentRow,
} from "@/lib/api/crm";

interface CrmCompanyRow {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  deal_status: string | null;
  last_contacted_at: string | null;
}

interface CrmHomeProps {
  onCompose: () => void;
  onOpenCompany: (companyId: string) => void;
  onOpenInbox: () => void;
  onBrowseCompanies: () => void;
}

function timeAgo(input: string | null | undefined): string {
  if (!input) return "—";
  const t = new Date(input).getTime();
  if (Number.isNaN(t)) return "—";
  const diffMs = Date.now() - t;
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 14) return `${day}d ago`;
  return new Date(input).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatStatusLabel(status: string): string {
  if (status === "sent") return "Delivered";
  if (status === "failed") return "Failed";
  if (status === "bounced") return "Bounced";
  if (status === "replied") return "Replied";
  if (status === "approved") return "Ready";
  if (status === "draft") return "Draft";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusVariant(
  status: string
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "failed" || status === "bounced") return "destructive";
  if (status === "replied") return "default";
  return "secondary";
}

/**
 * CRM home — mailbox-style overview shown when no company is open.
 * Surfaces what's actually in the system (recent sent, replies, recently touched companies)
 * instead of a feature explainer; uses email-app vocabulary, not CRM jargon.
 */
export function CrmHome({
  onCompose,
  onOpenCompany,
  onOpenInbox,
  onBrowseCompanies,
}: CrmHomeProps) {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [sent, setSent] = useState<CrmRecentSentRow[]>([]);
  const [replies, setReplies] = useState<CrmInboundRecentRow[]>([]);
  const [companies, setCompanies] = useState<CrmCompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchAll = useCallback(
    async (mode: "initial" | "refresh") => {
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      setLoadError(null);
      try {
        const [s, r, c] = await Promise.all([
          getRecentSent(8),
          getRecentInbound(6),
          listCrmCompanies("", 6),
        ]);
        setSent(Array.isArray(s) ? s : []);
        setReplies(Array.isArray(r) ? r : []);
        setCompanies(Array.isArray(c) ? (c as CrmCompanyRow[]) : []);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Failed to load");
        if (mode === "refresh") {
          toast({ title: "Could not refresh", variant: "destructive" });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    void fetchAll("initial");
  }, [fetchAll]);

  const totalSent = sent.length;
  const totalReplies = replies.length;
  const totalCompanies = companies.length;
  const headerStats = useMemo(
    () =>
      [
        { label: "Recent sent", value: totalSent, icon: Send },
        { label: "Recent replies", value: totalReplies, icon: Inbox },
        { label: "Companies tracked", value: totalCompanies, icon: Building2 },
      ] as const,
    [totalSent, totalReplies, totalCompanies]
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">Mailbox</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Recently sent, recent replies, and the companies you're in touch with.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void fetchAll("refresh")}
            disabled={refreshing || loading}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Refresh
              </>
            )}
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={onCompose}>
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Compose
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {headerStats.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-lg border border-border/70 bg-muted/15 px-4 py-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            </div>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums text-foreground">
              {loading ? "—" : value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border/70 bg-background">
          <header className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Send className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              <h3 className="text-sm font-medium text-foreground">Sent</h3>
            </div>
            <span className="text-[11px] text-muted-foreground">last 8</span>
          </header>
          <div className="divide-y divide-border/60">
            {loading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : sent.length === 0 ? (
              <EmptyRow
                title="Nothing sent yet"
                hint="Click Compose to send your first email — it'll appear here."
              />
            ) : (
              sent.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="flex w-full items-start justify-between gap-3 px-4 py-2.5 text-left hover:bg-muted/40"
                  onClick={() => row.company_id && onOpenCompany(row.company_id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {row.subject || "(no subject)"}
                      </p>
                      <Badge
                        variant={statusVariant(row.status)}
                        className="shrink-0 text-[10px] font-normal"
                      >
                        {formatStatusLabel(row.status)}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      To {row.contact_email || row.contact_name || "—"}
                      {row.company_name ? ` · ${row.company_name}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap pt-0.5 text-[11px] text-muted-foreground">
                    {timeAgo(row.sent_at || row.created_at)}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded-lg border border-border/70 bg-background">
          <header className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Inbox className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              <h3 className="text-sm font-medium text-foreground">Replies</h3>
            </div>
            <button
              type="button"
              onClick={onOpenInbox}
              className="text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Open inbox →
            </button>
          </header>
          <div className="divide-y divide-border/60">
            {loading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : replies.length === 0 ? (
              <EmptyRow
                title="No replies yet"
                hint="When someone replies, it lands here and on the company's page."
              />
            ) : (
              replies.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="flex w-full items-start justify-between gap-3 px-4 py-2.5 text-left hover:bg-muted/40"
                  onClick={() => onOpenCompany(row.company_id)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {row.subject || "(no subject)"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      From {row.contact_email || "—"}
                      {row.company_name ? ` · ${row.company_name}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap pt-0.5 text-[11px] text-muted-foreground">
                    {timeAgo(row.received_at || row.created_at)}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-border/70 bg-background">
        <header className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <h3 className="text-sm font-medium text-foreground">Companies</h3>
          </div>
          <button
            type="button"
            onClick={onBrowseCompanies}
            className="text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Browse all →
          </button>
        </header>
        <div className="divide-y divide-border/60">
          {loading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : companies.length === 0 ? (
            <EmptyRow
              title="No companies yet"
              hint="Add one via Compose, or browse companies already in the system."
            />
          ) : (
            companies.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => navigate(`/crm/company/${c.id}`)}
                className="flex w-full items-start justify-between gap-3 px-4 py-2.5 text-left hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {c.name}
                  </p>
                  {c.industry ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {c.industry}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 whitespace-nowrap pt-0.5 text-[11px] text-muted-foreground">
                  {c.last_contacted_at ? timeAgo(c.last_contacted_at) : "Not contacted"}
                </span>
              </button>
            ))
          )}
        </div>
      </section>

      {loadError ? (
        <p className="text-xs text-destructive">
          Couldn't load mailbox: {loadError}
        </p>
      ) : null}
    </div>
  );
}

function EmptyRow({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="px-4 py-6 text-center">
      <Mail className="mx-auto mb-2 h-5 w-5 text-muted-foreground/70" aria-hidden />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
