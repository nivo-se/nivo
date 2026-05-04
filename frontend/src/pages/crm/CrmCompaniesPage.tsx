import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDebounce } from "@/hooks/useDebounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Search, RefreshCw, ExternalLink, ArrowUpRight } from "lucide-react";
import {
  getCrmEmailConfig,
  getCrmGmailStatus,
  listCrmCompanies,
  type CrmEmailConfig,
  type CrmGmailStatus,
} from "@/lib/api/crm";
import { CrmGmailConnectBanner } from "./CrmGmailConnectBanner";

interface CrmCompanyRow {
  id: string;
  orgnr?: string | null;
  name: string;
  industry: string | null;
  website: string | null;
  deal_status: string | null;
  last_contacted_at: string | null;
}

function formatStatus(status: string | null): string {
  if (!status) return "—";
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatDate(ts: string | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function companyInitial(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  return t.charAt(0).toUpperCase();
}

/** CRM object-style list: full-width table, soft grid, activity-first sort (Attio-inspired). */
export default function CrmCompaniesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [rows, setRows] = useState<CrmCompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      const data = await listCrmCompanies(debouncedSearch, 500, { sort: "last_contact" });
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Failed to load companies");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

  const openCompany = useCallback(
    (id: string) => {
      navigate(`/crm/company/${id}`, { state: { crmBackPath: "/crm/companies" } });
    },
    [navigate]
  );

  const tableShellClass = useMemo(
    () =>
      "rounded-xl border border-border/80 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden",
    []
  );

  return (
    <div className="h-full overflow-hidden app-bg flex flex-col">
      <header className="shrink-0 border-b border-border/80 bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-8">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <span>CRM</span>
              <span className="text-border">/</span>
              <span className="text-foreground">Companies</span>
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              Companies you&apos;ve contacted
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              Open a record to see deal status, contacts, and full email threads. Sorted by last activity.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            <Button type="button" variant="outline" size="sm" asChild className="h-9">
              <Link to="/crm">Back to mailbox</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-auto px-4 py-6 md:px-8">
        <div className="mx-auto max-w-[1400px] space-y-5">
          <CrmGmailConnectBanner
            emailConfig={crmEmailConfig}
            gmailStatus={crmGmailStatus}
            connectBusy={gmailConnectBusy}
            onConnectStart={() => setGmailConnectBusy(true)}
            onConnectEnd={() => setGmailConnectBusy(false)}
            onGmailDisconnected={() => void loadSettings()}
            loading={crmEmailSettingsLoading}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-md flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                placeholder="Search companies…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 rounded-lg border-border/80 bg-background pl-10 text-sm shadow-none"
                autoComplete="off"
                aria-label="Search CRM companies"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0"
              onClick={() => void loadCompanies()}
              disabled={loading}
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

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

          <div className={tableShellClass}>
            <Table>
              <TableHeader>
                <TableRow className="border-border/80 hover:bg-transparent">
                  <TableHead className="h-11 w-[40%] text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Company
                  </TableHead>
                  <TableHead className="hidden h-11 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:table-cell">
                    Industry
                  </TableHead>
                  <TableHead className="hidden h-11 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:table-cell">
                    Domain
                  </TableHead>
                  <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Stage
                  </TableHead>
                  <TableHead className="h-11 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Last touch
                  </TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={i} className="border-border/60">
                        <TableCell colSpan={6} className="py-3">
                          <Skeleton className="h-10 w-full rounded-md" />
                        </TableCell>
                      </TableRow>
                    ))
                  : null}
                {!loading && rows.length === 0 ? (
                  <TableRow className="border-border/60 hover:bg-transparent">
                    <TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground">
                      No companies match. Add records from the mailbox or Deep Research.
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loading &&
                  rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="group cursor-pointer border-border/60 transition-colors hover:bg-muted/40"
                      onClick={() => openCompany(row.id)}
                    >
                      <TableCell className="py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-foreground"
                            aria-hidden
                          >
                            {companyInitial(row.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-foreground group-hover:underline">
                              {row.name}
                            </div>
                            {row.orgnr && !String(row.orgnr).startsWith("crm-ext-") ? (
                              <div className="truncate text-xs text-muted-foreground">{row.orgnr}</div>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden py-3 text-sm text-muted-foreground md:table-cell">
                        <span className="line-clamp-2">{row.industry ?? "—"}</span>
                      </TableCell>
                      <TableCell className="hidden py-3 lg:table-cell">
                        {row.website ? (
                          <a
                            href={row.website.startsWith("http") ? row.website : `https://${row.website}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex max-w-[180px] items-center gap-1 truncate text-sm text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="truncate">{row.website.replace(/^https?:\/\//, "")}</span>
                            <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        {row.deal_status ? (
                          <Badge variant="secondary" className="text-xs font-medium shadow-none">
                            {formatStatus(row.deal_status)}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-right text-sm tabular-nums text-muted-foreground">
                        {formatDate(row.last_contacted_at)}
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <ArrowUpRight className="ml-auto h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
