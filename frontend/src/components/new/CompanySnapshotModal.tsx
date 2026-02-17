import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AddToListDropdown } from "@/components/new/AddToListDropdown";
import { useCompany } from "@/lib/hooks/figmaQueries";
import {
  getLatestFinancials,
  formatRevenueSEK,
  formatPercent,
  calculateRevenueCagr,
} from "@/lib/utils/figmaCompanyUtils";
import { ExternalLink, Loader2 } from "lucide-react";

interface CompanySnapshotModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgnr: string;
}

export function CompanySnapshotModal({
  open,
  onOpenChange,
  orgnr,
}: CompanySnapshotModalProps) {
  const { data: company, isLoading, isError } = useCompany(orgnr);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border border-gray-200 bg-white text-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-gray-900">
            Company Snapshot
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : isError || !company ? (
          <p className="text-gray-600 py-4">Could not load company details.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-900">{company.display_name}</h3>
              <p className="text-gray-600 mt-0.5">{company.industry_label}</p>
              <p className="text-gray-500 text-xs">{company.region ?? "—"}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="border border-gray-200 rounded-md p-3">
                <p className="text-xs text-gray-500">Revenue</p>
                <p className="font-mono tabular-nums text-gray-900">
                  {formatRevenueSEK(getLatestFinancials(company).revenue)}
                </p>
              </div>
              <div className="border border-gray-200 rounded-md p-3">
                <p className="text-xs text-gray-500">3Y CAGR</p>
                <p className="font-mono tabular-nums text-gray-900">
                  {formatPercent(calculateRevenueCagr(company))}
                </p>
              </div>
              <div className="border border-gray-200 rounded-md p-3">
                <p className="text-xs text-gray-500">EBITDA Margin</p>
                <p className="font-mono tabular-nums text-gray-900">
                  {formatPercent(getLatestFinancials(company).ebitdaMargin)}
                </p>
              </div>
              <div className="border border-gray-200 rounded-md p-3">
                <p className="text-xs text-gray-500">Org.nr</p>
                <p className="font-mono text-gray-700">{company.orgnr}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
              <AddToListDropdown orgnrs={[company.orgnr]} />
              <Link to={`/company/${company.orgnr}`} onClick={() => onOpenChange(false)}>
                <Button variant="outline" size="sm" className="h-8">
                  <ExternalLink className="w-3 h-3 mr-1.5" />
                  View Full Profile
                </Button>
              </Link>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
