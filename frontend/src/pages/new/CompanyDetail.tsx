import { useParams, Link } from "react-router-dom";
import { useCompany, useCompanyAIProfile } from "@/lib/hooks/figmaQueries";
import {
  calculateRevenueCagr,
  getLatestFinancials,
  formatRevenueSEK,
  formatPercent,
  formatNum,
} from "@/lib/utils/figmaCompanyUtils";
import { Button } from "@/components/ui/button";
import { AddToListDropdown } from "@/components/new/AddToListDropdown";
import { ErrorState } from "@/components/new/ErrorState";
import { ArrowLeft } from "lucide-react";

export default function NewCompanyDetail() {
  const { companyId } = useParams<{ companyId: string }>();
  const { data: company, isLoading, isError, error, refetch } = useCompany(companyId ?? "");
  const { data: aiProfile } = useCompanyAIProfile(companyId ?? "");

  if (isLoading && !company) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading company...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-8">
        <ErrorState
          message={error?.message ?? "Failed to load company"}
          retry={() => refetch()}
          action={
            <Link to="/new/universe">
              <Button variant="outline" size="sm">Back to Universe</Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Company not found</h2>
          <Link to="/new/universe">
            <Button>Back to Universe</Button>
          </Link>
        </div>
      </div>
    );
  }

  const latest = getLatestFinancials(company);
  const cagr = calculateRevenueCagr(company);

  return (
    <div className="h-full overflow-auto new-bg">
      <div className="max-w-4xl mx-auto px-8 py-8">
        <Link to="/new/universe">
          <Button variant="ghost" size="sm" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Universe
          </Button>
        </Link>
        <div className="new-card p-8">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{company.display_name}</h1>
              <p className="text-sm text-gray-500">{company.orgnr} • {company.industry_label}</p>
            </div>
            <AddToListDropdown orgnrs={[company.orgnr]} />
          </div>
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-gray-600">Revenue</p>
              <p className="font-mono font-medium">{formatRevenueSEK(latest.revenue)}</p>
            </div>
            <div>
              <p className="text-gray-600">EBITDA Margin</p>
              <p className="font-mono font-medium">{formatPercent(latest.ebitdaMargin)}</p>
            </div>
            <div>
              <p className="text-gray-600">3Y CAGR</p>
              <p className="font-mono font-medium">{formatPercent(cagr)}</p>
            </div>
            <div>
              <p className="text-gray-600">Employees</p>
              <p className="font-mono font-medium">{formatNum(company.employees_latest)}</p>
            </div>
          </div>
          {aiProfile && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="font-medium text-gray-900 mb-2">AI Profile</h3>
              <p className="text-sm text-gray-600">Score: {aiProfile.ai_fit_score}/100</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
