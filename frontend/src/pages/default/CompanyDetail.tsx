import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useCompaniesBatch, useCompany, useCompanyAIProfile, useCompanyFinancials } from "@/lib/hooks/apiQueries";
import { useQueryClient } from "@tanstack/react-query";
import {
  formatRevenueSEK,
  formatPercent,
  formatNum,
  formatThousands,
} from "@/lib/utils/companyMetrics";
import { buildCompanyOverviewModel } from "@/lib/utils/companyOverviewModel";
import type { FullFinancialLineItem } from "@/lib/api/companies/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
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
  Search,
  Info,
} from "lucide-react";
import { upsertProspect } from "@/lib/api/prospects/service";
import { toast } from "sonner";

const SECTION_LABELS: Record<string, string> = {
  revenue: "Revenue",
  costs: "Costs",
  profit: "Profit",
  fixed_assets: "Fixed assets",
  current_assets: "Current assets",
  assets: "Assets",
  equity: "Equity",
  liabilities: "Liabilities",
};

function FullFinancialTable({
  rows,
  unitMode,
  periodOrder,
  yearsLimit = 7,
  deltaMode = "values",
  highlightYear,
  highlightRow,
  onYearClick,
  onRowHover,
  rowSearch,
  onCopy,
}: {
  rows: FullFinancialLineItem[];
  unitMode: "tSEK" | "MSEK";
  periodOrder: string[];
  yearsLimit?: number;
  deltaMode?: "values" | "yoy_pct" | "yoy_delta";
  highlightYear?: string | null;
  highlightRow?: string | null;
  onYearClick?: (p: string) => void;
  onRowHover?: (key: string | null) => void;
  rowSearch?: string;
  onCopy?: (text: string) => void;
}) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    () => new Set(["costs", "fixed_assets", "current_assets", "liabilities"])
  );
  const toggleSection = (s: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };
  const periods = useMemo(() => periodOrder.slice(0, yearsLimit), [periodOrder, yearsLimit]);
  const yoyPct = (v: number | null | undefined, prev: number | null | undefined): number | null => {
    if (v == null || prev == null || prev === 0) return null;
    return ((v - prev) / prev) * 100;
  };
  const rowSearchLower = (rowSearch ?? "").toLowerCase().trim();
  const sections = useMemo(() => {
    const map = new Map<string, FullFinancialLineItem[]>();
    for (const r of rows) {
      if (rowSearchLower && !r.label_sv.toLowerCase().includes(rowSearchLower)) continue;
      const s = r.section || "other";
      if (!map.has(s)) map.set(s, []);
      map.get(s)!.push(r);
    }
    return map;
  }, [rows, rowSearchLower]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[400px] border-collapse">
        <thead className="bg-muted/40 sticky top-0 z-10">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-foreground whitespace-nowrap sticky left-0 z-20 bg-muted/80 backdrop-blur-sm">Line item</th>
            {periods.map((p) => (
              <th
                key={p}
                className={`px-4 py-3 text-right text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-muted/60 ${highlightYear === p ? "ring-1 ring-primary bg-primary/10" : "text-foreground"}`}
                onClick={() => onYearClick?.(p)}
              >
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {Array.from(sections.entries()).map(([section, sectionRows]) => {
            const hasDetail = sectionRows.some((r) => !r.bold);
            const isCollapsed = collapsedSections.has(section) && hasDetail;
            return (
              <Fragment key={section}>
                {hasDetail && (
                  <tr
                    className="cursor-pointer hover:bg-muted/40 bg-muted/20"
                    onClick={() => toggleSection(section)}
                  >
                    <td className="px-4 py-2 text-xs font-medium text-muted-foreground sticky left-0 z-10 bg-muted/80 whitespace-nowrap">
                      {SECTION_LABELS[section] ?? section} {isCollapsed ? "▶" : "▼"}
                    </td>
                    <td colSpan={periods.length} />
                  </tr>
                )}
                {sectionRows
                  .filter((row) => !isCollapsed || row.bold)
                  .map((row) => {
                    const latestVal = row.years?.[periods[0] ?? ""];
                    const prevVal = periods[1] ? row.years?.[periods[1]] : null;
                    const yoy = yoyPct(latestVal, prevVal);
                    return (
                      <tr
                        key={row.key}
                        className={`hover:bg-muted/40 ${row.bold ? "bg-muted/20 font-semibold border-t border-border" : ""} ${highlightRow === row.key ? "ring-1 ring-primary/50 bg-primary/5" : ""}`}
                        onMouseEnter={() => onRowHover?.(row.key)}
                        onMouseLeave={() => onRowHover?.(null)}
                      >
                        <td className={`px-4 py-2 text-left text-sm text-foreground whitespace-nowrap sticky left-0 z-10 ${row.bold ? "bg-muted/30" : "bg-background"}`}>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1 cursor-help">
                                  {row.label_sv}
                                  <Info className="h-3 w-3 text-muted-foreground" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Source: {row.source}</p>
                                <p>Coverage: {Object.keys(row.years || {}).length} years</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          {deltaMode !== "values" && yoy != null && (
                            <span className={`ml-2 text-xs ${yoy > 0 ? "text-primary" : yoy < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                              {yoy > 0 ? "+" : ""}{yoy.toFixed(1)}%
                            </span>
                          )}
                        </td>
                        {periods.map((p, idx) => {
                          const v = row.years?.[p];
                          const prevV = idx < periods.length - 1 ? row.years?.[periods[idx + 1] ?? ""] : null;
                          const cellYoY = yoyPct(v, prevV);
                          const isAnomaly = cellYoY != null && Math.abs(cellYoY) > 25;
                          let display = "—";
                          if (deltaMode === "values") {
                            display = v != null ? formatThousands(v, unitMode === "MSEK") : "—";
                          } else if (cellYoY != null) {
                            display = deltaMode === "yoy_pct" ? `${cellYoY > 0 ? "+" : ""}${cellYoY.toFixed(1)}%` : `${cellYoY > 0 ? "+" : ""}${cellYoY.toFixed(1)}pp`;
                          }
                          return (
                            <td
                              key={p}
                              className={`px-4 py-2 text-right font-mono text-sm whitespace-nowrap cursor-pointer hover:bg-muted/60 ${highlightYear === p ? "bg-primary/5" : ""} ${isAnomaly ? "bg-amber-500/10" : "text-foreground"}`}
                              onClick={() => {
                                onYearClick?.(p);
                                const toCopy = deltaMode === "values" && v != null
                                  ? formatThousands(v, unitMode === "MSEK") + (unitMode === "MSEK" ? " M" : "")
                                  : String(display);
                                onCopy?.(toCopy);
                              }}
                            >
                              {display}{unitMode === "MSEK" && v != null && deltaMode === "values" ? " M" : ""}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

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

  const overviewModel = useMemo(
    () => (company ? buildCompanyOverviewModel(company, financialsData) : null),
    [company, financialsData]
  );

  const financials = useMemo(() => {
    const to01 = (m: number | null | undefined) => {
      if (m == null || Number.isNaN(m)) return 0;
      return m > 1 ? m / 100 : m;
    };
    const raw = financialsData?.financials ?? company?.financials ?? [];
    return raw.map((f: { year: number; revenue_sek?: number; revenue?: number; ebitda_sek?: number; ebitda?: number; ebit_sek?: number; ebit?: number; profit_sek?: number; profit?: number; gross_margin?: number; ebitda_margin?: number; ebit_margin?: number; net_margin?: number }) => ({
      year: f.year,
      revenue: f.revenue_sek ?? f.revenue ?? null,
      ebitda: f.ebitda_sek ?? f.ebitda ?? null,
      ebit: f.ebit_sek ?? f.ebit ?? null,
      profit: f.profit_sek ?? f.profit ?? null,
      gross_margin: to01(f.gross_margin) || 0,
      ebitda_margin: to01(f.ebitda_margin),
      ebit_margin: to01(f.ebit_margin),
      net_margin: to01(f.net_margin),
    }));
  }, [financialsData?.financials, company?.financials]);

  const [chartMode, setChartMode] = useState<"revenue_ebitda" | "ebit_profit">("revenue_ebitda");
  const [unitMode, setUnitMode] = useState<"tSEK" | "MSEK">("tSEK");
  const [deltaMode, setDeltaMode] = useState<"values" | "yoy_pct" | "yoy_delta">("values");
  const [highlightYear, setHighlightYear] = useState<string | null>(null);
  const [highlightRow, setHighlightRow] = useState<string | null>(null);
  const [trendMode, setTrendMode] = useState<"revenue_ebitda" | "ebit_profit" | "assets_equity">("revenue_ebitda");
  const [rowSearch, setRowSearch] = useState("");
  const pnlRef = useRef<HTMLDivElement>(null);
  const balanceRef = useRef<HTMLDivElement>(null);
  const handleCopy = useCallback((text: string) => {
    navigator.clipboard?.writeText(text).then(() => toast.success("Copied to clipboard")).catch(() => {});
  }, []);

  const handleCreateProspect = async () => {
    if (!company?.orgnr) return;
    try {
      await upsertProspect(company.orgnr);
      queryClient.invalidateQueries({ queryKey: ["app", "prospects"] });
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

  if (!company || !overviewModel) {
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

        {/* Header strip - above tabs */}
        <Card className="mb-4">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{company.display_name}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {company.orgnr}
                  {company.industry_label && ` • ${company.industry_label}`}
                  {company.region && ` • ${company.region}`}
                  {company.municipality && company.municipality !== company.region && ` • ${company.municipality}`}
                </p>
                <div className="flex flex-wrap gap-4 mt-2 text-sm">
                  {company.website_url && (
                    <a href={company.website_url} target="_blank" rel="noopener noreferrer" className="link-primary inline-flex items-center gap-1.5">
                      <Globe className="h-4 w-4" />
                      {company.website_url.replace(/^https?:\/\//, "")}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {company.email && (
                    <a href={`mailto:${company.email}`} className="link-primary inline-flex items-center gap-1.5">
                      <Mail className="h-4 w-4" />
                      {company.email}
                    </a>
                  )}
                  {company.phone && (
                    <a href={`tel:${company.phone.replace(/\s/g, "")}`} className="link-primary inline-flex items-center gap-1.5">
                      <Phone className="h-4 w-4" />
                      {company.phone}
                    </a>
                  )}
                </div>
              </div>
              {company.last_enriched_at && (
                <p className="text-xs text-muted-foreground">Last updated: {new Date(company.last_enriched_at).toLocaleDateString()}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="financials">Financials</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Company info (top of financials) */}
            <div className="flex flex-wrap gap-6 text-xs text-muted-foreground">
              <span><span className="font-medium text-foreground">Org nr</span> {company.orgnr}</span>
              <span><span className="font-medium text-foreground">Industry</span> {company.industry_label}</span>
              {company.employees_latest != null && (
                <span><span className="font-medium text-foreground">Employees</span> ~{company.employees_latest}</span>
              )}
            </div>

            {/* B. Snapshot grid (2 rows) - compact metric boxes */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">Latest FY{overviewModel.latestFY.year}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <Card className="p-2 rounded-lg shadow-none">
                  <p className="text-[11px] text-muted-foreground leading-tight">Revenue</p>
                  <p className="text-xs font-semibold text-foreground leading-tight tabular-nums">{formatRevenueSEK(overviewModel.latestFY.revenue)}</p>
                </Card>
                <Card className="p-2 rounded-lg shadow-none">
                  <p className="text-[11px] text-muted-foreground leading-tight">EBITDA</p>
                  <p className="text-xs font-semibold text-foreground leading-tight tabular-nums">{formatRevenueSEK(overviewModel.latestFY.ebitda)}</p>
                </Card>
                <Card className="p-2 rounded-lg shadow-none">
                  <p className="text-[11px] text-muted-foreground leading-tight">EBIT</p>
                  <p className="text-xs font-semibold text-foreground leading-tight tabular-nums">{formatRevenueSEK(overviewModel.latestFY.ebit)}</p>
                </Card>
                <Card className="p-2 rounded-lg shadow-none">
                  <p className="text-[11px] text-muted-foreground leading-tight">Net Profit</p>
                  <p className="text-xs font-semibold text-foreground leading-tight tabular-nums">{formatRevenueSEK(overviewModel.latestFY.profit)}</p>
                </Card>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <Card className="p-2 rounded-lg shadow-none">
                  <p className="text-[11px] text-muted-foreground leading-tight">EBITDA Margin</p>
                  <p className="text-xs font-semibold text-foreground leading-tight tabular-nums">{formatPercent(overviewModel.latestFY.ebitdaMargin)}</p>
                </Card>
                <Card className="p-2 rounded-lg shadow-none">
                  <p className="text-[11px] text-muted-foreground leading-tight">EBIT Margin</p>
                  <p className="text-xs font-semibold text-foreground leading-tight tabular-nums">{formatPercent(overviewModel.latestFY.ebitMargin)}</p>
                </Card>
                <Card className="p-2 rounded-lg shadow-none">
                  <p className="text-[11px] text-muted-foreground leading-tight">Net Margin</p>
                  <p className="text-xs font-semibold text-foreground leading-tight tabular-nums">{formatPercent(overviewModel.latestFY.netMargin)}</p>
                </Card>
                <Card className="p-2 rounded-lg shadow-none">
                  <p className="text-[11px] text-muted-foreground leading-tight">Revenue CAGR (3y)</p>
                  <p className="text-xs font-semibold text-foreground leading-tight tabular-nums">
                    {formatPercent(overviewModel.growth.cagr3y)}
                  </p>
                </Card>
                {overviewModel.growth.cagr5y != null && (
                  <Card className="p-2 rounded-lg shadow-none">
                    <p className="text-[11px] text-muted-foreground leading-tight">Revenue CAGR (5y)</p>
                    <p className="text-xs font-semibold text-foreground leading-tight tabular-nums">
                      {formatPercent(overviewModel.growth.cagr5y)}
                    </p>
                  </Card>
                )}
                {aiProfile != null && (aiProfile.ai_fit_score != null || aiProfile.latest_result) && (
                  <Card className="p-2 rounded-lg shadow-none">
                    <p className="text-[11px] text-muted-foreground leading-tight">AI Fit Score</p>
                    <p
                      className={`text-xs font-semibold leading-tight tabular-nums ${
                        (aiProfile.ai_fit_score ?? 0) >= 75
                          ? "text-primary"
                          : (aiProfile.ai_fit_score ?? 0) >= 50
                            ? "text-foreground"
                            : "text-destructive"
                      }`}
                    >
                      {aiProfile.ai_fit_score != null ? aiProfile.ai_fit_score : "—"}
                    </p>
                    {aiProfile.latest_result && (
                      <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                        {aiProfile.latest_result.recommendation === "strong_fit"
                          ? "Strong Fit"
                          : aiProfile.latest_result.recommendation === "potential_fit"
                            ? "Potential Fit"
                            : aiProfile.latest_result.recommendation === "weak_fit"
                              ? "Weak Fit"
                              : "Pass"}
                      </p>
                    )}
                  </Card>
                )}
              </div>
            </div>

            {/* C. Trend area (4y chart) */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Financial Trend</CardTitle>
                  <div className="flex gap-1">
                    <Button
                      variant={chartMode === "revenue_ebitda" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setChartMode("revenue_ebitda")}
                    >
                      Revenue & EBITDA
                    </Button>
                    <Button
                      variant={chartMode === "ebit_profit" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setChartMode("ebit_profit")}
                    >
                      EBIT & Net Profit
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {overviewModel.series.length < 3 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Insufficient history (need at least 3 years of data)</p>
                ) : (
                  <div className="h-[240px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={[...overviewModel.series].reverse().map((s) => ({
                          ...s,
                          revenue: s.revenue ?? 0,
                          ebitda: s.ebitda ?? 0,
                          ebit: s.ebit ?? 0,
                          profit: s.profit ?? 0,
                        }))}
                        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="2 2" stroke="hsl(var(--border))" />
                        <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
                        <RechartsTooltip formatter={(v: number) => `${(v / 1_000_000).toFixed(1)} M SEK`} labelFormatter={(label) => `FY ${label}`} />
                        <Legend />
                        {chartMode === "revenue_ebitda" ? (
                          <>
                            <Line type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                            <Line type="monotone" dataKey="ebitda" name="EBITDA" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                          </>
                        ) : (
                          <>
                            <Line type="monotone" dataKey="ebit" name="EBIT" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                            <Line type="monotone" dataKey="profit" name="Net Profit" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                          </>
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* D. Efficiency & Balance - compact */}
            <div className="grid gap-2 sm:grid-cols-2">
              <Card className="p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Efficiency</p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Revenue / employee</p>
                    <p className="font-mono text-foreground">
                      {overviewModel.efficiency.revenuePerEmployee != null ? formatRevenueSEK(overviewModel.efficiency.revenuePerEmployee) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">EBITDA / employee</p>
                    <p className="font-mono text-foreground">
                      {overviewModel.efficiency.ebitdaPerEmployee != null ? formatRevenueSEK(overviewModel.efficiency.ebitdaPerEmployee) : "—"}
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Balance Sheet</p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Equity ratio</p>
                    <p className="font-mono text-foreground">{formatPercent(overviewModel.balance.equityRatio)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Debt / equity</p>
                    <p className="font-mono text-foreground">{formatNum(overviewModel.balance.debtToEquity)}</p>
                  </div>
                </div>
              </Card>
            </div>

            {import.meta.env.DEV && (
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="data-debug">
                  <AccordionTrigger className="text-sm font-medium text-muted-foreground">
                    Data Debug (dev only)
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 text-xs font-mono">
                      <div>
                        <p className="font-semibold text-foreground mb-1">Latest FY record chosen</p>
                        <p className="text-muted-foreground">
                          Year: {overviewModel.latestFY.year}
                          {overviewModel.latestFY.period != null ? `, Period: ${overviewModel.latestFY.period}` : " (period not from API)"}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground mb-1">Source map (metric → source)</p>
                        <pre className="bg-muted/50 p-3 rounded overflow-x-auto">
                          {JSON.stringify(overviewModel.sourceMap ?? {}, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

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

          <TabsContent value="financials" className="mt-6 space-y-6">
            {/* Financial Snapshot strip */}
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs font-medium text-muted-foreground mb-3">Latest FY{overviewModel.latestFY.year} — Quick snapshot</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Revenue</p>
                    <p className="font-semibold">{formatRevenueSEK(overviewModel.latestFY.revenue)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">EBITDA</p>
                    <p className="font-semibold">{formatRevenueSEK(overviewModel.latestFY.ebitda)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">EBIT</p>
                    <p className="font-semibold">{formatRevenueSEK(overviewModel.latestFY.ebit)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Net Profit</p>
                    <p className="font-semibold">{formatRevenueSEK(overviewModel.latestFY.profit)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">EBITDA margin</p>
                    <p className="font-semibold">{formatPercent(overviewModel.latestFY.ebitdaMargin)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Net margin</p>
                    <p className="font-semibold">{formatPercent(overviewModel.latestFY.netMargin)}</p>
                  </div>
                  {overviewModel.balance.equityRatio != null && (
                    <div>
                      <p className="text-muted-foreground text-xs">Equity ratio</p>
                      <p className="font-semibold">{formatPercent(overviewModel.balance.equityRatio)}</p>
                    </div>
                  )}
                  {overviewModel.balance.debtToEquity != null && (
                    <div>
                      <p className="text-muted-foreground text-xs">Debt / Equity</p>
                      <p className="font-semibold">{formatNum(overviewModel.balance.debtToEquity)}</p>
                    </div>
                  )}
                  {company?.employees_latest != null && (
                    <div>
                      <p className="text-muted-foreground text-xs">Employees</p>
                      <p className="font-semibold">~{company.employees_latest}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Full P&L and Balance Sheet tables */}
            {financialsData?.full?.pnl?.length || financialsData?.full?.balance?.length ? (
              <div className="space-y-6">
                {/* Trend panel */}
                {(() => {
                  const pnlPeriods = (financialsData.full?.pnl?.[0]?.years && Object.keys(financialsData.full.pnl[0].years)) || [];
                  const periodOrder = [...pnlPeriods].sort().reverse();
                  const getVal = (key: string, p: string) => financialsData.full?.pnl?.find((r) => r.key === key)?.years?.[p];
                  const getBal = (key: string, p: string) => financialsData.full?.balance?.find((r) => r.key === key)?.years?.[p];
                  const series = periodOrder.map((p) => ({
                    period: p,
                    revenue: getVal("nettoomsattning", p) ?? getVal("ovrig_omsattning", p),
                    ebitda: getVal("rorelseresultat", p),
                    ebit: getVal("rorelseresultat_efter_avskrivningar", p),
                    profit: getVal("arets_resultat", p),
                    assets: getBal("summa_tillgangar", p),
                    equity: getBal("eget_kapital", p),
                  }));
                  const hasTrendData = series.some((s) => s.revenue != null || s.ebitda != null || s.assets != null);
                  if (!hasTrendData) return null;
                  return (
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">Financial Trend</CardTitle>
                          <div className="flex gap-1">
                            <Button variant={trendMode === "revenue_ebitda" ? "secondary" : "ghost"} size="sm" onClick={() => setTrendMode("revenue_ebitda")}>
                              Revenue & EBITDA
                            </Button>
                            <Button variant={trendMode === "ebit_profit" ? "secondary" : "ghost"} size="sm" onClick={() => setTrendMode("ebit_profit")}>
                              EBIT & Net Profit
                            </Button>
                            <Button variant={trendMode === "assets_equity" ? "secondary" : "ghost"} size="sm" onClick={() => setTrendMode("assets_equity")}>
                              Assets & Equity
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[200px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={series}
                              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                            >
                              <CartesianGrid strokeDasharray="2 2" stroke="hsl(var(--border))" />
                              <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`)} />
                              <RechartsTooltip formatter={(v: number) => (v != null ? (Number(v) >= 1e6 ? `${(Number(v) / 1e6).toFixed(1)} M SEK` : `${(Number(v) / 1000).toFixed(0)} tSEK`) : "—")} labelFormatter={(l) => l} />
                              <Legend />
                              {trendMode === "revenue_ebitda" && (
                                <>
                                  <Line type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                                  <Line type="monotone" dataKey="ebitda" name="EBITDA" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                                </>
                              )}
                              {trendMode === "ebit_profit" && (
                                <>
                                  <Line type="monotone" dataKey="ebit" name="EBIT" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                                  <Line type="monotone" dataKey="profit" name="Net Profit" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                                </>
                              )}
                              {trendMode === "assets_equity" && (
                                <>
                                  <Line type="monotone" dataKey="assets" name="Total Assets" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                                  <Line type="monotone" dataKey="equity" name="Equity" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                                </>
                              )}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <h3 className="text-base font-semibold">P&L and Balance Sheet</h3>
                    <div className="relative w-48">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search rows..." value={rowSearch} onChange={(e) => setRowSearch(e.target.value)} className="pl-8 h-8 text-sm" />
                    </div>
                  </div>
                  <div className="flex gap-2 ml-auto">
                    <div className="flex gap-1">
                      <Button variant={deltaMode === "values" ? "secondary" : "ghost"} size="sm" onClick={() => setDeltaMode("values")}>Values</Button>
                      <Button variant={deltaMode === "yoy_pct" ? "secondary" : "ghost"} size="sm" onClick={() => setDeltaMode("yoy_pct")}>YoY %</Button>
                      <Button variant={deltaMode === "yoy_delta" ? "secondary" : "ghost"} size="sm" onClick={() => setDeltaMode("yoy_delta")}>YoY Δ</Button>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant={unitMode === "tSEK" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setUnitMode("tSEK")}
                      >
                        tSEK
                      </Button>
                      <Button
                        variant={unitMode === "MSEK" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setUnitMode("MSEK")}
                      >
                        MSEK
                      </Button>
                    </div>
                  </div>
                </div>

                {/* P&L (Resultaträkning) – always show section; table or empty state */}
                <Card ref={pnlRef}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Resultaträkning</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(financialsData.full.pnl?.length ?? 0) > 0 ? (
                      <FullFinancialTable
                        rows={financialsData.full.pnl ?? []}
                        unitMode={unitMode}
                        yearsLimit={7}
                        deltaMode={deltaMode}
                        highlightYear={highlightYear}
                        highlightRow={highlightRow}
                        onYearClick={(p) => setHighlightYear((prev) => (prev === p ? null : p))}
                        onRowHover={setHighlightRow}
                        rowSearch={rowSearch}
                        onCopy={handleCopy}
                        periodOrder={(() => {
                          const keys = new Set<string>();
                          (financialsData.full.pnl ?? []).forEach((r) => Object.keys(r.years || {}).forEach((k) => keys.add(k)));
                          return Array.from(keys).sort().reverse();
                        })()}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground py-6 text-center">No P&L line items available for this company.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Balance Sheet (Balansräkning) – always show underneath P&L; table or empty state */}
                <Card ref={balanceRef}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Balansräkning</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(financialsData.full.balance?.length ?? 0) > 0 ? (
                      <FullFinancialTable
                        rows={financialsData.full.balance ?? []}
                        unitMode={unitMode}
                        yearsLimit={7}
                        deltaMode={deltaMode}
                        highlightYear={highlightYear}
                        highlightRow={highlightRow}
                        onYearClick={(p) => setHighlightYear((prev) => (prev === p ? null : p))}
                        onRowHover={setHighlightRow}
                        rowSearch={rowSearch}
                        onCopy={handleCopy}
                        periodOrder={(() => {
                          const keys = new Set<string>();
                          (financialsData.full.balance ?? []).forEach((r) => Object.keys(r.years || {}).forEach((k) => keys.add(k)));
                          return Array.from(keys).sort().reverse();
                        })()}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground py-6 text-center">No balance sheet line items available for this company.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Financial History</CardTitle>
                </CardHeader>
                <CardContent>
                  {financials.length === 0 ? (
                    <p className="text-muted-foreground py-8 text-center">
                      No multi-year financial data available. Latest: Revenue {formatRevenueSEK(overviewModel.latestFY.revenue)},
                      EBITDA Margin {formatPercent(overviewModel.latestFY.ebitdaMargin)}.
                    </p>
                  ) : (
                    <>
                      {!financialsData?.full && (
                        <p className="text-sm text-muted-foreground mb-4">
                          Full P&L and Balance Sheet require account-level data. Showing summary only.
                        </p>
                      )}
                      <table className="w-full">
                        <thead className="bg-muted/40 sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Year</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">Revenue (SEK)</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">EBITDA (SEK)</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">EBIT (SEK)</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">Net Profit (SEK)</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">EBITDA Margin</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">EBIT Margin</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">Net Margin</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">YoY Growth</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {financials.map((fin, i) => {
                            const prevRev = i > 0 ? financials[i - 1].revenue : null;
                            const yoyGrowth =
                              prevRev != null && prevRev !== 0 && fin.revenue != null
                                ? ((fin.revenue - prevRev) / prevRev) * 100
                                : null;
                            return (
                              <tr key={fin.year} className="hover:bg-muted/40">
                                <td className="px-4 py-3 font-medium text-foreground">{fin.year}</td>
                                <td className="px-4 py-3 text-right font-mono text-foreground">{formatRevenueSEK(fin.revenue)}</td>
                                <td className="px-4 py-3 text-right font-mono text-foreground">{formatRevenueSEK(fin.ebitda)}</td>
                                <td className="px-4 py-3 text-right font-mono text-foreground">{formatRevenueSEK(fin.ebit)}</td>
                                <td className="px-4 py-3 text-right font-mono text-foreground">{formatRevenueSEK(fin.profit)}</td>
                                <td className="px-4 py-3 text-right font-mono text-foreground">{fin.ebitda_margin != null ? `${(fin.ebitda_margin <= 1 ? fin.ebitda_margin * 100 : fin.ebitda_margin).toFixed(1)}%` : "—"}</td>
                                <td className="px-4 py-3 text-right font-mono text-foreground">{fin.ebit_margin != null ? `${(fin.ebit_margin <= 1 ? fin.ebit_margin * 100 : fin.ebit_margin).toFixed(1)}%` : "—"}</td>
                                <td className="px-4 py-3 text-right font-mono text-foreground">{fin.net_margin != null ? `${(fin.net_margin <= 1 ? fin.net_margin * 100 : fin.net_margin).toFixed(1)}%` : "—"}</td>
                                <td className="px-4 py-3 text-right font-mono">
                                  {yoyGrowth != null ? (
                                    <span className={yoyGrowth > 0 ? "text-primary" : "text-destructive"}>
                                      {yoyGrowth > 0 ? "+" : ""}{yoyGrowth.toFixed(1)}%
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
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
