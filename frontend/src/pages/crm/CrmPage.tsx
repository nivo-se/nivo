import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { useDebounce } from "@/hooks/useDebounce";
import { Search } from "lucide-react";
import { listCrmCompanies } from "@/lib/api/crm";
import { CrmWorkspace } from "./CrmWorkspace";

interface CrmCompany {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  deal_status: string | null;
  last_contacted_at: string | null;
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

/** CRM: company list + outreach workspace (proxied `/crm` → enhanced server). */
export default function CrmPage() {
  const { companyId } = useParams<{ companyId?: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [companies, setCompanies] = useState<CrmCompany[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingCompanies(true);
    setListError(null);
    listCrmCompanies(debouncedSearch, 50)
      .then((data) => setCompanies(data ?? []))
      .catch((e) => {
        setCompanies([]);
        setListError(e instanceof Error ? e.message : "Failed to load companies");
      })
      .finally(() => setLoadingCompanies(false));
  }, [debouncedSearch]);

  const showDetail = !!companyId;

  return (
    <div className="h-full overflow-hidden app-bg flex flex-col">
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <aside className="w-full lg:w-72 shrink-0 border-r border-sidebar-border flex flex-col bg-sidebar-bg shadow-[4px_0_24px_-12px_hsl(var(--primary)/0.12)]">
          <div className="p-4 border-b border-sidebar-border/80 shrink-0">
            <h1 className="text-base font-semibold text-foreground mb-2">Origination CRM</h1>
            <p className="text-xs text-muted-foreground mb-3">
              Search companies, open a record to draft and send outreach.
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
            {listError ? (
              <p className="text-xs text-destructive mt-2">{listError}</p>
            ) : null}
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

        <main className="flex-1 min-w-0 overflow-auto">
          {!showDetail ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm p-8">
              Select a company to manage contacts, drafts, and sends.
            </div>
          ) : (
            <CrmWorkspace companyIdParam={companyId} onBack={() => navigate("/crm")} />
          )}
        </main>
      </div>
    </div>
  );
}
