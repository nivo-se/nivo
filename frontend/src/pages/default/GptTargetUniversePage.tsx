import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { COMPANY_PROFILE_BACK } from "@/lib/navigation/companyProfileBack";
import { ChatgptDeepResearchPromptDialog } from "@/components/default/ChatgptDeepResearchPromptDialog";
import { buildChatgptDeepResearchPrompt } from "@/lib/prompts/chatgptDeepResearchPromptFromGptTargetRow";
import { useQuery } from "@tanstack/react-query";
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
import { Checkbox } from "@/components/ui/checkbox";
import { BackendStatusBanner } from "@/components/BackendStatusBanner";
import { AddToListDropdown } from "@/components/default/AddToListDropdown";
import {
  fetchGptTargetUniverseCompanies,
  fetchGptTargetUniverseMeta,
  fetchGptTargetUniverseRuns,
  type GptTargetCompanyRow,
  type GptTargetUniverseMeta,
} from "@/lib/api/gptTargetUniverse/service";
import { formatSwedishOrgnrForUrl } from "@/lib/api/companies/service";
import {
  ChevronDown,
  ExternalLink,
  ClipboardCopy,
  Loader2,
  RefreshCw,
  ArrowUpDown,
} from "lucide-react";

type FitFilter = "__all__" | "fit" | "not_fit";

/** Match API has_triage: all rows vs only triaged vs only pending triage */
type TriageFilter = "__all__" | "with_triage" | "without_triage";

type SortKey =
  | "default"
  | "company_name"
  | "rank"
  | "fit_confidence"
  | "blended_score";

function metaHints(m: GptTargetUniverseMeta): string[] {
  const out: string[] = [];
  if (!m.database_source_postgres) {
    out.push("API DATABASE_SOURCE must be postgres for this page.");
  }
  if (m.run_id_resolution === "none") {
    out.push(
      "No cohort available: ingest website-research rows, pick a run above, or set a valid GPT_TARGET_UNIVERSE_RUN_ID in the API .env.",
    );
  }
  if (m.run_id_parse_error) {
    out.push(m.run_id_parse_error);
  }
  if (m.table_check_error) {
    out.push(`Could not check DB table: ${m.table_check_error}`);
  } else if (!m.table_screening_website_research_companies) {
    out.push(
      "Table screening_website_research_companies is missing — run Postgres migrations (see scripts/run_postgres_migrations.sh).",
    );
  }
  if (m.row_count_error) {
    out.push(`Row count query failed: ${m.row_count_error}`);
  } else if (
    m.database_source_postgres &&
    m.table_screening_website_research_companies &&
    m.run_id &&
    m.row_count === 0
  ) {
    out.push(
      "There are 0 rows for this run_id in screening_website_research_companies — confirm the UUID matches screening_runs.id and that ingest has written rows.",
    );
  }
  return out;
}

function sortRows(rows: GptTargetCompanyRow[], key: SortKey, dir: "asc" | "desc"): GptTargetCompanyRow[] {
  const mul = dir === "asc" ? 1 : -1;
  const out = [...rows];
  const num = (n: number | null | undefined) => (n == null ? (dir === "asc" ? Infinity : -Infinity) : n);
  const str = (s: string | null | undefined) => (s ?? "").toLowerCase();

  out.sort((a, b) => {
    if (key === "default") return 0;
    if (key === "company_name") return mul * str(a.company_name).localeCompare(str(b.company_name));
    if (key === "rank") return mul * (num(a.rank) - num(b.rank));
    if (key === "fit_confidence") return mul * (num(a.fit_confidence) - num(b.fit_confidence));
    if (key === "blended_score") return mul * (num(a.blended_score) - num(b.blended_score));
    return 0;
  });
  return out;
}

const DEFAULT_COHORT = "__default__";

export default function GptTargetUniversePage() {
  const [promptModalRow, setPromptModalRow] = useState<GptTargetCompanyRow | null>(null);
  /** Server picks query param > env GPT_TARGET_UNIVERSE_RUN_ID > newest run with data. */
  const [cohortRunId, setCohortRunId] = useState<string>(DEFAULT_COHORT);
  const [qInput, setQInput] = useState("");
  const [qApplied, setQApplied] = useState("");
  const [fitFilter, setFitFilter] = useState<FitFilter>("__all__");
  const [triageFilter, setTriageFilter] = useState<TriageFilter>("__all__");
  const [minFitInput, setMinFitInput] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const minFitN = minFitInput.trim() === "" ? undefined : Number(minFitInput);
  const minFitValid =
    minFitN === undefined || (!Number.isNaN(minFitN) && minFitN >= 0 && minFitN <= 1);

  const runIdForApi = cohortRunId === DEFAULT_COHORT ? undefined : cohortRunId;

  const queryOpts = useMemo(() => {
    const has_triage =
      triageFilter === "with_triage" ? true : triageFilter === "without_triage" ? false : undefined;
    return {
      run_id: runIdForApi,
      q: qApplied.trim() || undefined,
      fit: fitFilter === "fit" ? true : fitFilter === "not_fit" ? false : undefined,
      has_triage,
      min_fit_confidence: minFitValid ? minFitN : undefined,
    };
  }, [runIdForApi, qApplied, fitFilter, triageFilter, minFitN, minFitValid]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["gpt-target-universe", queryOpts],
    queryFn: () => fetchGptTargetUniverseCompanies(queryOpts),
    enabled: minFitValid,
  });

  const {
    data: meta,
    error: metaError,
    refetch: refetchMeta,
  } = useQuery({
    queryKey: ["gpt-target-universe-meta", runIdForApi ?? DEFAULT_COHORT],
    queryFn: () => fetchGptTargetUniverseMeta(runIdForApi),
    staleTime: 30_000,
  });

  const { data: runOptions = [], refetch: refetchRuns } = useQuery({
    queryKey: ["gpt-target-universe-runs"],
    queryFn: fetchGptTargetUniverseRuns,
    staleTime: 60_000,
  });

  const displayRows = useMemo(() => {
    const base = data?.rows ?? [];
    if (sortKey === "default") return base;
    return sortRows(base, sortKey, sortDir);
  }, [data?.rows, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === "default") {
      setSortKey("default");
      return;
    }
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "company_name" ? "asc" : "desc");
    }
  };

  const toggleSelected = (orgnr: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orgnr)) next.delete(orgnr);
      else next.add(orgnr);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelected(new Set(displayRows.map((r) => r.orgnr)));
  };

  const clearSelection = () => setSelected(new Set());

  const toggleExpanded = (orgnr: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(orgnr)) next.delete(orgnr);
      else next.add(orgnr);
      return next;
    });
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if (minFitValid) setQApplied(qInput);
    }, 350);
    return () => clearTimeout(t);
  }, [qInput, minFitValid]);

  useEffect(() => {
    setSelected(new Set());
    setExpanded(new Set());
  }, [cohortRunId]);

  const selectedOrgnrs = useMemo(() => Array.from(selected), [selected]);
  const errMsg = error instanceof Error ? error.message : error ? String(error) : null;
  const metaErrMsg = metaError instanceof Error ? metaError.message : metaError ? String(metaError) : null;
  const metaIssues = meta ? metaHints(meta) : [];
  const showMetaPanel =
    Boolean(meta && (errMsg || (!isLoading && data?.total === 0))) || Boolean(metaErrMsg);

  return (
    <div className="app-page min-h-full">
    <div className="container max-w-[1400px] px-3 py-4 sm:px-4 sm:py-6 md:px-6 space-y-6">
      <BackendStatusBanner />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">GPT target universe</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cohort from <code className="text-xs bg-muted px-1 rounded">screening_website_research_companies</code>.
            Default run: optional <code className="text-xs bg-muted px-1 rounded">GPT_TARGET_UNIVERSE_RUN_ID</code> in the API env, otherwise the{" "}
            <strong className="font-medium">newest screening run that already has website-research rows</strong>. Override with the cohort control below.
            {data?.run_id ? (
              <span className="block font-mono text-xs mt-1 text-muted-foreground/80">
                Active run_id {data.run_id}
              </span>
            ) : null}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          onClick={() => {
            void refetch();
            void refetchMeta();
            void refetchRuns();
          }}
          disabled={isFetching}
        >
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>
            Search updates after a short pause. Other filters refetch immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
          <div className="space-y-2 w-full min-w-[240px] md:flex-[2]">
            <Label htmlFor="gtu-cohort">Screening cohort (run)</Label>
            <Select
              value={cohortRunId}
              onValueChange={(v) => setCohortRunId(v)}
            >
              <SelectTrigger id="gtu-cohort" className="w-full">
                <SelectValue placeholder="Default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT_COHORT}>Default (API env or latest run with data)</SelectItem>
                {runOptions.map((r) => (
                  <SelectItem key={r.run_id} value={r.run_id}>
                    {r.run_kind || "run"} · {r.row_count} rows ·{" "}
                    {new Date(r.created_at).toLocaleString(undefined, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 flex-1 min-w-[200px]">
            <Label htmlFor="gtu-q">Search name or org.nr</Label>
            <Input
              id="gtu-q"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Substring… (updates after a short pause)"
            />
          </div>
          <div className="space-y-2 w-full md:w-[200px]">
            <Label>LLM triage</Label>
            <Select value={triageFilter} onValueChange={(v) => setTriageFilter(v as TriageFilter)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All rows</SelectItem>
                <SelectItem value="with_triage">With triage only</SelectItem>
                <SelectItem value="without_triage">Pending triage</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 w-full md:w-[180px]">
            <Label>Nivo fit</Label>
            <Select value={fitFilter} onValueChange={(v) => setFitFilter(v as FitFilter)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All</SelectItem>
                <SelectItem value="fit">Fit</SelectItem>
                <SelectItem value="not_fit">Not fit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 w-full md:w-[140px]">
            <Label htmlFor="gtu-min">Min fit conf.</Label>
            <Input
              id="gtu-min"
              value={minFitInput}
              onChange={(e) => setMinFitInput(e.target.value)}
              placeholder="0–1"
            />
          </div>
        </CardContent>
      </Card>

      {!minFitValid ? (
        <p className="text-sm text-destructive">Min fit confidence must be between 0 and 1.</p>
      ) : null}

      {errMsg ? (
        <Card className="border-destructive/50">
          <CardContent className="pt-6 text-sm text-destructive">{errMsg}</CardContent>
        </Card>
      ) : null}

      {showMetaPanel ? (
        <Card className={metaIssues.length || metaErrMsg ? "border-amber-500/40" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Diagnostics</CardTitle>
            <CardDescription>
              <code className="text-xs bg-muted px-1 rounded">GET /api/gpt-target-universe/meta</code> — same authentication as the companies list (401 here usually means the same token problem as the table request).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {metaErrMsg ? (
              <p className="text-destructive">{metaErrMsg}</p>
            ) : meta ? (
              <>
                <ul className="list-none space-y-1 text-muted-foreground font-mono text-xs break-all">
                  <li>DATABASE_SOURCE=postgres: {String(meta.database_source_postgres)}</li>
                  <li>GPT_TARGET_UNIVERSE_RUN_ID set: {String(meta.env_run_id_set)}</li>
                  {meta.run_id_resolution ? <li>run_id_resolution: {meta.run_id_resolution}</li> : null}
                  {meta.run_id ? <li>effective run_id: {meta.run_id}</li> : null}
                  <li>table screening_website_research_companies: {String(meta.table_screening_website_research_companies)}</li>
                  {meta.row_count != null ? <li>row_count for run_id: {meta.row_count}</li> : null}
                </ul>
                {metaIssues.length > 0 ? (
                  <ul className="list-disc pl-5 space-y-1 text-amber-900 dark:text-amber-200/90">
                    {metaIssues.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No obvious configuration issues reported.</p>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3">
          <div>
            <CardTitle className="text-base">Companies</CardTitle>
            <CardDescription>
              {isLoading ? "Loading…" : `${data?.total ?? 0} rows`}
              {selectedOrgnrs.length > 0 ? ` · ${selectedOrgnrs.length} selected` : null}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={selectAllVisible} disabled={!displayRows.length}>
              Select visible
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={clearSelection} disabled={!selectedOrgnrs.length}>
              Clear selection
            </Button>
            <AddToListDropdown orgnrs={selectedOrgnrs} size="sm" variant="outline" />
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          {isLoading ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div
              className="overflow-hidden rounded-md border border-border/80"
              role="region"
              aria-label="GPT target universe companies"
            >
              <Table className="w-full min-w-[860px] table-auto">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8 max-w-8 px-1.5 text-center">
                      <span className="sr-only">Select</span>
                    </TableHead>
                    <TableHead className="w-9 max-w-9 px-1 text-center">
                      <span className="sr-only">Expand</span>
                    </TableHead>
                    <TableHead className="w-11 max-w-11 px-1.5 whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-0.5 px-1 text-xs"
                        onClick={() => toggleSort("rank")}
                        aria-label="Sort by rank"
                      >
                        #
                        <ArrowUpDown className="h-3 w-3 shrink-0" />
                      </Button>
                    </TableHead>
                    <TableHead className="min-w-[12rem] max-w-[16rem]">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-2 h-8 gap-1"
                        onClick={() => toggleSort("company_name")}
                      >
                        Company
                        <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="whitespace-nowrap">Fit</TableHead>
                    <TableHead className="whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-2 h-8 gap-1"
                        onClick={() => toggleSort("fit_confidence")}
                      >
                        Conf.
                        <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-2 h-8 gap-1"
                        onClick={() => toggleSort("blended_score")}
                      >
                        Blended
                        <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="min-w-[min(100%,28rem)] text-left">
                      <span className="text-foreground">Fit summary</span>
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        ChatGPT prompt & links
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                        No rows for this cohort or filters. Try another screening run, clear filters, or confirm ingest wrote{" "}
                        <code className="text-xs bg-muted px-1 rounded">screening_website_research_companies</code>.
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayRows.map((row) => {
                      const open = expanded.has(row.orgnr);
                      const reason = row.reason_summary ?? "";
                      return (
                        <Fragment key={row.orgnr}>
                          <TableRow>
                            <TableCell className="w-8 max-w-8 px-1.5 py-3 [&:has([role=checkbox])]:pr-0">
                              <Checkbox
                                checked={selected.has(row.orgnr)}
                                onCheckedChange={() => toggleSelected(row.orgnr)}
                                aria-label={`Select ${row.company_name ?? row.orgnr}`}
                              />
                            </TableCell>
                            <TableCell className="w-9 max-w-9 px-1 py-3 text-center">
                              {row.triage ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  aria-expanded={open}
                                  aria-label={open ? "Hide triage JSON" : "Show triage JSON"}
                                  onClick={() => toggleExpanded(row.orgnr)}
                                >
                                  <ChevronDown
                                    className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
                                  />
                                </Button>
                              ) : null}
                            </TableCell>
                            <TableCell className="w-11 max-w-11 px-1.5 py-3 text-right text-muted-foreground tabular-nums">
                              {row.rank ?? "—"}
                            </TableCell>
                            <TableCell className="max-w-[16rem] align-top">
                              <div className="flex min-w-0 flex-col gap-0.5">
                                <Link
                                  to={`/company/${encodeURIComponent(formatSwedishOrgnrForUrl(row.orgnr))}`}
                                  state={COMPANY_PROFILE_BACK.gptTargetUniverse}
                                  className="inline-flex min-w-0 max-w-full items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                  title={row.company_name ?? undefined}
                                >
                                  <span className="truncate">{row.company_name ?? "—"}</span>
                                  <ExternalLink
                                    className="h-3 w-3 shrink-0 text-muted-foreground"
                                    aria-hidden
                                  />
                                </Link>
                                <span
                                  className="truncate font-mono text-[11px] leading-tight text-muted-foreground tabular-nums"
                                  title={`Org.nr ${row.orgnr}`}
                                >
                                  {row.orgnr}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {row.is_fit_for_nivo == null ? (
                                "—"
                              ) : row.is_fit_for_nivo ? (
                                <Badge variant="outline" className="border-foreground/25 text-foreground">
                                  Fit
                                </Badge>
                              ) : (
                                <Badge variant="secondary">No</Badge>
                              )}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {row.fit_confidence != null ? row.fit_confidence.toFixed(2) : "—"}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {row.blended_score != null ? row.blended_score.toFixed(2) : "—"}
                            </TableCell>
                            <TableCell className="align-top">
                              <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:gap-5">
                                <div
                                  className="min-h-[3rem] min-w-0 flex-1 max-h-56 overflow-y-auto rounded-md border border-border/50 bg-muted/20 px-3 py-2.5 text-sm leading-relaxed text-muted-foreground"
                                  title={reason.length > 280 ? reason : undefined}
                                >
                                  {reason || "—"}
                                </div>
                                <div className="flex shrink-0 flex-row flex-wrap items-center gap-2 lg:w-[11rem] lg:flex-col lg:items-stretch">
                                  {row.gpt_official_website_url ? (
                                    <Button variant="outline" size="sm" className="h-9 w-full gap-2" asChild>
                                      <a
                                        href={row.gpt_official_website_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                        Website
                                      </a>
                                    </Button>
                                  ) : null}
                                  <Button
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                    className="h-9 w-full gap-2"
                                    title="Open a ready-to-paste prompt for ChatGPT Deep Research"
                                    onClick={() => setPromptModalRow(row)}
                                  >
                                    <ClipboardCopy className="h-3.5 w-3.5 shrink-0" />
                                    ChatGPT prompt
                                  </Button>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                          {row.triage && open ? (
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableCell colSpan={8} className="p-4">
                                <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                                  {JSON.stringify(row.triage, null, 2)}
                                </pre>
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ChatgptDeepResearchPromptDialog
        open={!!promptModalRow}
        onOpenChange={(open) => {
          if (!open) setPromptModalRow(null);
        }}
        prompt={promptModalRow ? buildChatgptDeepResearchPrompt(promptModalRow) : ""}
        companyLabel={
          promptModalRow
            ? `${promptModalRow.company_name?.trim() || "Company"} (${promptModalRow.orgnr})`
            : ""
        }
      />
    </div>
    </div>
  );
}
