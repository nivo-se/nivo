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
  type GptTargetCompanyRow,
} from "@/lib/api/gptTargetUniverse/service";
import {
  ChevronDown,
  ExternalLink,
  ClipboardCopy,
  Loader2,
  RefreshCw,
  ArrowUpDown,
} from "lucide-react";

type FitFilter = "__all__" | "fit" | "not_fit";

type SortKey =
  | "default"
  | "company_name"
  | "rank"
  | "fit_confidence"
  | "blended_score";

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

export default function GptTargetUniversePage() {
  const [promptModalRow, setPromptModalRow] = useState<GptTargetCompanyRow | null>(null);
  const [qInput, setQInput] = useState("");
  const [qApplied, setQApplied] = useState("");
  const [fitFilter, setFitFilter] = useState<FitFilter>("__all__");
  const [minFitInput, setMinFitInput] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const minFitN = minFitInput.trim() === "" ? undefined : Number(minFitInput);
  const minFitValid =
    minFitN === undefined || (!Number.isNaN(minFitN) && minFitN >= 0 && minFitN <= 1);

  const queryOpts = useMemo(
    () => ({
      q: qApplied.trim() || undefined,
      fit: fitFilter === "fit" ? true : fitFilter === "not_fit" ? false : undefined,
      has_triage: true,
      min_fit_confidence: minFitValid ? minFitN : undefined,
    }),
    [qApplied, fitFilter, minFitN, minFitValid]
  );

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["gpt-target-universe", queryOpts],
    queryFn: () => fetchGptTargetUniverseCompanies(queryOpts),
    enabled: minFitValid,
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

  const selectedOrgnrs = useMemo(() => Array.from(selected), [selected]);
  const errMsg = error instanceof Error ? error.message : error ? String(error) : null;

  return (
    <div className="app-page min-h-full">
    <div className="container max-w-[1400px] py-6 space-y-6">
      <BackendStatusBanner />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">GPT target universe</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Companies with LLM triage only (website research + Layer 2). Filter, sort, add to lists, or copy a ChatGPT Deep Research prompt per row.
            {data?.run_id ? (
              <span className="block font-mono text-xs mt-1 text-muted-foreground/80">
                run_id {data.run_id}
              </span>
            ) : null}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          onClick={() => refetch()}
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
          <div className="space-y-2 flex-1 min-w-[200px]">
            <Label htmlFor="gtu-q">Search name or org.nr</Label>
            <Input
              id="gtu-q"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Substring… (updates after a short pause)"
            />
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
              className="min-w-0 max-w-full overflow-x-auto rounded-md border [&_th]:h-10 [&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-2"
              role="region"
              aria-label="GPT target universe companies"
            >
              <Table className="w-full min-w-[1080px] table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <span className="sr-only">Select</span>
                    </TableHead>
                    <TableHead className="w-10">
                      <span className="sr-only">Expand</span>
                    </TableHead>
                    <TableHead className="w-14">
                      <Button variant="ghost" size="sm" className="-ml-2 h-8 gap-1" onClick={() => toggleSort("rank")}>
                        Rank
                        <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="min-w-[14rem] w-[22%]">
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
                    <TableHead>Fit</TableHead>
                    <TableHead>
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
                    <TableHead>
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
                    <TableHead className="w-[40%] min-w-[24rem] text-left">Reason</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                        No rows. Adjust filters or set{" "}
                        <code className="text-xs bg-muted px-1 rounded">GPT_TARGET_UNIVERSE_RUN_ID</code> on the API.
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayRows.map((row) => {
                      const open = expanded.has(row.orgnr);
                      const reason = row.reason_summary ?? "";
                      return (
                        <Fragment key={row.orgnr}>
                          <TableRow>
                            <TableCell>
                              <Checkbox
                                checked={selected.has(row.orgnr)}
                                onCheckedChange={() => toggleSelected(row.orgnr)}
                                aria-label={`Select ${row.company_name ?? row.orgnr}`}
                              />
                            </TableCell>
                            <TableCell>
                              {row.triage ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  aria-expanded={open}
                                  aria-label={open ? "Hide triage JSON" : "Show triage JSON"}
                                  onClick={() => toggleExpanded(row.orgnr)}
                                >
                                  <ChevronDown
                                    className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                                  />
                                </Button>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-muted-foreground tabular-nums">{row.rank ?? "—"}</TableCell>
                            <TableCell className="max-w-0 min-w-[14rem] w-[22%] align-top">
                              <div className="flex min-w-0 flex-col gap-0.5">
                                <Link
                                  to={`/company/${encodeURIComponent(row.orgnr)}`}
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
                            <TableCell className="w-[40%] min-w-[24rem] align-top text-sm text-muted-foreground">
                              <p
                                className="line-clamp-5 whitespace-normal break-words leading-snug"
                                title={reason.length > 160 ? reason : undefined}
                              >
                                {reason || "—"}
                              </p>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1 flex-wrap">
                                {row.gpt_official_website_url ? (
                                  <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                    <a
                                      href={row.gpt_official_website_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="Open website"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </a>
                                  </Button>
                                ) : null}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="gap-1"
                                  title="Open a ready-to-paste prompt for ChatGPT Deep Research"
                                  onClick={() => setPromptModalRow(row)}
                                >
                                  <ClipboardCopy className="h-3.5 w-3.5" />
                                  ChatGPT prompt
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {row.triage && open ? (
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableCell colSpan={9} className="p-4">
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
