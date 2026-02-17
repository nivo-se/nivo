import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useList, useCompaniesBatch, useRemoveFromList } from "@/lib/hooks/figmaQueries";
import {
  getLatestFinancials,
  formatRevenueSEK,
  formatPercent,
  formatNum,
  calculateRevenueCagr,
} from "@/lib/utils/figmaCompanyUtils";
import type { Company } from "@/types/figma";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { FilterBuilder } from "@/components/default/FilterBuilder";
import { EmptyState } from "@/components/default/EmptyState";
import { ErrorState } from "@/components/default/ErrorState";
import { ArrowLeft, Trash2, RefreshCw, Brain, ExternalLink, Download } from "lucide-react";
import { toast } from "sonner";
import * as api from "@/lib/services/figmaApi";

function getStageLabel(stage: string): string {
  switch (stage) {
    case "research":
      return "🔍 Research";
    case "ai_analysis":
      return "🤖 AI Analysis";
    case "prospects":
      return "🎯 Prospects";
    default:
      return stage;
  }
}

export default function NewListDetail() {
  const { listId } = useParams<{ listId: string }>();
  const queryClient = useQueryClient();
  const { data: list, isLoading, isError, error, refetch } = useList(listId ?? "");
  const orgnrs = list?.companyIds ?? [];
  const {
    data: companies = [],
    isLoading: companiesLoading,
    isTruncated,
    isError: companiesError,
    error: companiesErrorObj,
    refetch: refetchCompanies,
  } = useCompaniesBatch(orgnrs);
  const removeMutation = useRemoveFromList();

  const [showFilterBuilder, setShowFilterBuilder] = useState(false);
  const [editedFilters, setEditedFilters] = useState(list?.filters);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading list...</p>
      </div>
    );
  }

  if (isError || !list) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-8">
        <ErrorState
          message={error?.message ?? "List not found"}
          retry={() => refetch()}
          action={
            <Link to="/lists">
              <Button variant="outline" size="sm">
                Back to Lists
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const handleReloadFilters = () => {
    setShowFilterBuilder(true);
    setEditedFilters(list.filters ?? undefined);
  };

  const handleUpdateList = async () => {
    if (!editedFilters) return;
    try {
      await api.updateList(list.id, { filters: editedFilters });
      setShowFilterBuilder(false);
      refetch();
      toast.success("List updated");
    } catch {
      toast.error("Filter reload not yet implemented in backend");
    }
  };

  const handleAddToProspects = async () => {
    const companyIds = Array.from(selectedCompanies);
    if (companyIds.length === 0) return;
    try {
      for (const id of companyIds) {
        await api.createProspect(id);
      }
      queryClient.invalidateQueries({ queryKey: ["figma", "prospects"] });
      setSelectedCompanies(new Set());
      toast.success(`Added ${companyIds.length} companies to Prospects`);
    } catch {
      toast.error("Prospects not yet implemented in backend");
    }
  };

  const toggleSelectCompany = (orgnr: string) => {
    const next = new Set(selectedCompanies);
    if (next.has(orgnr)) next.delete(orgnr);
    else next.add(orgnr);
    setSelectedCompanies(next);
  };

  const toggleSelectAll = () => {
    if (selectedCompanies.size === companies.length) {
      setSelectedCompanies(new Set());
    } else {
      setSelectedCompanies(new Set(companies.map((c) => c.orgnr)));
    }
  };

  const handleRemove = (orgnr: string) => {
    if (confirm("Remove this company from the list?")) {
      removeMutation.mutate({ listId: list.id, orgnr });
    }
  };

  const searchLower = searchQuery.trim().toLowerCase();
  const filteredCompaniesList = searchLower
    ? companies.filter(
        (c) =>
          (c.display_name?.toLowerCase().includes(searchLower)) ||
          (c.orgnr?.includes(searchQuery)) ||
          (c.industry_label?.toLowerCase().includes(searchLower))
      )
    : companies;

  const handleExportCsv = () => {
    const headers = ["Org nr", "Company", "Industry", "Region", "Revenue", "3Y CAGR", "EBITDA Margin"];
    const rows = filteredCompaniesList.map((c) => {
      const latest = getLatestFinancials(c);
      const cagr = calculateRevenueCagr(c);
      return [
        c.orgnr,
        c.display_name ?? "",
        c.industry_label ?? "",
        c.region ?? "",
        latest.revenue ?? "",
        cagr != null ? `${(cagr * 100).toFixed(1)}%` : "",
        latest.ebitdaMargin != null ? `${(latest.ebitdaMargin * 100).toFixed(1)}%` : "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${list.name.replace(/[^a-z0-9]/gi, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported CSV");
  };

  return (
    <div className="h-full flex flex-col">
      <div className="bg-card border-b border-border px-8 py-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <Link to="/lists">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-base font-bold text-foreground">{list.name}</h1>
                {list.scope === "team" && (
                  <span className="text-xs px-2 py-1 bg-muted text-foreground rounded">
                    Shareable
                  </span>
                )}
                <span className="text-xs px-2 py-1 bg-muted text-foreground rounded">
                  {getStageLabel(list.stage)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {list.companyIds.length} companies
                {list.created_by && ` • Created by ${list.created_by}`} •{" "}
                {new Date(list.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            {list.filters && (
              <Button variant="outline" onClick={handleReloadFilters}>
                <RefreshCw className="w-4 h-4 mr-2" /> Reload & Modify Filters
              </Button>
            )}
            <Link to={`/ai/run/create?template=default&list=${list.id}`}>
              <Button variant="outline">
                <Brain className="w-4 h-4 mr-2" /> Run AI Analysis
              </Button>
            </Link>
            <Button
              variant="outline"
              disabled={selectedCompanies.size === 0}
              onClick={handleAddToProspects}
            >
              Add to Prospects ({selectedCompanies.size})
            </Button>
          </div>
        </div>

        {showFilterBuilder && editedFilters && (
          <div className="mt-4">
            <FilterBuilder
              filters={editedFilters}
              onChange={setEditedFilters}
              onApply={handleUpdateList}
            />
            <div className="mt-3 flex gap-2">
              <Button variant="outline" onClick={handleUpdateList}>Update List</Button>
              <Button variant="outline" onClick={() => setShowFilterBuilder(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {list.filters && !showFilterBuilder && (
          <div className="mt-4 p-3 bg-muted/40 border border-border rounded text-sm">
            <p className="text-foreground">
              ✓ This list was created from filters and can be reloaded to see updated
              results
            </p>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-4">
          <Input
            placeholder="Search companies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64"
          />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-4">
        {isTruncated && (
          <div className="mb-4 px-4 py-2 rounded bg-accent border border-accent text-sm text-accent-foreground">
            Showing first 500 companies for performance. List has {orgnrs.length} total.
          </div>
        )}
        {companiesError ? (
          <ErrorState
            message={companiesErrorObj?.message ?? "Failed to load companies"}
            retry={() => refetchCompanies()}
          />
        ) : companiesLoading && companies.length === 0 ? (
          <p className="text-muted-foreground">Loading companies...</p>
        ) : companies.length === 0 ? (
          <EmptyState
            title="No companies in this list"
            description="Add companies from Universe or Company detail"
            action={
              <Link to="/universe">
                <Button variant="outline" size="sm">Browse Universe</Button>
              </Link>
            }
          />
        ) : (
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left w-12">
                    <Checkbox
                      checked={companies.length > 0 && selectedCompanies.size === companies.length}
                      onCheckedChange={toggleSelectAll}
                      className="border-border data-[state=checked]:border-border data-[state=checked]:bg-muted data-[state=checked]:text-foreground focus-visible:ring-1 focus-visible:ring-border focus-visible:ring-offset-0"
                    />
                  </th>
                  <th className="px-4 py-3 text-left">Company Name</th>
                  <th className="px-4 py-3 text-left">Industry</th>
                  <th className="px-4 py-3 text-left">Geography</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                  <th className="px-4 py-3 text-right">3Y CAGR</th>
                  <th className="px-4 py-3 text-right">EBITDA Margin</th>
                  <th className="px-4 py-3 text-center">AI Score</th>
                  <th className="px-4 py-3 w-16">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCompaniesList.map((company: Company) => {
                  const latest = getLatestFinancials(company);
                  const cagr = calculateRevenueCagr(company) ?? 0;
                  return (
                    <tr key={company.orgnr} className="hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedCompanies.has(company.orgnr)}
                          onCheckedChange={() => toggleSelectCompany(company.orgnr)}
                          className="border-border data-[state=checked]:border-border data-[state=checked]:bg-muted data-[state=checked]:text-foreground focus-visible:ring-1 focus-visible:ring-border focus-visible:ring-offset-0"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/company/${company.orgnr}`}
                          className="font-medium text-foreground hover:text-foreground/80 flex items-center gap-2"
                        >
                          {company.display_name}
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {company.industry_label ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-foreground">{company.region ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm">
                        {formatRevenueSEK(latest.revenue)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span
                          className={
                            cagr > 0.15
                              ? "text-foreground"
                              : cagr < 0
                                ? "text-destructive"
                                : "text-foreground"
                          }
                        >
                          {formatPercent(cagr)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm">
                        {formatPercent(latest.ebitdaMargin)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {company.ai_profile?.ai_fit_score != null ? (
                          <span
                            className={`font-semibold ${
                              company.ai_profile.ai_fit_score >= 75
                                ? "text-foreground"
                                : company.ai_profile.ai_fit_score >= 50
                                  ? "text-foreground"
                                  : "text-destructive"
                            }`}
                          >
                            {company.ai_profile.ai_fit_score}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(company.orgnr)}
                          disabled={removeMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
