import { useParams, Link } from "react-router-dom";
import { useList, useCompaniesBatch, useRemoveFromList } from "@/lib/hooks/figmaQueries";
import {
  getLatestFinancials,
  formatRevenueSEK,
  formatPercent,
  formatNum,
} from "@/lib/utils/figmaCompanyUtils";
import type { Company } from "@/types/figma";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/new/EmptyState";
import { ErrorState } from "@/components/new/ErrorState";
import { ArrowLeft, Trash2 } from "lucide-react";

export default function NewListDetail() {
  const { listId } = useParams<{ listId: string }>();
  const { data: list, isLoading, isError, error, refetch } = useList(listId ?? "");
  const orgnrs = list?.companyIds ?? [];
  const { data: companies = [], isLoading: companiesLoading, isTruncated, isError: companiesError, error: companiesErrorObj, refetch: refetchCompanies } = useCompaniesBatch(orgnrs);
  const removeMutation = useRemoveFromList();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading list...</p>
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
            <Link to="/new/lists">
              <Button variant="outline" size="sm">Back to Lists</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const handleRemove = (orgnr: string) => {
    if (confirm("Remove this company from the list?")) {
      removeMutation.mutate({ listId: list.id, orgnr });
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center gap-4 mb-4">
          <Link to="/new/lists">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{list.name}</h1>
            <p className="text-sm text-gray-600">
              {list.companyIds.length} companies • {list.scope === "team" ? "Shareable" : "Private"}
            </p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-auto px-8 py-4">
        {isTruncated && (
          <div className="mb-4 px-4 py-2 rounded bg-amber-50 border border-amber-200 text-sm text-amber-800">
            Showing first 500 companies for performance. List has {orgnrs.length} total.
          </div>
        )}
        {companiesError ? (
          <ErrorState
            message={companiesErrorObj?.message ?? "Failed to load companies"}
            retry={() => refetchCompanies()}
          />
        ) : companiesLoading && companies.length === 0 ? (
          <p className="text-gray-500">Loading companies...</p>
        ) : companies.length === 0 ? (
          <EmptyState
            title="No companies in this list"
            description="Add companies from Universe or Company detail"
            action={
              <Link to="/new/universe">
                <Button size="sm">Browse Universe</Button>
              </Link>
            }
          />
        ) : (
          <div className="new-card overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">Company</th>
                  <th className="px-4 py-3 text-left">Industry</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                  <th className="px-4 py-3 text-right">EBITDA %</th>
                  <th className="px-4 py-3 text-right">Employees</th>
                  <th className="px-4 py-3 w-16">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {companies.map((company: Company) => {
                  const latest = getLatestFinancials(company);
                  return (
                    <tr key={company.orgnr} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link
                          to={`/new/company/${company.orgnr}`}
                          className="font-medium text-blue-600 hover:text-blue-800"
                        >
                          {company.display_name}
                        </Link>
                        <p className="text-xs text-gray-500">{company.orgnr}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{company.industry_label ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm">
                        {formatRevenueSEK(latest.revenue)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm">
                        {formatPercent(latest.ebitdaMargin)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm">
                        {formatNum(company.employees_latest)}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-800"
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
