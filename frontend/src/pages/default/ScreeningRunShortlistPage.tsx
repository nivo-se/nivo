import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { BackendStatusBanner } from "@/components/BackendStatusBanner";
import {
  downloadScreeningRunShortlistCsv,
  fetchLatestScreeningRun,
  fetchScreeningRunShortlist,
  type ScreeningRunMeta,
  type ScreeningShortlistRow,
  type ScreeningShortlistStats,
} from "@/lib/api/screeningRunShortlist/service";
import { toast } from "@/hooks/use-toast";
import { ChevronDown, Download, Loader2, RefreshCw, Sparkles } from "lucide-react";

const BUCKET_OPTIONS = [
  { value: "__all__", label: "All (high + tavily)" },
  { value: "high_confidence", label: "high_confidence" },
  { value: "tavily_triage", label: "tavily_triage" },
];

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s.trim()
  );
}

function formatRunWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return iso;
  }
}

export default function ScreeningRunShortlistPage() {
  const { runId: runIdParam } = useParams<{ runId?: string }>();
  const navigate = useNavigate();
  const [runIdInput, setRunIdInput] = useState(runIdParam ?? "");
  const [rows, setRows] = useState<ScreeningShortlistRow[]>([]);
  const [loadedRunId, setLoadedRunId] = useState<string | null>(null);
  const [runMeta, setRunMeta] = useState<ScreeningRunMeta | null>(null);
  const [isLatestPersisted, setIsLatestPersisted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bucketFilter, setBucketFilter] = useState("__all__");
  const [minFit, setMinFit] = useState<string>("");
  const [nameQ, setNameQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [noRunsInDb, setNoRunsInDb] = useState(false);
  const [runStats, setRunStats] = useState<ScreeningShortlistStats | null>(null);

  const fetchForRun = useCallback(
    async (id: string, opts?: { pushRoute?: boolean }) => {
      if (!isUuid(id)) {
        toast({ title: "Invalid run id", description: "Paste a screening UUID.", variant: "destructive" });
        return;
      }
      setLoading(true);
      setError(null);
      setNoRunsInDb(false);
      try {
        const minN = minFit.trim() === "" ? undefined : Number(minFit);
        if (minN !== undefined && (Number.isNaN(minN) || minN < 0 || minN > 1)) {
          toast({
            title: "Min fit confidence",
            description: "Use a number between 0 and 1.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        const data = await fetchScreeningRunShortlist(id, {
          confidence_bucket: bucketFilter === "__all__" ? undefined : bucketFilter,
          min_fit_confidence: minN,
          q: nameQ.trim() || undefined,
        });
        setRows(data.rows);
        setLoadedRunId(id);
        setRunMeta(data.run);
        setRunStats(data.stats ?? { fit_true_count_in_run: 0 });
        setIsLatestPersisted(Boolean(data.is_latest_persisted_run));
        setRunIdInput(id);
        if (opts?.pushRoute && runIdParam !== id) {
          navigate(`/screening-shortlist/${id}`, { replace: true });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setRows([]);
        setLoadedRunId(null);
        setRunMeta(null);
        setRunStats(null);
        setIsLatestPersisted(false);
      } finally {
        setLoading(false);
      }
    },
    [bucketFilter, minFit, nameQ, navigate, runIdParam]
  );

  /** Always call the latest fetchForRun from route effects (avoids stale closures). */
  const fetchForRunRef = useRef(fetchForRun);
  fetchForRunRef.current = fetchForRun;

  useEffect(() => {
    if (runIdParam && !isUuid(runIdParam)) {
      setError(`Not a valid screening run id in the URL: ${runIdParam}`);
      setLoading(false);
      setRows([]);
      setLoadedRunId(null);
      setRunMeta(null);
      setRunStats(null);
      return;
    }
    if (runIdParam && isUuid(runIdParam)) {
      setRunIdInput(runIdParam);
      void fetchForRunRef.current(runIdParam, { pushRoute: false });
      return;
    }
    setNoRunsInDb(false);
    setLoading(true);
    setError(null);
    fetchLatestScreeningRun()
      .then((latest) => {
        setRunIdInput(latest.id);
        navigate(`/screening-shortlist/${latest.id}`, { replace: true });
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setRows([]);
        setLoadedRunId(null);
        setRunMeta(null);
        setRunStats(null);
        setIsLatestPersisted(false);
        if (
          msg.includes("404") ||
          msg.toLowerCase().includes("no screening") ||
          msg.toLowerCase().includes("not found")
        ) {
          setNoRunsInDb(true);
        }
        setLoading(false);
      });
  }, [runIdParam, navigate]);

  const applyFilters = () => {
    const id = (runIdParam && isUuid(runIdParam) ? runIdParam : runIdInput).trim();
    void fetchForRun(id, { pushRoute: false });
  };

  const showLatestRun = async () => {
    setLoading(true);
    setError(null);
    try {
      const latest = await fetchLatestScreeningRun();
      setRunIdInput(latest.id);
      navigate(`/screening-shortlist/${latest.id}`, { replace: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast({ title: "Could not load latest run", description: msg, variant: "destructive" });
      setLoading(false);
    }
  };

  const openRunFromInput = () => {
    const id = runIdInput.trim();
    void fetchForRun(id, { pushRoute: true });
  };

  const exportCsv = async () => {
    const id = (loadedRunId ?? runIdInput).trim();
    if (!isUuid(id)) {
      toast({ title: "Load a run first", variant: "destructive" });
      return;
    }
    try {
      const minN = minFit.trim() === "" ? undefined : Number(minFit);
      const blob = await downloadScreeningRunShortlistCsv(id, {
        confidence_bucket: bucketFilter === "__all__" ? undefined : bucketFilter,
        min_fit_confidence: minN,
        q: nameQ.trim() || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `screening_shortlist_${id}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Export failed", description: msg, variant: "destructive" });
    }
  };

  const showTableSkeleton = loading && rows.length === 0 && !noRunsInDb && !error;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto w-full">
      <BackendStatusBanner />

      {loading && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <span>Loading screening data…</span>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Screening shortlist</h1>
          {isLatestPersisted && loadedRunId && (
            <Badge variant="secondary" className="font-normal">
              <Sparkles className="w-3 h-3 mr-1" />
              Latest persisted run
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm max-w-3xl leading-relaxed">
          Companies from a <strong>saved screening run</strong> in Postgres (after Layer 2 +{" "}
          <code className="text-xs bg-muted px-1 rounded">persist_screening_run</code>).           The list is <strong>good fits</strong> with <strong>high-confidence or tavily-triage</strong>{" "}
          retrieval (or values inferred from JSON when{" "}
          <code className="text-xs bg-muted px-1 rounded">confidence_bucket</code> was never written). This
          menu opens the <strong>latest</strong> run by default.
        </p>
      </div>

      {loadedRunId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Run you’re viewing</CardTitle>
            <CardDescription>
              {runMeta ? (
                <>
                  Saved at {formatRunWhen(runMeta.created_at)}
                  {runMeta.run_kind ? (
                    <>
                      {" "}
                      · kind <span className="font-mono text-xs">{runMeta.run_kind}</span>
                    </>
                  ) : null}
                </>
              ) : (
                "Metadata for this run was not returned by the API (backend may need updating)."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground font-mono text-xs break-all">
            {runMeta?.run_id ?? loadedRunId}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const id = (runIdParam && isUuid(runIdParam) ? runIdParam : runIdInput).trim();
            if (isUuid(id)) void fetchForRun(id, { pushRoute: false });
          }}
          disabled={loading || !loadedRunId}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => void showLatestRun()} disabled={loading}>
          Show latest run
        </Button>
        <Button type="button" size="sm" onClick={() => void exportCsv()} disabled={!loadedRunId}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filter this list</CardTitle>
            <CardDescription>Narrow results without changing the saved run.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row gap-4 flex-wrap items-end">
            <div className="space-y-2 w-full md:w-[220px]">
              <Label>Confidence bucket</Label>
              <Select value={bucketFilter} onValueChange={setBucketFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUCKET_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 w-full md:w-[160px]">
              <Label htmlFor="min-fit">Min fit score (0–1)</Label>
              <Input
                id="min-fit"
                type="number"
                step="0.01"
                min={0}
                max={1}
                placeholder="Any"
                value={minFit}
                onChange={(e) => setMinFit(e.target.value)}
              />
            </div>
            <div className="space-y-2 flex-1 min-w-[200px]">
              <Label htmlFor="name-q">Company name contains</Label>
              <Input
                id="name-q"
                placeholder="Type part of a name…"
                value={nameQ}
                onChange={(e) => setNameQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void applyFilters()}
              />
            </div>
            <Button type="button" onClick={() => void applyFilters()} disabled={loading}>
              Apply
            </Button>
          </CardContent>
        </Card>

        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground py-1">
            <ChevronDown className="w-4 h-4" />
            Open a different saved run
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <div className="flex flex-col sm:flex-row gap-3 items-end max-w-xl">
              <div className="space-y-2 flex-1 w-full">
                <Label htmlFor="run-id">Screening run id (UUID)</Label>
                <Input
                  id="run-id"
                  placeholder="Paste a run id from your pipeline manifest"
                  value={runIdInput}
                  onChange={(e) => setRunIdInput(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <Button type="button" variant="secondary" onClick={() => void openRunFromInput()} disabled={loading}>
                Load
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm" role="alert">
          <p className="font-medium text-destructive">Could not load data</p>
          <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{error}</p>
          {noRunsInDb && (
            <p className="mt-3 text-foreground">
              There are no rows in <code className="text-xs bg-muted px-1 rounded">screening_runs</code> yet.
              After you run a screening pipeline, persist it to Postgres so it appears here.
            </p>
          )}
        </div>
      )}

      {loadedRunId && !error && runStats != null && (
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{rows.length}</strong> compan
          {rows.length === 1 ? "y" : "ies"} in this view (after filters). This run has{" "}
          <strong className="text-foreground">{runStats.fit_true_count_in_run}</strong> compan
          {runStats.fit_true_count_in_run === 1 ? "y" : "ies"} marked fit overall.
        </p>
      )}

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Org.nr</TableHead>
              <TableHead className="text-right">Layer 1 rank</TableHead>
              <TableHead className="text-right">Layer 1 score</TableHead>
              <TableHead className="text-right">Fit confidence</TableHead>
              <TableHead>Confidence bucket</TableHead>
              <TableHead>Homepage</TableHead>
              <TableHead>Primary domain</TableHead>
              <TableHead className="min-w-[200px]">Reason (short)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showTableSkeleton &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={9}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!loading && rows.length === 0 && !error && loadedRunId && (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground text-center py-10">
                  <p className="font-medium text-foreground mb-1">No companies in this view</p>
                  {runStats != null && runStats.fit_true_count_in_run === 0 ? (
                    <p>
                      This run has no companies with <strong>good fit</strong> (
                      <code className="text-xs bg-muted px-1">layer2_is_fit_for_nivo</code>) in the database.
                      Check Layer 2 output for this run.
                    </p>
                  ) : (
                    <p>
                      {runStats != null && runStats.fit_true_count_in_run > 0 ? (
                        <>
                          There are <strong>{runStats.fit_true_count_in_run}</strong> fit companies in this run,
                          but none pass the shortlist rule (high / tavily bucket, or inferred high from{" "}
                          <code className="text-xs bg-muted px-1">pages_fetched_count</code> &gt; 0). Try clearing
                          filters, or run{" "}
                          <code className="text-xs bg-muted px-1">layer2_confidence_buckets.py</code> before
                          persist so buckets are stored explicitly.
                        </>
                      ) : (
                        <>
                          Nothing matched the shortlist rules or your filters. Try clearing filters or reloading
                          the run.
                        </>
                      )}
                    </p>
                  )}
                </TableCell>
              </TableRow>
            )}
            {!loading && rows.length === 0 && !error && !loadedRunId && (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground text-center py-10">
                  Load a run above to see companies here.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.orgnr}>
                <TableCell className="font-medium">{r.company_name ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{r.orgnr}</TableCell>
                <TableCell className="text-right">{r.layer1_rank ?? "—"}</TableCell>
                <TableCell className="text-right">
                  {r.layer1_score != null ? r.layer1_score.toFixed(4) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {r.layer2_fit_confidence != null ? r.layer2_fit_confidence.toFixed(3) : "—"}
                </TableCell>
                <TableCell className="text-xs">{r.confidence_bucket || "—"}</TableCell>
                <TableCell className="max-w-[180px] truncate text-xs" title={r.homepage_used}>
                  {r.homepage_used ? (
                    <a
                      href={r.homepage_used.startsWith("http") ? r.homepage_used : `https://${r.homepage_used}`}
                      className="text-primary underline truncate block"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {r.homepage_used}
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-xs font-mono">{r.top_domain || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[320px]">
                  {r.layer2_reason_summary || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        For interactive screening workflows, see{" "}
        <Link to="/screening-campaigns" className="underline text-foreground">
          Screening campaigns
        </Link>
        .
      </p>
    </div>
  );
}
