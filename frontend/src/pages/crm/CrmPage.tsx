import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDebounce } from "@/hooks/useDebounce";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2, Building2, Inbox, AlertTriangle, ListPlus, Plus } from "lucide-react";
import { getAllLists } from "@/lib/api/lists/service";
import type { List } from "@/lib/api/types";
import {
  createContact,
  createExternalCompany,
  ensureDealFromCompany,
  generateBatchEmails,
  getRecentInbound,
  getUnmatchedInbound,
  listCrmCompanies,
  type CrmInboundRecentRow,
  type CrmInboundUnmatchedRow,
  type CrmBatchDraftRow,
} from "@/lib/api/crm";
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

type CrmTab = "companies" | "inbox" | "unmatched" | "batch";

/** CRM: company list, inbox, unmatched, batch from My Lists, workspace per company */
export default function CrmPage() {
  const { companyId } = useParams<{ companyId?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const tabParam = searchParams.get("tab") as CrmTab | null;
  const tabFromUrl: CrmTab =
    tabParam === "inbox" || tabParam === "unmatched" || tabParam === "batch" ? tabParam : "companies";

  /** When a company is open, main panel is always the workspace (ignore ?tab). */
  const tab: CrmTab = companyId ? "companies" : tabFromUrl;

  const navigateToTab = (next: CrmTab) => {
    if (next === "companies") {
      navigate(companyId ? `/crm/company/${companyId}` : "/crm");
    } else {
      navigate(`/crm?tab=${next}`);
    }
  };

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [companies, setCompanies] = useState<CrmCompany[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [inboxRows, setInboxRows] = useState<CrmInboundRecentRow[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [unmatchedRows, setUnmatchedRows] = useState<CrmInboundUnmatchedRow[]>([]);
  const [loadingUnmatched, setLoadingUnmatched] = useState(false);

  const [savedLists, setSavedLists] = useState<List[]>([]);
  const [batchListId, setBatchListId] = useState<string>("");
  const [batchInstructions, setBatchInstructions] = useState("");
  const [batchReason, setBatchReason] = useState("");
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchDrafts, setBatchDrafts] = useState<CrmBatchDraftRow[]>([]);
  const [batchSkipped, setBatchSkipped] = useState<{ orgnr?: string; company_id?: string; reason: string }[]>(
    []
  );

  const [externalOpen, setExternalOpen] = useState(false);
  const [extName, setExtName] = useState("");
  const [extEmail, setExtEmail] = useState("");
  const [extOrgnr, setExtOrgnr] = useState("");
  const [extWebsite, setExtWebsite] = useState("");
  const [extBusy, setExtBusy] = useState(false);

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

  useEffect(() => {
    getAllLists()
      .then((lists) => {
        setSavedLists(lists);
        if (lists.length) {
          setBatchListId((prev) => prev || lists[0].id);
        }
      })
      .catch(() => setSavedLists([]));
  }, []);

  useEffect(() => {
    if (tab !== "inbox") return;
    setLoadingInbox(true);
    getRecentInbound(80)
      .then(setInboxRows)
      .catch(() => {
        setInboxRows([]);
        toast({ title: "Could not load inbox", variant: "destructive" });
      })
      .finally(() => setLoadingInbox(false));
  }, [tab, toast]);

  useEffect(() => {
    if (tab !== "unmatched") return;
    setLoadingUnmatched(true);
    getUnmatchedInbound(80)
      .then(setUnmatchedRows)
      .catch(() => {
        setUnmatchedRows([]);
        toast({ title: "Could not load unmatched mail", variant: "destructive" });
      })
      .finally(() => setLoadingUnmatched(false));
  }, [tab, toast]);

  const showDetail = !!companyId;

  const handleBatchGenerate = async () => {
    if (!batchListId) {
      toast({ title: "Select a My List", variant: "destructive" });
      return;
    }
    setBatchBusy(true);
    setBatchDrafts([]);
    setBatchSkipped([]);
    try {
      const data = await generateBatchEmails({
        list_id: batchListId,
        user_instructions: batchInstructions.trim() || undefined,
        reason_for_interest: batchReason.trim() || undefined,
      });
      setBatchDrafts(data.drafts);
      setBatchSkipped(data.skipped);
      toast({
        title: `Generated ${data.drafts.length} draft(s)`,
        description:
          data.skipped.length > 0 ? `${data.skipped.length} skipped (see table)` : undefined,
      });
    } catch (e) {
      toast({
        title: "Batch generate failed",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive",
      });
    } finally {
      setBatchBusy(false);
    }
  };

  const handleExternalSubmit = async () => {
    const name = extName.trim();
    const email = extEmail.trim();
    if (!name || !email) {
      toast({ title: "Name and contact email are required", variant: "destructive" });
      return;
    }
    setExtBusy(true);
    try {
      const company = await createExternalCompany({
        name,
        orgnr: extOrgnr.trim() || undefined,
        website: extWebsite.trim() || undefined,
      });
      const cid = String((company as { id?: string }).id ?? "");
      if (!cid) throw new Error("No company id returned");
      await ensureDealFromCompany(cid);
      await createContact({
        company_id: cid,
        email,
        is_primary: true,
      });
      toast({ title: "Company and contact added" });
      setExternalOpen(false);
      setExtName("");
      setExtEmail("");
      setExtOrgnr("");
      setExtWebsite("");
      navigate(`/crm/company/${cid}`);
    } catch (e) {
      toast({
        title: "Could not add company",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive",
      });
    } finally {
      setExtBusy(false);
    }
  };

  return (
    <div className="h-full overflow-hidden app-bg flex flex-col">
      <div className="shrink-0 border-b border-sidebar-border bg-sidebar-bg px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold text-foreground">Origination CRM</h1>
          <p className="text-xs text-muted-foreground">Outreach, replies, and My List batch drafts.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={tab} onValueChange={(v) => navigateToTab(v as CrmTab)}>
            <TabsList className="h-9">
              <TabsTrigger value="companies" className="text-xs gap-1">
                <Building2 className="h-3.5 w-3.5" />
                Companies
              </TabsTrigger>
              <TabsTrigger value="inbox" className="text-xs gap-1">
                <Inbox className="h-3.5 w-3.5" />
                Inbox
              </TabsTrigger>
              <TabsTrigger value="unmatched" className="text-xs gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Unmatched
              </TabsTrigger>
              <TabsTrigger value="batch" className="text-xs gap-1">
                <ListPlus className="h-3.5 w-3.5" />
                From My List
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setExternalOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            External company
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <aside className="w-full lg:w-72 shrink-0 border-r border-sidebar-border flex flex-col bg-sidebar-bg shadow-[4px_0_24px_-12px_hsl(var(--primary)/0.12)]">
          <div className="p-4 border-b border-sidebar-border/80 shrink-0">
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
                No companies found. Add via Deep Research or External company.
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

        <main className="flex-1 min-w-0 overflow-auto p-4">
          {tab === "inbox" && (
            <div className="max-w-4xl space-y-3">
              <h2 className="text-sm font-medium">Recent inbound replies</h2>
              {loadingInbox ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : inboxRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No inbound messages yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Company</TableHead>
                      <TableHead className="text-xs">Subject</TableHead>
                      <TableHead className="text-xs">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inboxRows.map((row) => (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/crm/company/${row.company_id}`)}
                      >
                        <TableCell className="text-sm">{row.company_name ?? "—"}</TableCell>
                        <TableCell className="text-sm max-w-[240px] truncate" title={row.subject ?? ""}>
                          {row.subject ?? "(no subject)"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateTime(row.received_at || row.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}

          {tab === "unmatched" && (
            <div className="max-w-4xl space-y-3">
              <h2 className="text-sm font-medium">Unmatched inbound (no thread token)</h2>
              <p className="text-xs text-muted-foreground">
                See <code className="bg-muted px-1 rounded">docs/email_inbound_resend.md</code> for Reply-To
                setup.
              </p>
              {loadingUnmatched ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : unmatchedRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No unmatched messages.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">From</TableHead>
                      <TableHead className="text-xs">Subject</TableHead>
                      <TableHead className="text-xs">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unmatchedRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm">{row.from_email ?? "—"}</TableCell>
                        <TableCell className="text-sm max-w-[260px] truncate">{row.subject ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateTime(row.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}

          {tab === "batch" && (
            <div className="max-w-3xl space-y-4">
              <h2 className="text-sm font-medium">Generate drafts from My List</h2>
              <p className="text-xs text-muted-foreground">
                One AI draft per company in the list. Companies need a contact; skipped rows are listed below.
              </p>
              <div className="space-y-2 max-w-md">
                <Label className="text-xs">My List</Label>
                <Select value={batchListId} onValueChange={setBatchListId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a list" />
                  </SelectTrigger>
                  <SelectContent>
                    {savedLists.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Instructions (optional)</Label>
                <Textarea
                  rows={3}
                  value={batchInstructions}
                  onChange={(e) => setBatchInstructions(e.target.value)}
                  placeholder="Applied to every draft in the batch"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reason for interest (optional)</Label>
                <Input value={batchReason} onChange={(e) => setBatchReason(e.target.value)} />
              </div>
              <Button type="button" variant="primary" onClick={() => void handleBatchGenerate()} disabled={batchBusy}>
                {batchBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate drafts"}
              </Button>

              {batchDrafts.length > 0 && (
                <div className="space-y-2 pt-4 border-t border-border">
                  <p className="text-xs font-medium">Drafts</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Company</TableHead>
                        <TableHead className="text-xs">Subject</TableHead>
                        <TableHead className="text-xs">Open</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batchDrafts.map((d) => (
                        <TableRow key={d.email_id}>
                          <TableCell className="text-sm">{d.company_name ?? d.orgnr}</TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">{d.subject}</TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7"
                              onClick={() => navigate(`/crm/company/${d.company_id}`)}
                            >
                              Review
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {batchSkipped.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Skipped</p>
                  <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                    {batchSkipped.map((s, i) => (
                      <li key={i}>
                        {s.orgnr ?? s.company_id ?? "?"} — {s.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {tab === "companies" && !showDetail && (
            <div className="flex items-center justify-center h-full min-h-[200px] text-muted-foreground text-sm p-8">
              Select a company to manage contacts, drafts, and sends — or use Inbox / From My List tabs.
            </div>
          )}

          {tab === "companies" && showDetail && (
            <CrmWorkspace companyIdParam={companyId!} onBack={() => navigate("/crm")} />
          )}
        </main>
      </div>

      <Dialog open={externalOpen} onOpenChange={setExternalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add external company</DialogTitle>
            <DialogDescription>
              Create a CRM record and primary contact for a prospect not yet synced from Universe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="ext-name">Company name</Label>
              <Input id="ext-name" value={extName} onChange={(e) => setExtName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ext-email">Contact email</Label>
              <Input
                id="ext-email"
                type="email"
                value={extEmail}
                onChange={(e) => setExtEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ext-orgnr">Org number (optional)</Label>
              <Input id="ext-orgnr" value={extOrgnr} onChange={(e) => setExtOrgnr(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ext-web">Website (optional)</Label>
              <Input id="ext-web" value={extWebsite} onChange={(e) => setExtWebsite(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setExternalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={() => void handleExternalSubmit()} disabled={extBusy}>
              {extBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create & open"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
