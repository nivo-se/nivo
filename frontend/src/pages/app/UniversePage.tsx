import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import {
  getUniverseFilters,
  queryUniverse,
  type FilterItem,
  type UniverseRow,
} from "@/lib/services/universeQueryService";
import {
  getUniverseStateFromUrl,
  buildUniverseSearchParams,
} from "@/lib/universeUrlState";
import { useDebounce } from "@/hooks/useDebounce";
import { getViews, createView, updateView } from "@/lib/services/viewsService";
import { createList, addListItems, createListFromQuery } from "@/lib/services/listsService";
import { universeService } from "@/lib/services/universeService";
import type { SavedView } from "@/lib/services/viewsService";
import { FilterRows, rowsToFilters, type FilterRowState } from "@/components/filters/FilterRows";
import { QueryBar } from "@/components/filters/QueryBar";
import { LibrarySidebar } from "@/components/library";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

type SortColumn =
  | "data_quality_score"
  | "revenue_latest"
  | "ebitda_margin_latest"
  | "revenue_cagr_3y"
  | "employees_latest"
  | "last_enriched_at";

const LIMIT = 50;

const DEFAULT_SORT: { by: SortColumn; dir: "asc" | "desc" } = {
  by: "data_quality_score",
  dir: "asc",
};

const PRESETS = [
  {
    id: "websites_present_ai_missing",
    label: "Websites present, AI missing",
    filters: [
      { field: "has_homepage", op: "=", value: true, type: "boolean" as const },
      { field: "has_ai_profile", op: "=", value: false, type: "boolean" as const },
    ],
    sort: { by: "data_quality_score" as const, dir: "asc" as const },
  },
  {
    id: "coverage_gaps",
    label: "Coverage gaps",
    filters: [{ field: "has_ai_profile", op: "=", value: false, type: "boolean" as const }],
    sort: { by: "data_quality_score" as const, dir: "asc" as const },
  },
  {
    id: "profitable_growers",
    label: "Profitable growers",
    filters: [
      { field: "ebitda_margin_latest", op: ">=", value: 0.08, type: "percent" as const },
      { field: "revenue_cagr_3y", op: ">=", value: 0.05, type: "percent" as const },
    ],
    sort: { by: "revenue_cagr_3y" as const, dir: "desc" as const },
  },
  {
    id: "large_profitable",
    label: "Large profitable",
    filters: [
      { field: "revenue_latest", op: ">=", value: 100_000_000, type: "number" as const },
      { field: "ebitda_margin_latest", op: ">=", value: 0.1, type: "percent" as const },
    ],
    sort: { by: "revenue_latest" as const, dir: "desc" as const },
  },
];

export function UniversePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const hasHydratedRef = useRef(false);

  const [filterRows, setFilterRows] = useState<FilterRowState[]>([{}]);
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<SortColumn>(DEFAULT_SORT.by);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(DEFAULT_SORT.dir);
  const [offset, setOffset] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const [selectedViewId, setSelectedViewId] = useState<string | null>(null);
  /** Snapshot of view state when selected, for "Modified" detection */
  const [viewSnapshot, setViewSnapshot] = useState<{
    filters: FilterItem[];
    q: string;
    sort: { by: SortColumn; dir: "asc" | "desc" };
  } | null>(null);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [createListOpen, setCreateListOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState("");
  const [createListName, setCreateListName] = useState("");
  const [createListScope, setCreateListScope] = useState<"current" | "all">("current");
  const [createListLoading, setCreateListLoading] = useState(false);

  const debouncedQ = useDebounce(q, 400);
  const filters = useMemo(() => rowsToFilters(filterRows), [filterRows]);
  const debouncedFilters = useDebounce(filters, 350);

  useEffect(() => {
    if (hasHydratedRef.current) return;
    hasHydratedRef.current = true;
    const parsed = getUniverseStateFromUrl(searchParams);
    if (parsed) {
      if (Array.isArray(parsed.filters) && parsed.filters.length > 0) {
        setFilterRows(parsed.filters.map((f) => ({ ...f })));
      }
      if (parsed.q != null) setQ(parsed.q);
      if (parsed.sort?.by) setSortBy(parsed.sort.by as SortColumn);
      if (parsed.sort?.dir) setSortDir(parsed.sort.dir);
      if (typeof parsed.offset === "number") setOffset(parsed.offset);
      if (parsed.preset !== undefined) setSelectedPreset(parsed.preset);
    }
  }, [searchParams]);

  useEffect(() => {
    const params = buildUniverseSearchParams({
      q: debouncedQ || undefined,
      filters: debouncedFilters.length > 0 ? debouncedFilters : undefined,
      sort: { by: sortBy, dir: sortDir },
      offset: offset > 0 ? offset : undefined,
      preset: selectedPreset,
    });
    const next = params.toString();
    const current = searchParams.toString();
    if (next !== current) {
      setSearchParams(params, { replace: true });
    }
  }, [debouncedQ, debouncedFilters, sortBy, sortDir, offset, selectedPreset]);

  const filtersMetaQ = useQuery({
    queryKey: ["universeFilters"],
    queryFn: getUniverseFilters,
    staleTime: 60_000,
  });

  const viewsQ = useQuery({
    queryKey: ["views", "all"],
    queryFn: () => getViews("all"),
    staleTime: 30_000,
  });

  const snapshotQ = useQuery({
    queryKey: ["coverageSnapshot"],
    queryFn: () => universeService.getCoverageSnapshot(),
    staleTime: 30_000,
  });

  const queryQ = useQuery({
    queryKey: ["universeQuery", debouncedFilters, debouncedQ, sortBy, sortDir, offset],
    queryFn: () =>
      queryUniverse({
        filters: debouncedFilters,
        logic: "and",
        sort: { by: sortBy, dir: sortDir },
        limit: LIMIT,
        offset,
        q: debouncedQ.trim() || undefined,
      }),
    staleTime: 15_000,
  });

  const rows = queryQ.data?.rows ?? [];
  const total = queryQ.data?.total ?? 0;
  const totalCompanies = snapshotQ.data?.total_companies ?? 0;
  const hasQuery = filters.length > 0 || (q && q.trim());
  const matched = hasQuery ? total : totalCompanies;

  const handleSaveView = async () => {
    try {
      const payload = {
        name: saveViewName || "Unnamed View",
        scope: "private" as const,
        filtersJson: { filters, q: q || undefined, sort: { by: sortBy, dir: sortDir } },
        columnsJson: [],
        sortJson: { by: sortBy, dir: sortDir },
      };
      if (selectedViewId) {
        await updateView(selectedViewId, payload);
        setViewSnapshot({ filters, q, sort: { by: sortBy, dir: sortDir } });
      } else {
        await createView(payload);
      }
      setSaveViewOpen(false);
      setSaveViewName("");
    } catch (e) {
      console.error(e);
      alert("Failed to save view. Sign in may be required.");
    }
  };

  const handleCreateList = async () => {
    setCreateListLoading(true);
    try {
      if (createListScope === "all") {
        const res = await createListFromQuery({
          name: createListName || "Unnamed List",
          scope: "private",
          queryPayload: {
            filters,
            logic: "and",
            sort: { by: sortBy, dir: sortDir },
            q: q.trim() || undefined,
          },
        });
        setCreateListOpen(false);
        setCreateListName("");
        setCreateListScope("current");
        toast({
          title: "List created",
          description: `Created list with ${res.insertedCount.toLocaleString()} companies.`,
          action: (
            <ToastAction
              altText="Open in Pipeline"
              onClick={() => navigate(`/app/pipeline?list=${res.listId}`)}
            >
              Open in Pipeline
            </ToastAction>
          ),
        });
      } else {
        const list = await createList({ name: createListName || "Unnamed List", scope: "private" });
        const orgnrs = rows.map((r) => r.orgnr);
        if (orgnrs.length > 0) {
          await addListItems(list.id, orgnrs);
        }
        setCreateListOpen(false);
        setCreateListName("");
        toast({
          title: "List created",
          description: `Added ${orgnrs.length} companies to list.`,
          action: (
            <ToastAction
              altText="Open in Pipeline"
              onClick={() => navigate(`/app/pipeline?list=${list.id}`)}
            >
              Open in Pipeline
            </ToastAction>
          ),
        });
      }
    } catch (e) {
      console.error(e);
      toast({
        title: "Failed to create list",
        description: e instanceof Error ? e.message : "Sign in may be required.",
        variant: "destructive",
      });
    } finally {
      setCreateListLoading(false);
    }
  };

  const handleSelectView = (view: SavedView) => {
    setSelectedViewId(view.id);
    const fj = view.filtersJson as Record<string, unknown>;
    const farr = fj.filters as FilterItem[] | undefined;
    const viewFilters = Array.isArray(farr) ? farr : [];
    const qVal = (fj.q as string) ?? "";
    const s = fj.sort as Record<string, string> | undefined;
    const by = (s?.by as SortColumn) ?? "data_quality_score";
    const dir = (s?.dir as "asc" | "desc") ?? "asc";
    setFilterRows(viewFilters.length > 0 ? viewFilters.map((f) => ({ ...f })) : [{}]);
    setQ(qVal);
    setSortBy(by);
    setSortDir(dir);
    setOffset(0);
    setViewSnapshot({ filters: viewFilters, q: qVal, sort: { by, dir } });
    setSelectedPreset(null);
  };

  const handleApplyPreset = (preset: (typeof PRESETS)[0]) => {
    setFilterRows(preset.filters.length > 0 ? preset.filters.map((f) => ({ ...f })) : [{}]);
    setSortBy(preset.sort.by);
    setSortDir(preset.sort.dir);
    setOffset(0);
    setSelectedViewId(null);
    setSelectedPreset(preset.id);
    setViewSnapshot(null);
  };

  const handleReset = () => {
    setFilterRows([{}]);
    setQ("");
    setSortBy(DEFAULT_SORT.by);
    setSortDir(DEFAULT_SORT.dir);
    setOffset(0);
    setSelectedViewId(null);
    setSelectedPreset(null);
    setViewSnapshot(null);
  };

  const handleClearAll = () => {
    setFilterRows([{}]);
    setOffset(0);
  };

  const isModified =
    selectedViewId != null &&
    viewSnapshot != null &&
    (JSON.stringify(filters) !== JSON.stringify(viewSnapshot.filters) ||
      q !== viewSnapshot.q ||
      sortBy !== viewSnapshot.sort.by ||
      sortDir !== viewSnapshot.sort.dir);

  const handleSort = (col: SortColumn) => {
    setSortBy(col);
    setSortDir((prev) => (prev === "asc" && sortBy === col ? "desc" : "asc"));
    setOffset(0);
  };

  const allViews = (viewsQ.data?.items ?? []) as SavedView[];

  const hasBackendError = queryQ.isError || filtersMetaQ.isError;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] min-h-0 min-w-0">
      {hasBackendError && (
        <div className="shrink-0 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <strong>Backend error or unauthorized.</strong>{" "}
          {queryQ.isError && queryQ.error instanceof Error && queryQ.error.message.includes("401")
            ? "Sign in may be required."
            : "Check that the API is running, Postgres is up, and migrations are applied."}{" "}
          <Button variant="ghost" size="xs" className="ml-2 h-auto py-0.5" onClick={() => { queryQ.refetch(); filtersMetaQ.refetch(); }}>
            Retry
          </Button>
        </div>
      )}
      <div className="grid grid-cols-[280px,minmax(0,1fr)] gap-0 flex-1 min-h-0">
      <aside className="flex flex-col overflow-auto border-r w-[280px]">
        <LibrarySidebar
          layout="universe"
          mode="views"
          selectedId={selectedViewId}
          onSelectView={handleSelectView}
          onSelectList={(list) => navigate(`/app/pipeline?list=${list.id}`)}
        />
      </aside>
      {/* Main workspace */}
      <div className="flex flex-col min-h-0 min-w-0 overflow-hidden pl-4">
        {/* QueryBar: search + actions */}
        <div className="shrink-0 pb-3">
          <QueryBar
            q={q}
            onQChange={(v) => { setQ(v); setOffset(0); }}
            onRefresh={() => queryQ.refetch()}
            onEnrich={() => navigate("/app/runs")}
            saveViewOpen={saveViewOpen}
            setSaveViewOpen={setSaveViewOpen}
            saveViewName={saveViewName}
            setSaveViewName={setSaveViewName}
            onSaveView={handleSaveView}
            createListOpen={createListOpen}
            setCreateListOpen={setCreateListOpen}
            createListName={createListName}
            setCreateListName={setCreateListName}
            createListScope={createListScope}
            setCreateListScope={setCreateListScope}
            createListLoading={createListLoading}
            onCreateList={handleCreateList}
            selectedViewId={selectedViewId}
            isModified={!!isModified}
            rowsCount={rows.length}
            totalCount={total}
            allViews={allViews}
            onSelectView={handleSelectView}
            onClearAll={handleClearAll}
            onReset={handleReset}
            hasFilters={filters.length > 0}
            presets={PRESETS}
            selectedPresetId={selectedPreset}
            onApplyPreset={(id) => handleApplyPreset(PRESETS.find((p) => p.id === id)!)}
          />
        </div>

        {/* FilterStack: rows only, one long line each */}
        <div className="shrink-0 space-y-2 pb-2">
          <FilterRows
            rows={filterRows}
            taxonomy={filtersMetaQ.data ?? null}
            taxonomyLoading={filtersMetaQ.isLoading}
            onRowsChange={setFilterRows}
          />
        </div>

        {/* ResultsHeader + Table card */}
        <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="py-2 px-4 flex flex-row items-center justify-between shrink-0 border-b">
            <span className="text-sm text-muted-foreground">
              Results: {queryQ.isError ? "Error" : `${matched.toLocaleString()} of ${totalCompanies.toLocaleString()}`}
              {!hasQuery && " (All)"}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {total === 0 ? "0" : `${offset + 1}–${Math.min(offset + LIMIT, total)}`} of {total.toLocaleString()}
              </span>
              <Button
                variant="outline"
                size="xs"
                disabled={offset === 0}
                onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="xs"
                disabled={offset + LIMIT >= total}
                onClick={() => setOffset((o) => o + LIMIT)}
              >
                Next
              </Button>
            </div>
          </div>

          <CardContent className="flex-1 min-h-0 overflow-hidden p-0">
            <div className="h-full overflow-auto rounded-b-lg">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background [&_th]:bg-background">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Company</TableHead>
                      <TableHead>Org nr</TableHead>
                      <SortableTh
                        label="Revenue"
                        col="revenue_latest"
                        current={sortBy}
                        dir={sortDir}
                        onSort={handleSort}
                      />
                      <SortableTh
                        label="EBITDA %"
                        col="ebitda_margin_latest"
                        current={sortBy}
                        dir={sortDir}
                        onSort={handleSort}
                      />
                      <SortableTh
                        label="CAGR 3y"
                        col="revenue_cagr_3y"
                        current={sortBy}
                        dir={sortDir}
                        onSort={handleSort}
                      />
                      <SortableTh
                        label="Employees"
                        col="employees_latest"
                        current={sortBy}
                        dir={sortDir}
                        onSort={handleSort}
                      />
                      <SortableTh
                        label="Coverage"
                        col="data_quality_score"
                        current={sortBy}
                        dir={sortDir}
                        onSort={handleSort}
                      />
                    <TableHead>Freshness</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((r) => (
                      <Row
                        key={r.orgnr}
                        row={r}
                        onOpen={() => navigate(`/app/companies/${r.orgnr}`)}
                      />
                    ))}

                    {queryQ.isLoading && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-sm text-muted-foreground">
                          Loading…
                        </TableCell>
                      </TableRow>
                    )}

                    {!queryQ.isLoading && queryQ.isError && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-sm py-8">
                          <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
                            <span className="font-medium">Could not load companies</span>
                            <p className="text-xs max-w-md">
                              {queryQ.error instanceof Error
                                ? queryQ.error.message
                                : "Ensure the backend is running, Postgres is up (e.g. docker compose up -d), and migrations are applied."}
                            </p>
                            <Button variant="outline" size="xs" onClick={() => queryQ.refetch()}>
                              Retry
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}

                    {!queryQ.isLoading && !queryQ.isError && rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-sm text-muted-foreground">
                          No results.
                        </TableCell>
                      </TableRow>
                    )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}

function SortableTh({
  label,
  col,
  current,
  dir,
  onSort,
}: {
  label: string;
  col: SortColumn;
  current: SortColumn;
  dir: "asc" | "desc";
  onSort: (c: SortColumn) => void;
}) {
  const active = current === col;
  return (
    <TableHead>
      <button
        type="button"
        onClick={() => onSort(col)}
        className="flex items-center gap-1 hover:text-foreground font-medium transition-colors"
      >
        {label}
        {active && (
          <span className="text-muted-foreground">{dir === "asc" ? "↑" : "↓"}</span>
        )}
      </button>
    </TableHead>
  );
}

function fmtRevenue(sek: number | null | undefined): string {
  if (sek == null) return "—";
  const m = sek / 1_000_000;
  return m >= 1000 ? `${(m / 1000).toFixed(1)}B` : m >= 1 ? `${m.toFixed(1)}M` : `${(sek / 1000).toFixed(0)}k`;
}

function fmtPct(val: number | null | undefined): string {
  if (val == null) return "—";
  const pct = Math.abs(val) < 1 && val !== 0 ? val * 100 : val;
  return `${pct.toFixed(1)}%`;
}

function fmtNum(val: number | null | undefined): string {
  if (val == null) return "—";
  return val >= 1000 ? `${(val / 1000).toFixed(1)}k` : String(val);
}

function Row({ row, onOpen }: { row: UniverseRow; onOpen: () => void }) {
  return (
    <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onOpen}>
      <TableCell>
        <div className="font-medium">{row.name ?? "—"}</div>
        <div className="text-xs text-muted-foreground line-clamp-1">
          {(row.segment_names ?? []).join(" · ")}
        </div>
      </TableCell>

      <TableCell className="text-sm">{row.orgnr}</TableCell>

      <TableCell className="text-sm tabular-nums">{fmtRevenue(row.revenue_latest)}</TableCell>
      <TableCell className="text-sm tabular-nums">{fmtPct(row.ebitda_margin_latest)}</TableCell>
      <TableCell className="text-sm tabular-nums">{fmtPct(row.revenue_cagr_3y)}</TableCell>
      <TableCell className="text-sm tabular-nums">{fmtNum(row.employees_latest)}</TableCell>

      <TableCell>
        <Badge variant={row.data_quality_score >= 3 ? "default" : "secondary"} title="Coverage score (homepage, AI, 3Y fin)">
          {row.data_quality_score}/4
        </Badge>
      </TableCell>

      <TableCell className="text-sm">{row.data_quality_score}/4</TableCell>

      <TableCell>
        {row.is_stale ? (
          <Badge variant="secondary">Stale</Badge>
        ) : (
          <Badge>Fresh</Badge>
        )}
      </TableCell>
    </TableRow>
  );
}
