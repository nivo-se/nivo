import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDebounce } from "@/hooks/useDebounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { listCrmCompanies } from "@/lib/api/crm";
import { Search, RefreshCw, Loader2, LayoutDashboard, Mail } from "lucide-react";
import { formatCrmDealStatusLabel, formatCrmShortDate } from "./crm-format";

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
  name: string;
  industry: string | null;
  website: string | null;
  deal_status: string | null;
  last_contacted_at: string | null;
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

export default function CrmDashboardPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCrmCompanies("", LIST_LIMIT);
      setRows(data as CompanyRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load companies");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const total = rows.length;
    let contacted = 0;
    let never = 0;
    const byStatus = new Map<string, number>();
    for (const r of rows) {
      if (r.last_contacted_at) contacted++;
      else never++;
      const key = r.deal_status ?? "none";
      byStatus.set(key, (byStatus.get(key) ?? 0) + 1);
    }
    return { total, contacted, never, byStatus };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter === "all") {
        /* all */
      } else if (statusFilter === "none") {
        if (r.deal_status != null) return false;
      } else if (r.deal_status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || (r.industry?.toLowerCase().includes(q) ?? false);
    });
  }, [rows, debouncedSearch, statusFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const at = a.last_contacted_at ? new Date(a.last_contacted_at).getTime() : 0;
      const bt = b.last_contacted_at ? new Date(b.last_contacted_at).getTime() : 0;
      if (bt !== at) return bt - at;
      return a.name.localeCompare(b.name);
    });
  }, [filtered]);

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
                Pipeline health: who has been contacted, current deal status, and last touch — open a row for
                email and workspace.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link to="/crm" className="gap-1.5">
                <Mail className="h-3.5 w-3.5" aria-hidden />
                Email
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => void load()}
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
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {loading ? (
            <>
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
            </>
          ) : (
            <>
              <div className="rounded-lg border border-border/80 bg-muted/10 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Companies</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{stats.total}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">In CRM (up to {LIST_LIMIT} loaded)</p>
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
                placeholder="Search company or industry…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-8"
                autoComplete="off"
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

          <div className="rounded-lg border border-border/80 overflow-hidden">
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
                  <TableRow>
                    <TableHead className="text-xs">Company</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Status</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Last contact</TableHead>
                    <TableHead className="text-xs w-[72px] text-right">Open</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => navigate(`/crm/company/${c.id}`)}
                    >
                      <TableCell className="py-2.5">
                        <div className="max-w-[220px] truncate font-medium text-foreground" title={c.name}>
                          {c.name}
                        </div>
                        {c.industry ? (
                          <div className="max-w-[220px] truncate text-xs text-muted-foreground">{c.industry}</div>
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
                      <TableCell className="hidden py-2.5 text-sm text-muted-foreground md:table-cell">
                        {c.last_contacted_at ? formatCrmShortDate(c.last_contacted_at) : "Not contacted"}
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" asChild>
                          <Link to={`/crm/company/${c.id}`} onClick={(e) => e.stopPropagation()}>
                            Open
                          </Link>
                        </Button>
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
