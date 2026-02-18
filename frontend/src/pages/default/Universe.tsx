import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCompaniesWithTotal, useCreateList, useCreateListFromQuery } from "@/lib/hooks/apiQueries";
import {
  calculateRevenueCagr,
  getLatestFinancials,
  formatRevenueSEK,
  formatPercent,
} from "@/lib/utils/companyMetrics";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "@/hooks/use-toast";
import type { Company } from "@/lib/api/types";
import type { UniverseQueryPayload } from "@/lib/services/universeQueryService";
import {
  getDefaultUniverseStateFromUrl,
  buildDefaultUniverseSearchParams,
} from "@/lib/defaultUniverseUrlState";
import { includeRulesToBackendFilters } from "@/lib/filterConversion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { FilterBuilder } from "@/components/default/FilterBuilder";
import { SaveListDialog } from "@/components/default/SaveListDialog";
import { AddToListDropdown } from "@/components/default/AddToListDropdown";
import { CompanySnapshotModal } from "@/components/default/CompanySnapshotModal";
import { EmptyState } from "@/components/default/EmptyState";
import { ErrorState } from "@/components/default/ErrorState";
import { ChevronDown, ChevronUp } from "lucide-react";

const COMPANIES_PER_PAGE = 50;
const SORT_BY_MAP: Record<string, string> = {
  name: "name",
  industry: "name",
  revenue: "revenue_latest",
  margin: "ebitda_margin_latest",
  cagr: "revenue_cagr_3y",
  employees: "employees_latest",
};

function evaluateFilterGroup(company: Company, group: { type?: string; rules?: unknown[] }): boolean {
  if (!group.rules || group.rules.length === 0) return true;
  const results = group.rules.map((rule: unknown) => {
    const r = rule as { type?: string; rules?: unknown[]; field?: string; operator?: string; value?: unknown };
    if (r.rules) return evaluateFilterGroup(company, r);
    return evaluateFilterRule(company, r);
  });
  return group.type === "or" ? results.some(Boolean) : results.every(Boolean);
}

function evaluateFilterRule(company: Company, rule: { field?: string; operator?: string; value?: unknown }): boolean {
  const { field, operator, value } = rule;
  let companyValue: unknown;
  const latest = getLatestFinancials(company);
  switch (field) {
    case "revenue_latest":
      companyValue = latest.revenue;
      break;
    case "ebitda_margin_latest":
      companyValue = latest.ebitdaMargin;
      break;
    case "revenue_cagr_3y":
      companyValue = latest.revenue_cagr;
      break;
    case "industry_label":
      companyValue = company.industry_label;
      break;
    case "region":
      companyValue = company.region;
      break;
    case "display_name":
    case "name":
      companyValue = (company.display_name ?? "").toString().toLowerCase();
      break;
    case "segment_names":
      companyValue = Array.isArray(company.segment_names)
        ? (company.segment_names as string[]).join(" ").toLowerCase()
        : String(company.segment_names ?? "").toLowerCase();
      break;
    default:
      return true;
  }
  switch (operator) {
    case "eq":
      return companyValue === value;
    case "neq":
      return companyValue !== value;
    case "gt":
      return typeof companyValue === "number" && companyValue > (value as number);
    case "gte":
      return typeof companyValue === "number" && companyValue >= (value as number);
    case "lt":
      return typeof companyValue === "number" && companyValue < (value as number);
    case "lte":
      return typeof companyValue === "number" && companyValue <= (value as number);
    case "contains":
      return typeof companyValue === "string" && companyValue.includes(String(value).toLowerCase());
    default:
      return true;
  }
}

function SortableHeader({
  label,
  field,
  currentField,
  direction,
  onClick,
}: {
  label: string;
  field: string;
  currentField: string;
  direction: "asc" | "desc";
  onClick: (field: string) => void;
}) {
  const isActive = currentField === field;
  return (
    <button
      type="button"
      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      onClick={() => onClick(field)}
    >
      {label}
      {isActive && (direction === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
    </button>
  );
}

const DEFAULT_FILTERS = {
  include: { type: "and" as const, rules: [] as unknown[] },
  exclude: { type: "and" as const, rules: [] as unknown[] },
};

export default function Universe() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlState = useMemo(() => getDefaultUniverseStateFromUrl(searchParams), [searchParams]);
  const [initialUrlState] = useState(() => urlState ?? null);

  const [searchInput, setSearchInput] = useState(initialUrlState?.q ?? "");
  const debouncedQ = useDebounce(searchInput.trim(), 300);
  const [sortField, setSortField] = useState<string>(initialUrlState?.sortField ?? "name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(initialUrlState?.sortDir ?? "asc");
  const [currentPage, setCurrentPage] = useState(initialUrlState?.page ?? 1);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [snapshotOrgnr, setSnapshotOrgnr] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<{
    include: { id?: string; type: string; rules: unknown[] };
    exclude: { id?: string; type: string; rules: unknown[] };
  }>(() => {
    if (initialUrlState?.filters?.length) {
      const rules = initialUrlState.filters!.map((f, i) => ({
        id: `rule_${Date.now()}_${i}`,
        field: f.field,
        operator: f.operator,
        value: f.value,
      })) as { id: string; field: string; operator: string; value: unknown }[];
      return {
        include: { type: "and", rules },
        exclude: { type: "and", rules: [] },
      };
    }
    return DEFAULT_FILTERS;
  });

  useEffect(() => {
    const includeRules = (activeFilters.include.rules || []) as { field?: string; operator?: string; value?: unknown }[];
    const filters = includeRules
      .filter((r) => r.field && r.operator != null)
      .map((r) => ({ field: r.field!, operator: r.operator!, value: r.value }));
    const next = buildDefaultUniverseSearchParams({
      q: debouncedQ || undefined,
      page: currentPage > 1 ? currentPage : undefined,
      sortField: sortField !== "name" ? sortField : undefined,
      sortDir: sortDirection !== "asc" ? sortDirection : undefined,
      filters: filters.length > 0 ? filters : undefined,
    });
    const nextStr = next.toString();
    const currStr = searchParams.toString();
    if (nextStr !== currStr) setSearchParams(next, { replace: true });
  }, [debouncedQ, currentPage, sortField, sortDirection, activeFilters.include.rules, searchParams, setSearchParams]);

  const sortBy = SORT_BY_MAP[sortField] ?? "name";
  const backendFilters = useMemo(() => {
    const rules = (activeFilters.include.rules || []) as { field?: string; operator?: string; value?: unknown }[];
    return includeRulesToBackendFilters(
      rules.filter((r) => r.field && r.operator).map((r) => ({ field: r.field!, operator: r.operator!, value: r.value }))
    );
  }, [activeFilters.include.rules]);
  const queryPayload: Partial<UniverseQueryPayload> = useMemo(
    () => ({
      q: debouncedQ || undefined,
      filters: backendFilters,
      limit: COMPANIES_PER_PAGE,
      offset: (currentPage - 1) * COMPANIES_PER_PAGE,
      sort: { by: sortBy, dir: sortDirection },
    }),
    [debouncedQ, currentPage, sortBy, sortDirection, backendFilters]
  );

  const { data: universeData, isLoading, isError, error, refetch } = useCompaniesWithTotal(queryPayload);
  const companies = universeData?.companies ?? [];
  const totalCount = universeData?.total ?? 0;
  const createListMutation = useCreateList();
  const createListFromQueryMutation = useCreateListFromQuery();

  const filteredCompanies = useMemo(() => {
    let result = [...companies];
    if (activeFilters.include.rules.length > 0) {
      result = result.filter((c) => evaluateFilterGroup(c, activeFilters.include));
    }
    if (activeFilters.exclude.rules.length > 0) {
      result = result.filter((c) => !evaluateFilterGroup(c, activeFilters.exclude));
    }
    return result;
  }, [companies, activeFilters]);

  const toggleSort = (field: string) => {
    setSortField(field);
    setSortDirection(sortField === field ? (sortDirection === "asc" ? "desc" : "asc") : "asc");
    setCurrentPage(1);
  };

  const toggleSelectCompany = (companyId: string) => {
    const next = new Set(selectedCompanies);
    if (next.has(companyId)) next.delete(companyId);
    else next.add(companyId);
    setSelectedCompanies(next);
  };

  const toggleSelectAll = () => {
    if (selectedCompanies.size === filteredCompanies.length) {
      setSelectedCompanies(new Set());
    } else {
      setSelectedCompanies(new Set(filteredCompanies.map((c) => c.orgnr)));
    }
  };

  const handleSaveList = async (name: string, isPublic: boolean) => {
    const companyIds = Array.from(selectedCompanies);
    try {
      const list = await createListMutation.mutateAsync({
        name,
        scope: isPublic ? "team" : "private",
        companyIds,
      });
      setSaveDialogOpen(false);
      navigate(`/lists/${list.id}`);
    } catch (e) {
      toast({
        title: "Failed to create list",
        description: e instanceof Error ? e.message : "Could not save selection as list. Check backend and try again.",
        variant: "destructive",
      });
    }
  };

  const handleSaveViewAsList = async (name: string, isPublic: boolean) => {
    const includeRules = (activeFilters.include.rules || []) as { field?: string; operator?: string; value?: unknown }[];
    const filters = includeRulesToBackendFilters(
      includeRules.filter((r) => r.field && r.operator).map((r) => ({ field: r.field!, operator: r.operator!, value: r.value }))
    );
    try {
      const res = await createListFromQueryMutation.mutateAsync({
        name,
        scope: isPublic ? "team" : "private",
        queryPayload: {
          filters,
          logic: "and",
          sort: { by: sortBy, dir: sortDirection },
          q: debouncedQ || undefined,
        },
      });
      setSaveDialogOpen(false);
      navigate(`/lists/${res.listId}`);
      toast({
        title: "List created",
        description: `Added ${res.insertedCount.toLocaleString()} companies to list.`,
      });
    } catch (e) {
      toast({
        title: "Failed to create list from view",
        description: e instanceof Error ? e.message : "Could not save view as list. Check backend and try again.",
        variant: "destructive",
      });
    }
  };

  const showError = isError;
  const showLoading = isLoading && companies.length === 0;
  const hasFilters = activeFilters.include.rules.length > 0 || activeFilters.exclude.rules.length > 0;
  const isEmpty = !showLoading && !showError && filteredCompanies.length === 0;
  const isEmptyDueToNoData = isEmpty && totalCount === 0 && !hasFilters && !debouncedQ;

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0">
        <div className="max-w-5xl mx-auto px-8 pt-8 pb-2">
          <h1 className="text-base font-semibold text-foreground mb-2">Universe</h1>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-8 pb-8 flex flex-col gap-4">
        <div className="flex flex-col gap-2 shrink-0 sticky top-0 z-20 bg-background py-2 -mx-8 px-8 border-b border-border">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <Input
              placeholder="Search by name..."
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setCurrentPage(1);
              }}
              className="w-72 max-w-full"
            />
            <div className="flex gap-3 shrink-0">
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
              {showFilters ? "Hide" : "Show"} Filters
            </Button>
            <Button variant="outline" onClick={() => setSaveDialogOpen(true)}>
              Save as list
            </Button>
            <Button variant="outline">Export</Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {showLoading
              ? "Loading..."
              : filteredCompanies.length > 0
                ? `Showing ${(currentPage - 1) * COMPANIES_PER_PAGE + 1}–${(currentPage - 1) * COMPANIES_PER_PAGE + filteredCompanies.length} of ${totalCount.toLocaleString()} companies`
                : `${totalCount.toLocaleString()} companies`}
          </p>
        </div>

        {showFilters && (
          <div className="shrink-0">
            <FilterBuilder
              filters={activeFilters}
              onChange={setActiveFilters}
              onApply={() => setCurrentPage(1)}
            />
          </div>
        )}

        {!showFilters && (activeFilters.include.rules.length > 0 || activeFilters.exclude.rules.length > 0) && (
          <div className="flex items-center gap-2 text-xs shrink-0">
            <span className="text-muted-foreground">Active filters:</span>
            <span className="px-2 py-1 bg-muted text-foreground rounded">
              {activeFilters.include.rules.length} include
            </span>
            {activeFilters.exclude.rules.length > 0 && (
              <span className="px-2 py-1 bg-muted text-foreground rounded">
                {activeFilters.exclude.rules.length} exclude
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={() => setShowFilters(true)}>
              Edit Filters
            </Button>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-auto">
        {showLoading ? (
          <div className="app-card p-12 text-center">
            <div className="inline-block w-6 h-6 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">Loading companies...</p>
            <p className="text-xs text-muted-foreground mt-1">Fetching from database</p>
          </div>
        ) : showError ? (
          <ErrorState
            message={error?.message ?? "Failed to load companies from database"}
            retry={() => refetch()}
          />
        ) : isEmpty ? (
          <EmptyState
            title={isEmptyDueToNoData ? "No companies in database" : "No companies match your filters"}
            description={
              isEmptyDueToNoData
                ? "The database may be empty or there may be a connection issue. Check that Postgres is configured and the coverage_metrics view exists."
                : "Try adjusting search or filters"
            }
            action={
              isEmptyDueToNoData ? (
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Retry
                </Button>
              ) : undefined
            }
          />
        ) : (
        <div className="app-card text-sm flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-card border-b border-border shadow-sm">
              <tr>
                <th className="px-3 py-2 text-left w-10 text-xs font-medium text-muted-foreground">
                  <Checkbox
                    checked={filteredCompanies.length > 0 && selectedCompanies.size === filteredCompanies.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  <SortableHeader label="Company Name" field="name" currentField={sortField} direction={sortDirection} onClick={toggleSort} />
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  <SortableHeader label="Industry" field="industry" currentField={sortField} direction={sortDirection} onClick={toggleSort} />
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground" title="Latest fiscal year">
                  <SortableHeader label="Revenue" field="revenue" currentField={sortField} direction={sortDirection} onClick={toggleSort} />
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground" title="3-year compound annual growth rate">
                  <SortableHeader label="3Y CAGR" field="cagr" currentField={sortField} direction={sortDirection} onClick={toggleSort} />
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground" title="Latest fiscal year">
                  <SortableHeader label="EBITDA Margin" field="margin" currentField={sortField} direction={sortDirection} onClick={toggleSort} />
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">Flags</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">AI</th>
                <th className="px-3 py-2 w-20 text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCompanies.map((company) => {
                const latest = getLatestFinancials(company);
                const cagr = calculateRevenueCagr(company);
                const cagrNum = cagr ?? 0;
                return (
                  <tr key={company.orgnr} className="hover:bg-muted/40 transition-colors">
                    <td className="px-3 py-2">
                      <Checkbox
                        checked={selectedCompanies.has(company.orgnr)}
                        onCheckedChange={() => toggleSelectCompany(company.orgnr)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setSnapshotOrgnr(company.orgnr)}
                        className="font-medium text-foreground hover:text-foreground text-left"
                      >
                        {company.display_name}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-foreground">{company.industry_label}</td>
                    <td className="px-3 py-2 text-right text-foreground font-mono tabular-nums" title={company.latest_year ? `FY${company.latest_year}` : undefined}>
                      {formatRevenueSEK(latest.revenue)}
                      {company.latest_year && <span className="text-muted-foreground font-sans text-[10px] ml-1">({company.latest_year})</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-foreground font-mono tabular-nums">
                      {formatPercent(cagr)}
                    </td>
                    <td className="px-3 py-2 text-right text-foreground font-mono tabular-nums">
                      {formatPercent(latest.ebitdaMargin)}
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                      {company.status === "inactive" && <span title="Inactive">INA</span>}
                      {!company.has_3y_financials && <span title="Incomplete financials"> INC</span>}
                    </td>
                    <td className="px-3 py-2 text-center text-muted-foreground">
                      {company.ai_profile ? (
                        <span title={`Score: ${company.ai_profile.ai_fit_score}`}>✓</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <AddToListDropdown orgnrs={[company.orgnr]} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
        )}

        {filteredCompanies.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted-foreground">
            Showing {(currentPage - 1) * COMPANIES_PER_PAGE + 1}–{Math.min(currentPage * COMPANIES_PER_PAGE, filteredCompanies.length)} of {filteredCompanies.length} on this page
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
        )}
        </div>
        </div>
      </div>

      <SaveListDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        selectedCount={selectedCompanies.size}
        onSave={(name, isPublic, saveType) => {
          if (saveType === "selection") {
            handleSaveList(name, isPublic);
          } else {
            handleSaveViewAsList(name, isPublic);
          }
        }}
        isLoading={createListMutation.isPending || createListFromQueryMutation.isPending}
      />
      {snapshotOrgnr && (
        <CompanySnapshotModal
          open={!!snapshotOrgnr}
          onOpenChange={(open) => !open && setSnapshotOrgnr(null)}
          orgnr={snapshotOrgnr}
        />
      )}
    </div>
  );
}
