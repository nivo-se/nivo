import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useDebounce } from "@/hooks/useDebounce";
import { ArrowLeft, Building2, Search } from "lucide-react";

interface CrmCompany {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  deal_status: string | null;
  last_contacted_at: string | null;
}

interface OverviewData {
  company: Record<string, unknown> | null;
  deal: Record<string, unknown>;
  contacts: unknown[];
  engagement_summary: { open_count: number; click_count: number };
}

function formatDate(ts: string | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatStatus(status: string | null): string {
  if (!status) return "—";
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** CRM page: searchable company list + company detail. API proxied /crm -> 3001. */
export default function CrmPage() {
  const { companyId } = useParams<{ companyId?: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [companies, setCompanies] = useState<CrmCompany[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  // Fetch company list
  useEffect(() => {
    setLoadingCompanies(true);
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    params.set("limit", "50");
    fetch(`/crm/companies?${params}`)
      .then((r) => r.json())
      .then((json) => {
        setCompanies(json?.data ?? []);
      })
      .catch(() => setCompanies([]))
      .finally(() => setLoadingCompanies(false));
  }, [debouncedSearch]);

  // Fetch overview when company selected
  useEffect(() => {
    if (!companyId) {
      setOverview(null);
      setOverviewError(null);
      return;
    }
    setOverviewError(null);
    setLoadingOverview(true);
    fetch(`/crm/company/${encodeURIComponent(companyId)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          setOverviewError(json?.error ?? `HTTP ${res.status}`);
          setOverview(null);
          return;
        }
        setOverview(json.data ?? json);
      })
      .catch((e) => {
        setOverviewError(e instanceof Error ? e.message : "Request failed");
        setOverview(null);
      })
      .finally(() => setLoadingOverview(false));
  }, [companyId]);

  const showDetail = !!companyId;

  return (
    <div className="h-full overflow-hidden app-bg flex flex-col">
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* List panel */}
        <aside className="w-full lg:w-72 shrink-0 border-r border-border flex flex-col bg-card/50">
          <div className="p-4 border-b border-border shrink-0">
            <h1 className="text-base font-semibold text-foreground mb-2">Origination CRM</h1>
            <p className="text-xs text-muted-foreground mb-3">
              Companies from Deep Research. Click to view deal and contacts.
            </p>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search companies…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            {loadingCompanies ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : companies.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No companies found. Add companies via Deep Research first.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Company</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Status</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Last contact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((c) => (
                    <TableRow
                      key={c.id}
                      className={`cursor-pointer ${companyId === c.id ? "bg-muted/50" : "hover:bg-muted/30"}`}
                      onClick={() => navigate(`/crm/company/${c.id}`)}
                    >
                      <TableCell className="py-2">
                        <div className="font-medium text-sm truncate max-w-[140px]" title={c.name}>
                          {c.name}
                        </div>
                        {c.industry && (
                          <div className="text-xs text-muted-foreground truncate max-w-[140px]">
                            {c.industry}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-2 hidden sm:table-cell">
                        {c.deal_status ? (
                          <Badge variant="secondary" className="text-xs font-normal">
                            {formatStatus(c.deal_status)}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2 hidden md:table-cell text-xs text-muted-foreground">
                        {formatDate(c.last_contacted_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </aside>

        {/* Detail panel */}
        <main className="flex-1 min-w-0 overflow-auto">
          {!showDetail ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Select a company from the list
            </div>
          ) : loadingOverview ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : overviewError ? (
            <div className="p-8">
              <p className="text-sm text-destructive">{overviewError}</p>
              <button
                type="button"
                onClick={() => navigate("/crm")}
                className="mt-2 text-sm text-primary hover:underline flex items-center gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to list
              </button>
            </div>
          ) : overview ? (
            <div className="p-6 lg:p-8 max-w-3xl">
              <button
                type="button"
                onClick={() => navigate("/crm")}
                className="mb-4 text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to list
              </button>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">
                      {(overview.company as Record<string, unknown>)?.name ?? "—"}
                    </CardTitle>
                  </div>
                  <CardDescription>
                    {(overview.company as Record<string, unknown>)?.industry ?? ""}
                    {(overview.company as Record<string, unknown>)?.website && (
                      <>
                        {" · "}
                        <a
                          href={(overview.company as Record<string, unknown>).website as string}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          Website
                        </a>
                      </>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <span className="font-medium text-foreground">Deal status:</span>{" "}
                    <Badge variant="secondary">
                      {formatStatus((overview.deal as Record<string, unknown>)?.status as string)}
                    </Badge>
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Contacts:</span>{" "}
                    {Array.isArray(overview.contacts) ? overview.contacts.length : 0}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Engagement:</span>{" "}
                    {(overview.engagement_summary?.open_count ?? 0)} opens,{" "}
                    {(overview.engagement_summary?.click_count ?? 0)} clicks
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-muted-foreground text-sm">
                      Raw response
                    </summary>
                    <pre className="mt-2 overflow-auto text-xs bg-muted p-2 rounded">
                      {JSON.stringify(overview, null, 2)}
                    </pre>
                  </details>
                </CardContent>
              </Card>
              <p className="mt-6 text-xs text-muted-foreground">
                Setup: see <code className="bg-muted px-1 rounded">docs/CRM_SETUP.md</code>. CRM uses
                local Postgres (POSTGRES_* or DATABASE_URL in .env).
              </p>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
