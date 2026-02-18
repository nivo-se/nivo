import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddToListDropdown } from "@/components/default/AddToListDropdown";
import {
  useCompaniesBatch,
  useCompany,
  useCompanyFinancials,
} from "@/lib/hooks/apiQueries";
import {
  getLatestFinancials,
  deriveFinancialsFromYears,
  formatRevenueSEK,
  formatPercent,
} from "@/lib/utils/companyMetrics";
import { ExternalLink, Loader2, Globe, MapPin, Users, Mail, Phone } from "lucide-react";

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
  const { data: companies, isLoading: batchLoading, isError: batchError } =
    useCompaniesBatch(open ? [orgnr] : [], { autoEnrich: false });
  const { data: universeCompany, isLoading: universeLoading } = useCompany(
    orgnr,
    open
  );
  const { data: financialsData } = useCompanyFinancials(orgnr, open);

  const company =
    companies?.find((c) => c.orgnr === orgnr) ?? universeCompany ?? null;
  const isLoading = batchLoading || (batchError && universeLoading);
  const isError = batchError && !universeCompany;

  const fromCompany = company ? getLatestFinancials(company) : null;
  const fromUniverse = universeCompany ? getLatestFinancials(universeCompany) : null;
  const fromFinancials = financialsData?.financials?.length
    ? deriveFinancialsFromYears(financialsData.financials)
    : null;
  const revenue =
    fromCompany?.revenue ?? fromUniverse?.revenue ?? fromFinancials?.revenue ?? null;
  const ebitdaMargin =
    fromCompany?.ebitdaMargin ??
    fromUniverse?.ebitdaMargin ??
    fromFinancials?.ebitdaMargin ??
    null;
  const revenueCagr =
    company?.revenue_cagr_3y ??
    universeCompany?.revenue_cagr_3y ??
    fromFinancials?.revenue_cagr ??
    null;
  const ebitda =
    fromCompany?.ebitda ??
    (revenue != null && ebitdaMargin != null ? revenue * ebitdaMargin : null);
  const financials = financialsData?.financials ?? [];
  const latestYear = financials[0]?.year ?? new Date().getFullYear();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg border border-border bg-card text-sm text-card-foreground"
        aria-describedby="company-snapshot-desc"
      >
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg font-semibold">
            Company Snapshot
          </DialogTitle>
          <DialogDescription id="company-snapshot-desc" className="sr-only">
            Quick overview of company details, financials, and actions
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : isError || !company ? (
          <p className="py-4 text-muted-foreground">
            Could not load company details.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Header: company name + attributes */}
            <div>
              <h3 className="font-semibold text-foreground">
                {company.display_name}
              </h3>
              <p className="text-muted-foreground">
                {company.legal_name !== company.display_name
                  ? company.legal_name
                  : company.industry_label}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge
                  variant="secondary"
                  className="gap-1 font-normal"
                >
                  <Globe className="h-3 w-3" />
                  {company.industry_label}
                </Badge>
                {company.region && (
                  <Badge variant="secondary" className="gap-1 font-normal">
                    <MapPin className="h-3 w-3" />
                    {company.region}
                  </Badge>
                )}
                {company.employees_latest != null && (
                  <Badge variant="secondary" className="gap-1 font-normal">
                    <Users className="h-3 w-3" />
                    ~{company.employees_latest} employees
                  </Badge>
                )}
              </div>
            </div>

            {/* Key metrics */}
            <div>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Key Metrics ({latestYear})
              </h4>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Revenue</p>
                  <p className="font-mono text-sm tabular-nums font-medium">
                    {formatRevenueSEK(revenue)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">EBITDA</p>
                  <p className="font-mono text-sm tabular-nums font-medium">
                    {formatRevenueSEK(ebitda)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">3Y CAGR</p>
                  <p className="font-mono text-sm tabular-nums font-medium">
                    {formatPercent(revenueCagr)} Growth
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">EBITDA Margin</p>
                  <p className="font-mono text-sm tabular-nums font-medium">
                    {formatPercent(ebitdaMargin)}
                  </p>
                </div>
              </div>
            </div>

            {/* About + Contact (web, email, phone) */}
            <div className="space-y-2 border-t border-border pt-3">
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                About
              </h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                <div>
                  <span className="text-muted-foreground">Org.nr</span>{" "}
                  <span className="font-mono">{company.orgnr}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Currency</span> SEK
                </div>
              </div>
              <div className="flex flex-wrap gap-4 pt-1">
                {company.website_url && (
                  <a
                    href={company.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-foreground hover:underline"
                    onClick={() => onOpenChange(false)}
                  >
                    <Globe className="h-4 w-4" />
                    {company.website_url.replace(/^https?:\/\//, "")}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {company.email && (
                  <a
                    href={`mailto:${company.email}`}
                    className="inline-flex items-center gap-2 text-sm text-foreground hover:underline"
                    onClick={() => onOpenChange(false)}
                  >
                    <Mail className="h-4 w-4" />
                    {company.email}
                  </a>
                )}
                {company.phone && (
                  <a
                    href={`tel:${company.phone.replace(/\s/g, "")}`}
                    className="inline-flex items-center gap-2 text-sm text-foreground hover:underline"
                    onClick={() => onOpenChange(false)}
                  >
                    <Phone className="h-4 w-4" />
                    {company.phone}
                  </a>
                )}
              </div>
            </div>

            {/* Financial history table */}
            {financials.length > 0 && (
              <div className="space-y-2 border-t border-border pt-3">
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Financial Snapshot ({financials.length}-Year History)
                </h4>
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-3 py-2 text-left font-medium">Year</th>
                        <th className="px-3 py-2 text-right font-medium">
                          Revenue (M SEK)
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          EBITDA (M SEK)
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          EBITDA Margin
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {financials.slice(0, 5).map((f) => (
                        <tr
                          key={f.year}
                          className="border-b border-border/50 last:border-0"
                        >
                          <td className="px-3 py-2">{f.year}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums">
                            {f.revenue_sek != null
                              ? (f.revenue_sek / 1_000_000).toFixed(1)
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums">
                            {f.ebitda_sek != null
                              ? (f.ebitda_sek / 1_000_000).toFixed(1)
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums">
                            {f.ebitda_margin != null
                              ? `${(f.ebitda_margin <= 1 ? f.ebitda_margin * 100 : f.ebitda_margin).toFixed(1)}%`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
              <Link
                to={`/company/${company.orgnr}`}
                onClick={() => onOpenChange(false)}
                className="inline-flex items-center gap-2 text-sm text-foreground hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                View Full Profile
              </Link>
              <div className="flex items-center gap-2">
                <AddToListDropdown orgnrs={[company.orgnr]} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
