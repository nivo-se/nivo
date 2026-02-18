import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useCompaniesBatch, useCompany, useCompanyAIProfile, useCompanyFinancials } from "@/lib/hooks/figmaQueries";
import { useQueryClient } from "@tanstack/react-query";
import {
  calculateRevenueCagr,
  getLatestFinancials,
  formatRevenueSEK,
  formatPercent,
  formatNum,
} from "@/lib/utils/figmaCompanyUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddToListDropdown } from "@/components/default/AddToListDropdown";
import { ErrorState } from "@/components/default/ErrorState";
import {
  ArrowLeft,
  MapPin,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  UserPlus,
  Globe,
  Mail,
  Phone,
  ExternalLink,
} from "lucide-react";
import * as api from "@/lib/services/figmaApi";
import { toast } from "sonner";

export default function CompanyDetail() {
  const { companyId } = useParams<{ companyId: string }>();
  const orgnr = companyId ?? "";
  const queryClient = useQueryClient();
  const { data: batchCompanies } = useCompaniesBatch([orgnr], { autoEnrich: false });
  const { data: universeCompany, isLoading: universeLoading, isError, error, refetch } = useCompany(orgnr, !!orgnr);
  const { data: financialsData } = useCompanyFinancials(orgnr);
  const { data: aiProfile } = useCompanyAIProfile(orgnr);

  const batchCompany = batchCompanies?.find((c) => c.orgnr === orgnr) ?? null;
  const company = batchCompany ?? universeCompany ?? null;
  const isLoading = universeLoading && !company;

  const handleCreateProspect = async () => {
    if (!company?.orgnr) return;
    try {
      await api.createProspect(company.orgnr);
      queryClient.invalidateQueries({ queryKey: ["figma", "prospects"] });
      toast.success("Added to prospects");
    } catch {
      toast.error("Prospects not yet implemented in backend");
    }
  };

  if (isLoading && !company) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading company...</p>
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
            <Link to="/universe">
              <Button variant="outline" size="sm">
                Back to Universe
              </Button>
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
          <h2 className="text-base font-bold text-foreground mb-2">Company not found</h2>
          <Link to="/universe">
            <Button>Back to Universe</Button>
          </Link>
        </div>
      </div>
    );
  }

  const fromCompany = company ? getLatestFinancials(company) : null;
  const fromUniverse = universeCompany ? getLatestFinancials(universeCompany) : null;
  const latest = {
    revenue: fromCompany?.revenue ?? fromUniverse?.revenue ?? null,
    ebitda: fromCompany?.ebitda ?? (fromUniverse?.revenue != null && fromUniverse?.ebitdaMargin != null ? fromUniverse.revenue * fromUniverse.ebitdaMargin : fromUniverse?.ebitda) ?? null,
    ebitdaMargin: fromCompany?.ebitdaMargin ?? fromUniverse?.ebitdaMargin ?? null,
    revenue_cagr: company?.revenue_cagr_3y ?? universeCompany?.revenue_cagr_3y ?? null,
  };
  const cagr = latest.revenue_cagr ?? calculateRevenueCagr(company);
  const cagrNum = cagr ?? 0;
  const financials = useMemo(() => {
    const raw = company.financials ?? financialsData?.financials ?? [];
    return raw.map((f: { year: number; revenue_sek?: number; revenue?: number; ebitda_sek?: number; ebitda?: number; gross_margin?: number; ebitda_margin?: number }) => ({
      year: f.year,
      revenue: f.revenue_sek ?? f.revenue ?? null,
      ebitda: f.ebitda_sek ?? f.ebitda ?? null,
      gross_margin: f.gross_margin ?? 0,
      ebitda_margin: (f.ebitda_margin ?? 0) as number,
    }));
  }, [company.financials, financialsData?.financials]);

  return (
    <div className="h-full overflow-auto bg-muted/40">
      <div className="max-w-7xl mx-auto p-8">
        <div className="mb-6">
          <Link to="/universe">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Universe
            </Button>
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-base font-bold text-foreground mb-2">
                {company.display_name}
              </h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{company.industry_label}</span>
                <span>|</span>
                <span>{company.region ?? "—"}</span>
                {company.website_url && (
                  <>
                    <span>|</span>
                    <a
                      href={company.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Website
                    </a>
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <AddToListDropdown orgnrs={[company.orgnr]} size="default" />
              <Button variant="outline" onClick={handleCreateProspect}>
                <UserPlus className="w-4 h-4 mr-2" />
                Create Prospect
              </Button>
              <Link to={`/ai/run/create?template=default&orgnr=${company.orgnr}`}>
                <Button variant="outline">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Run AI Analysis
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="financials">Financials</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Revenue (Latest)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-base font-bold text-foreground">
                    {formatRevenueSEK(latest.revenue)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    3Y CAGR
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p
                    className={`text-base font-bold ${
                      cagrNum > 0.15 ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {formatPercent(cagr)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    EBITDA Margin
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-base font-bold text-foreground">
                    {formatPercent(latest.ebitdaMargin)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    EBITDA (Latest)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-base font-bold text-foreground">
                    {formatRevenueSEK(
                      latest.ebitda ?? (latest.revenue != null && latest.ebitdaMargin != null
                        ? (latest.revenue * latest.ebitdaMargin)
                        : null)
                    )}
                  </p>
                </CardContent>
              </Card>
            </div>

            {(company.revenue_growth_yoy_latest != null || (financials.length >= 2)) && (
              <Card>
                <CardHeader>
                  <CardTitle>Growth</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Revenue Growth YoY</p>
                      {company.revenue_growth_yoy_latest != null ? (
                        <p className={`text-base font-semibold ${company.revenue_growth_yoy_latest >= 0 ? "text-primary" : "text-destructive"}`}>
                          {(company.revenue_growth_yoy_latest >= 0 ? "+" : "")}{formatPercent(company.revenue_growth_yoy_latest)}
                        </p>
                      ) : financials.length >= 2 ? (
                        (() => {
                          const prev = financials[financials.length - 2];
                          const curr = financials[financials.length - 1];
                          const yoy = prev?.revenue ? ((curr.revenue - prev.revenue) / prev.revenue) : null;
                          return yoy != null ? (
                            <p className={`text-base font-semibold ${yoy >= 0 ? "text-primary" : "text-destructive"}`}>
                              {(yoy >= 0 ? "+" : "")}{formatPercent(yoy)}
                            </p>
                          ) : (
                            <p className="text-muted-foreground">—</p>
                          );
                        })()
                      ) : (
                        <p className="text-muted-foreground">—</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">EBITDA Growth YoY</p>
                      {financials.length >= 2 && financials[financials.length - 2].ebitda ? (
                        (() => {
                          const prev = financials[financials.length - 2];
                          const curr = financials[financials.length - 1];
                          const yoy = ((curr.ebitda - prev.ebitda) / prev.ebitda);
                          return (
                            <p className={`text-base font-semibold ${yoy >= 0 ? "text-primary" : "text-destructive"}`}>
                              {(yoy >= 0 ? "+" : "")}{formatPercent(yoy)}
                            </p>
                          );
                        })()
                      ) : (
                        <p className="text-muted-foreground">—</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Employee Growth YoY</p>
                      <p className="text-muted-foreground">—</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Org nr</p>
                    <p className="text-foreground font-mono">{company.orgnr}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Industry</p>
                    <p className="text-foreground">{company.industry_label}</p>
                  </div>
                  {company.region && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Region</p>
                      <p className="text-foreground">{company.region}</p>
                    </div>
                  )}
                  {company.employees_latest != null && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Employees</p>
                      <p className="text-foreground">~{company.employees_latest}</p>
                    </div>
                  )}
                  {company.equity_ratio_latest != null && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Equity Ratio</p>
                      <p className="text-foreground font-mono">{formatPercent(company.equity_ratio_latest)}</p>
                    </div>
                  )}
                  {company.debt_to_equity_latest != null && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Debt / Equity</p>
                      <p className="text-foreground font-mono">{formatNum(company.debt_to_equity_latest)}</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-6 pt-2 border-t">
                  {company.website_url && (
                    <a
                      href={company.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Globe className="h-4 w-4" />
                      {company.website_url.replace(/^https?:\/\//, "")}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {company.email && (
                    <a
                      href={`mailto:${company.email}`}
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Mail className="h-4 w-4" />
                      {company.email}
                    </a>
                  )}
                  {company.phone && (
                    <a
                      href={`tel:${company.phone.replace(/\s/g, "")}`}
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Phone className="h-4 w-4" />
                      {company.phone}
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>

            {aiProfile?.latest_result ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary" />
                        AI Investment Score
                      </span>
                      <div className="text-right">
                        <span
                          className={`text-base font-bold ${
                            (aiProfile.ai_fit_score ?? 0) >= 75
                              ? "text-primary"
                              : (aiProfile.ai_fit_score ?? 0) >= 50
                                ? "text-foreground"
                                : "text-destructive"
                          }`}
                        >
                          {aiProfile.ai_fit_score ?? 0}
                        </span>
                        <p className="text-sm text-muted-foreground mt-1">
                          {aiProfile.latest_result.recommendation === "strong_fit"
                            ? "Strong Fit"
                            : aiProfile.latest_result.recommendation === "potential_fit"
                              ? "Potential Fit"
                              : aiProfile.latest_result.recommendation === "weak_fit"
                                ? "Weak Fit"
                                : "Pass"}
                        </p>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-foreground whitespace-pre-line leading-relaxed">
                      {aiProfile.latest_result.summary}
                    </p>
                    <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                      <span>
                        Last analyzed:{" "}
                        {new Date(aiProfile.last_analyzed).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
                {(aiProfile.latest_result.strengths?.length > 0 ||
                  aiProfile.latest_result.concerns?.length > 0) && (
                  <div className="grid grid-cols-2 gap-6">
                    {aiProfile.latest_result.strengths?.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-primary">
                            <CheckCircle className="w-5 h-5" />
                            Key Strengths
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {aiProfile.latest_result.strengths.map((s, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                                <span className="text-foreground">{s}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                    {aiProfile.latest_result.concerns?.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="w-5 h-5" />
                            Concerns
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {aiProfile.latest_result.concerns.map((c, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                                <span className="text-foreground">{c}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Sparkles className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground mb-2">No AI analysis available</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Run an AI analysis for investment insights and recommendations
                  </p>
                  <Link to={`/ai/run/create?template=default&orgnr=${company.orgnr}`}>
                    <Button variant="outline" size="sm">
                      <Sparkles className="w-4 h-4 mr-2" />
                      Run AI Analysis
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="financials" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Financial History</CardTitle>
              </CardHeader>
              <CardContent>
                {financials.length === 0 ? (
                  <p className="text-muted-foreground py-8 text-center">
                    No multi-year financial data available. Latest: Revenue {formatRevenueSEK(latest.revenue)},
                    EBITDA Margin {formatPercent(latest.ebitdaMargin)}.
                  </p>
                ) : (
                  <table className="w-full">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                          Year
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">
                          Revenue (SEK)
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">
                          EBITDA (SEK)
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">
                          Gross Margin
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">
                          EBITDA Margin
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">
                          YoY Growth
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {financials.map((fin, i) => {
                        const yoyGrowth =
                          i > 0 && financials[i - 1].revenue
                            ? ((fin.revenue - financials[i - 1].revenue) /
                                financials[i - 1].revenue) *
                              100
                            : null;
                        return (
                          <tr key={fin.year} className="hover:bg-muted/40">
                            <td className="px-4 py-3 font-medium text-foreground">
                              {fin.year}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-foreground">
                              {formatRevenueSEK(fin.revenue)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-foreground">
                              {formatRevenueSEK(fin.ebitda)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-foreground">
                              {((fin.gross_margin ?? 0) * 100).toFixed(1)}%
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-foreground">
                              {((fin.ebitda_margin ?? 0) * 100).toFixed(1)}%
                            </td>
                            <td className="px-4 py-3 text-right font-mono">
                              {yoyGrowth != null ? (
                                <span
                                  className={
                                    yoyGrowth > 0 ? "text-primary" : "text-destructive"
                                  }
                                >
                                  {yoyGrowth > 0 ? "+" : ""}
                                  {yoyGrowth.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
