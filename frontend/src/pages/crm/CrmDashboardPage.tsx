import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDebounce } from "@/hooks/useDebounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listCrmCompanies,
  getCrmEmailConfig,
  getCrmGmailStatus,
  type CrmEmailConfig,
  type CrmGmailStatus,
} from "@/lib/api/crm";
import { Search, RefreshCw, Loader2, LayoutDashboard, Mail, ExternalLink, ArrowUpRight, Mails } from "lucide-react";
import { formatCrmDealStatusLabel, formatCrmShortDate, formatCrmCorrespondenceShort } from "./crm-format";
import { CrmGmailConnectBanner } from "./CrmGmailConnectBanner";

const LIST_LIMIT = 800;

const DEAL_STATUS_FILTER_VALUES = [
  "all",
  "target_identified",
  "outreach_ready",
  "outreach_sent",
  "replied",
  "in_dialogue",
  "meeting_scheduled",
  "declined",
  "parked",
  "closed",
  "none",
] as const;

type StatusFilter = (typeof DEAL_STATUS_FILTER_VALUES)[number];

interface CompanyRow {
  id: string;
  orgnr?: string | null;
  name: string;
  industry: string | null;
  website: string | null;
  deal_status: string | null;
  last_contacted_at: string | null;
  correspondence_total: number;
  correspondence_inbound: number;
  correspondence_outbound: number;
}

function statusBadgeVariant(
  status: string | null,
): "default" | "secondary" | "outline" | "destructive" {
  if (!status) return "outline";
  if (status === "declined") return "destructive";
  if (status === "closed" || status === "parked") return "outline";
  if (status === "meeting_scheduled" || status === "in_dialogue" || status === "replied")
    return "secondary";
  return "default";
}

function normalizeCompanyRow(r: Record<string, unknown>): CompanyRow {
  return {
    id: String(r.id),
    orgnr: (r.orgnr as string | null | undefined) ?? null,
    name: String(r.name ?? ""),
    industry: (r.industry as string | null) ?? null,
    website: (r.website as string | null) ?? null,
    deal_status: (r.deal_status as string | null) ?? null,
    last_contacted_at: (r.last_contacted_at as string | null) ?? null,
    correspondence_total: Number(r.correspondence_total) || 0,
    correspondence_inbound: Number(r.correspondence_inbound) || 0,
    correspondence_outbound: Number(r.correspondence_outbound) || 0,
  };
}

function companyInitial(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  return t.charAt(0).toUpperCase();
}

export default function CrmDashboardPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [crmEmailConfig, setCrmEmailConfig] = useState<CrmEmailConfig | null>(null);
  const [crmGmailStatus, setCrmGmailStatus] = useState<CrmGmailStatus | null>(null);
  const [crmEmailSettingsLoading, setCrmEmailSettingsLoading] = useState(true);
  const [gmailConnectBusy, setGmailConnectBusy] = useState(false);

  const loadSettings = useCallback(async () => {
    setCrmEmailSettingsLoading(true);
    try {
      const cfg = await getCrmEmailConfig();
      setCrmEmailConfig(cfg);
      if (cfg.gmail_oauth_server_configured) {
        try {
          setCrmGmailStatus(await getCrmGmailStatus());
        } catch {
          setCrmGmailStatus(null);
        }
      } else {
        setCrmGmailStatus(null);
      }
    } catch {
      setCrmEmailConfig(null);
      setCrmGmailStatus(null);
    } finally {
      setCrmEmailSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCrmCompanies(debouncedSearch, LIST_LIMIT, { sort: "last_contact" });
      const raw = Array.isArray(data) ? data : [];
      setRows(raw.map((r) => normalizeCompanyRow(r as Record<string, unknown>)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load companies");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

  const stats = useMemo(() => {
    const total = rows.length;
    let contacted = 0;
    let never = 0;
    let threadMessages = 0;
    let inboundMessages = 0;
    let companiesWithThread = 0;
    const byStatus = new Map<string, number>();
    for (const r of rows) {
      if (r.last_contacted_at) contacted++;
      else never++;
      const key = r.deal_status ?? "none";
      byStatus.set(key, (byStatus.get(key) ?? 0) + 1);
      threadMessages += r.correspondence_total;
      inboundMessages += r.correspondence_inbound;
      if (r.correspondence_total > 0) companiesWithThread++;
    }
    return { total, contacted, never, byStatus, threadMessages, inboundMessages, companiesWithThread };
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "none") return r.deal_status == null;
      return r.deal_status === statusFilter;
    });
  }, [rows, statusFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const at = a.last_contacted_at ? new Date(a.last_contacted_at).getTime() : 0;
      const bt = b.last_contacted_at ? new Date(b.last_contacted_at).getTime() : 0;
      if (bt !== at) return bt - at;
      return a.name.localeCompare(b.name);
    });
  }, [filtered]);

  const openCompany = useCallback(
    (id: string) => {
      navigate(`/crm/company/${id}`, { state: { crmBackPath: "/crm/dashboard" } });
    },
    [navigate]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="border-b border-border bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30">
              <LayoutDashboard className="h-4 w-4 text-muted-foreground" aria-hidden />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
                CRM dashboard
              </h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Pipeline health and company list — open a row for the workspace, threads, and outreach. Search runs
                on the server; list is sorted by last activity.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link to="/crm" className="gap-1.5">
                <Mail className="h-3.5 w-3.5" aria-hidden />
                Mailbox
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => void loadCompanies()}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              )}
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-4 md:p-6 lg:px-8">
        <CrmGmailConnectBanner
          emailConfig={crmEmailConfig}
          gmailStatus={crmGmailStatus}
          connectBusy={gmailConnectBusy}
          onConnectStart={() => setGmailConnectBusy(true)}
          onConnectEnd={() => setGmailConnectBusy(false)}
          onGmailDisconnected={() => void loadSettings()}
          loading={crmEmailSettingsLoading}
        />

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load companies</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span className="break-words">{error}</span>
              <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => void loadCompanies()}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            <>
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
            </>
          ) : (
            <>
              <div className="rounded-lg border border-border/80 bg-muted/10 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Companies</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{stats.total}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {debouncedSearch.trim() ? "Matching search (up to limit)" : `Loaded (up to ${LIST_LIMIT})`}
                </p>
              </div>
              <div className="rounded-lg border border-border/80 bg-muted/10 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Contacted</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{stats.contacted}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Has a last-contact timestamp</p>
              </div>
              <div className="rounded-lg border border-border/80 bg-muted/10 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Not contacted</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{stats.never}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">No outreach logged yet</p>
              </div>
              <div className="rounded-lg border border-border/80 bg-muted/10 px-4 py-3">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Mails className="h-3.5 w-3.5" aria-hidden />
                  Correspondence
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{stats.threadMessages}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {stats.inboundMessages} inbound total · {stats.companiesWithThread} with thread activity
                </p>
              </div>
            </>
          )}
        </div>

        {!loading && stats.total > 0 ? (
          <div className="flex flex-wrap gap-2">
            <span className="w-full text-xs font-medium text-muted-foreground sm:w-auto sm:py-1.5">By status</span>
            {DEAL_STATUS_FILTER_VALUES.filter((v) => v !== "all").map((key) => {
              const count = key === "none" ? (stats.byStatus.get("none") ?? 0) : (stats.byStatus.get(key) ?? 0);
              if (count === 0) return null;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    statusFilter === key
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {key === "none" ? "No deal" : formatCrmDealStatusLabel(key)}
                  <span className="tabular-nums text-muted-foreground">({count})</span>
                </button>
              );
            })}
            {statusFilter !== "all" ? (
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setStatusFilter("all")}>
                Clear filter
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-md flex-1">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                placeholder="Search company name (server)…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-8"
                autoComplete="off"
                aria-label="Search CRM companies"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="h-9 w-full sm:w-[200px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="none">No deal</SelectItem>
                <SelectItem value="target_identified">Target identified</SelectItem>
                <SelectItem value="outreach_ready">Outreach ready</SelectItem>
                <SelectItem value="outreach_sent">Outreach sent</SelectItem>
                <SelectItem value="replied">Replied</SelectItem>
                <SelectItem value="in_dialogue">In dialogue</SelectItem>
                <SelectItem value="meeting_scheduled">Meeting scheduled</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
                <SelectItem value="parked">Parked</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-border/80 overflow-hidden bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : sorted.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No companies match this filter. Try clearing search or status.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Company</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Industry</TableHead>
                    <TableHead className="text-xs hidden lg:table-cell">Domain</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Status</TableHead>
                    <TableHead className="text-xs hidden lg:table-cell">Thread</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Last contact</TableHead>
                    <TableHead className="text-xs w-[72px] text-right">Open</TableHead>
                    <TableHead className="w-8 p-2" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((c) => (
                    <TableRow
                      key={c.id}
                      className="group cursor-pointer hover:bg-muted/40"
                      onClick={() => openCompany(c.id)}
                    >
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-foreground sm:flex"
                            aria-hidden
                          >
                            {companyInitial(c.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="max-w-[220px] truncate font-medium text-foreground" title={c.name}>
                              {c.name}
                            </div>
                            {c.orgnr && !String(c.orgnr).startsWith("crm-ext-") ? (
                              <div className="max-w-[220px] truncate text-xs text-muted-foreground">{c.orgnr}</div>
                            ) : c.industry ? (
                              <div className="max-w-[220px] truncate text-xs text-muted-foreground sm:hidden">{c.industry}</div>
                            ) : null}
                            <div className="mt-1 sm:hidden">
                              {c.deal_status ? (
                                <Badge variant={statusBadgeVariant(c.deal_status)} className="text-[10px] font-normal">
                                  {formatCrmDealStatusLabel(c.deal_status)}
                                </Badge>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">No deal</span>
                              )}
                            </div>
                            <p className="mt-1 text-[10px] text-muted-foreground sm:hidden" title="CRM email thread messages">
                              {formatCrmCorrespondenceShort(c.correspondence_total, c.correspondence_inbound)}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden py-2.5 text-sm text-muted-foreground md:table-cell">
                        <span className="line-clamp-2">{c.industry ?? "—"}</span>
                      </TableCell>
                      <TableCell className="hidden py-2.5 lg:table-cell">
                        {c.website ? (
                          <a
                            href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex max-w-[160px] items-center gap-1 truncate text-sm text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="truncate">{c.website.replace(/^https?:\/\//, "")}</span>
                            <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden py-2.5 sm:table-cell">
                        {c.deal_status ? (
                          <Badge variant={statusBadgeVariant(c.deal_status)} className="text-xs font-normal">
                            {formatCrmDealStatusLabel(c.deal_status)}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell
                        className="hidden max-w-[140px] py-2.5 text-sm lg:table-cell"
                        title={`${c.correspondence_outbound} outbound, ${c.correspondence_inbound} inbound in CRM threads`}
                      >
                        <span className="text-foreground">{formatCrmCorrespondenceShort(c.correspondence_total, c.correspondence_inbound)}</span>
                      </TableCell>
                      <TableCell className="hidden py-2.5 text-sm text-muted-foreground md:table-cell">
                        {c.last_contacted_at ? formatCrmShortDate(c.last_contacted_at) : "Not contacted"}
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" asChild>
                          <Link to={`/crm/company/${c.id}`} state={{ crmBackPath: "/crm/dashboard" }} onClick={(e) => e.stopPropagation()}>
                            Open
                          </Link>
                        </Button>
                      </TableCell>
                      <TableCell className="py-2.5 p-2 text-right">
                        <ArrowUpRight className="ml-auto h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-70" aria-hidden />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
