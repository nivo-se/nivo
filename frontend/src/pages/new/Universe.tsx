import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCompaniesWithTotal, useCreateList, useCreateListFromQuery } from "@/lib/hooks/figmaQueries";
import {
  calculateRevenueCagr,
  getLatestFinancials,
  formatRevenueSEK,
  formatPercent,
} from "@/lib/utils/figmaCompanyUtils";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "@/hooks/use-toast";
import type { Company } from "@/types/figma";
import type { UniverseQueryPayload } from "@/lib/services/universeQueryService";
import {
  getNewUniverseStateFromUrl,
  buildNewUniverseSearchParams,
} from "@/lib/newUniverseUrlState";
import { includeRulesToBackendFilters } from "@/lib/filterConversion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { FilterBuilder } from "@/components/new/FilterBuilder";
import { SaveListDialog } from "@/components/new/SaveListDialog";
import { AddToListDropdown } from "@/components/new/AddToListDropdown";
import { CompanySnapshotModal } from "@/components/new/CompanySnapshotModal";
import { EmptyState } from "@/components/new/EmptyState";
import { ErrorState } from "@/components/new/ErrorState";
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
      companyValue = company.display_name?.toLowerCase() ?? "";
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
      className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900"
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

export default function NewUniverse() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlState = useMemo(() => getNewUniverseStateFromUrl(searchParams), [searchParams]);
  const [initialUrlState] = useState(() => urlState ?? null);

  const [searchInput, setSearchInput] = useState(initialUrlState?.q ?? "");
  const debouncedQ = useDebounce(searchInput.trim(), 300);
  const [sortField, setSortField] = useState<string>(initialUrlState?.sortField ?? "name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(initialUrlState?.sortDir ?? "asc");
  const [currentPage, setCurrentPage] = useState(initialUrlState?.page ?? 1);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showSaveViewDialog, setShowSaveViewDialog] = useState(false);
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
    const next = buildNewUniverseSearchParams({
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
      setShowSaveDialog(false);
      navigate(`/lists/${list.id}`);
    } catch {
      // Error handled by mutation
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
      setShowSaveViewDialog(false);
      navigate(`/lists/${res.listId}`);
      toast({
        title: "List created",
        description: `Added ${res.insertedCount.toLocaleString()} companies to list.`,
      });
    } catch (e) {
      toast({
        title: "Failed to create list",
        description: e instanceof Error ? e.message : "Unknown error",
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
      <div className="new-header border-b px-8 py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Universe</h1>
            <p className="text-sm text-gray-600 mt-1">
              {showLoading
                ? "Loading..."
                : filteredCompanies.length > 0
                  ? `Showing ${(currentPage - 1) * COMPANIES_PER_PAGE + 1}–${(currentPage - 1) * COMPANIES_PER_PAGE + filteredCompanies.length} of ${totalCount.toLocaleString()} companies`
                  : `${totalCount.toLocaleString()} companies`}
            </p>
          </div>
          <div className="flex gap-3">
            <Input
              placeholder="Search by name..."
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setCurrentPage(1);
              }}
              className="w-48"
            />
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
              {showFilters ? "Hide" : "Show"} Filters
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowSaveViewDialog(true)}
            >
              Save view as list
            </Button>
            <Button
              variant="outline"
              disabled={selectedCompanies.size === 0}
              onClick={() => setShowSaveDialog(true)}
            >
              Save selection ({selectedCompanies.size})
            </Button>
            <Button variant="outline">Export</Button>
          </div>
        </div>

        {showFilters && (
          <div className="mt-4">
            <FilterBuilder
              filters={activeFilters}
              onChange={setActiveFilters}
              onApply={() => setCurrentPage(1)}
            />
          </div>
        )}

        {!showFilters && (activeFilters.include.rules.length > 0 || activeFilters.exclude.rules.length > 0) && (
          <div className="mt-4 flex items-center gap-2 text-xs">
            <span className="text-gray-600">Active filters:</span>
            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">
              {activeFilters.include.rules.length} include
            </span>
            {activeFilters.exclude.rules.length > 0 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">
                {activeFilters.exclude.rules.length} exclude
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={() => setShowFilters(true)}>
              Edit Filters
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto px-8 py-4">
        {showLoading ? (
          <div className="new-card p-12 text-center">
            <div className="inline-block w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm text-gray-600">Loading companies...</p>
            <p className="text-xs text-gray-500 mt-1">Fetching from database</p>
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
        <div className="new-card overflow-hidden text-sm">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left w-10 text-xs font-medium text-gray-600">
                  <Checkbox
                    checked={filteredCompanies.length > 0 && selectedCompanies.size === filteredCompanies.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">
                  <SortableHeader label="Company Name" field="name" currentField={sortField} direction={sortDirection} onClick={toggleSort} />
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">
                  <SortableHeader label="Industry" field="industry" currentField={sortField} direction={sortDirection} onClick={toggleSort} />
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Geography</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">
                  <SortableHeader label="Revenue" field="revenue" currentField={sortField} direction={sortDirection} onClick={toggleSort} />
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">
                  <SortableHeader label="3Y CAGR" field="cagr" currentField={sortField} direction={sortDirection} onClick={toggleSort} />
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">
                  <SortableHeader label="EBITDA Margin" field="margin" currentField={sortField} direction={sortDirection} onClick={toggleSort} />
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-600">Flags</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-600">AI</th>
                <th className="px-3 py-2 w-20 text-xs font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCompanies.map((company) => {
                const latest = getLatestFinancials(company);
                const cagr = calculateRevenueCagr(company);
                const cagrNum = cagr ?? 0;
                return (
                  <tr key={company.orgnr} className="hover:bg-gray-50 transition-colors">
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
                        className="font-medium text-gray-700 hover:text-gray-900 text-left"
                      >
                        {company.display_name}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{company.industry_label}</td>
                    <td className="px-3 py-2 text-gray-700">{company.region ?? "—"}</td>
                    <td className="px-3 py-2 text-right text-gray-700 font-mono tabular-nums">
                      {formatRevenueSEK(latest.revenue)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700 font-mono tabular-nums">
                      {formatPercent(cagr)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700 font-mono tabular-nums">
                      {formatPercent(latest.ebitdaMargin)}
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-gray-600">
                      {company.status === "inactive" && <span title="Inactive">INA</span>}
                      {!company.has_3y_financials && <span title="Incomplete financials"> INC</span>}
                    </td>
                    <td className="px-3 py-2 text-center text-gray-600">
                      {company.ai_profile ? (
                        <span title={`Score: ${company.ai_profile.ai_fit_score}`}>✓</span>
                      ) : (
                        <span className="text-gray-400">—</span>
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
        )}

        {filteredCompanies.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-600">
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

      {showSaveDialog && (
        <SaveListDialog
          open={showSaveDialog}
          onClose={() => setShowSaveDialog(false)}
          onSave={handleSaveList}
          companyCount={selectedCompanies.size}
          isLoading={createListMutation.isPending}
        />
      )}
      {showSaveViewDialog && (
        <SaveListDialog
          open={showSaveViewDialog}
          onClose={() => setShowSaveViewDialog(false)}
          onSave={handleSaveViewAsList}
          description="Create a list from all companies matching your current filters, search, and sort. Server-side query may differ if you use exclude filters."
          isLoading={createListFromQueryMutation.isPending}
        />
      )}
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
