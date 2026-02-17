import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  useAIRun,
  useRunResults,
  useCompany,
  useCompaniesBatch,
  usePromptTemplate,
} from "@/lib/hooks/figmaQueries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getLatestFinancials,
  formatRevenueSEK,
  formatPercent,
  calculateRevenueCagr,
} from "@/lib/utils/figmaCompanyUtils";
import { ErrorState } from "@/components/default/ErrorState";
import { EmptyState } from "@/components/default/EmptyState";
import * as api from "@/lib/services/figmaApi";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function NewRunResults() {
  const { runId } = useParams<{ runId: string }>();
  const queryClient = useQueryClient();
  const { data: run, isError: runError, error: runErrorObj, refetch: refetchRun } = useAIRun(runId ?? "");
  const { data: results = [], isLoading, isError: resultsError, error: resultsErrorObj, refetch: refetchResults } = useRunResults(runId ?? "");
  const { data: template } = usePromptTemplate(run?.template_id ?? "");
  const orgnrs = useMemo(() => results.map((r) => r.company_orgnr), [results]);
  const { data: companies = [] } = useCompaniesBatch(orgnrs);
  const companyNameMap = useMemo(() => {
    const m = new Map<string, string>();
    companies.forEach((c) => m.set(c.orgnr, c.display_name ?? c.orgnr));
    return m;
  }, [companies]);

  const [selectedResultId, setSelectedResultId] = useState<string | null>(
    results.length > 0 ? results[0].id : null
  );
  const [sortBy, setSortBy] = useState<"score-high" | "score-low" | "name-az">("score-high");

  const err = runError || resultsError;
  const errMsg = runError ? runErrorObj?.message : resultsErrorObj?.message;

  if (err) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-8">
        <ErrorState
          message={errMsg ?? "Failed to load results"}
          retry={() => {
            refetchRun();
            refetchResults();
          }}
          action={
            <Link to="/ai">
              <Button variant="outline" size="sm">
                Back to AI Lab
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading results...</p>
      </div>
    );
  }

  if (!run || !template) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-base font-bold text-foreground mb-2">Run not found</h2>
          <Link to="/ai">
            <Button>Back to AI Lab</Button>
          </Link>
        </div>
      </div>
    );
  }

  const selectedResult = results.find((r) => r.id === selectedResultId);

  const sortResults = <T extends { overall_score: number; company_orgnr: string }>(
    arr: T[]
  ): T[] => {
    const copy = [...arr];
    if (sortBy === "score-high") copy.sort((a, b) => b.overall_score - a.overall_score);
    else if (sortBy === "score-low") copy.sort((a, b) => a.overall_score - b.overall_score);
    else copy.sort((a, b) => (companyNameMap.get(a.company_orgnr) ?? a.company_orgnr).localeCompare(companyNameMap.get(b.company_orgnr) ?? b.company_orgnr));
    return copy;
  };

  const pendingResults = sortResults(results.filter((r) => r.status === "pending"));
  const approvedResults = sortResults(results.filter((r) => r.status === "approved"));
  const rejectedResults = sortResults(results.filter((r) => r.status === "rejected"));

  const getRecommendationBadge = (rec: string) => {
    switch (rec) {
      case "strong_fit":
        return <Badge className="bg-primary/15 text-primary">Strong Fit</Badge>;
      case "potential_fit":
        return <Badge className="bg-accent text-foreground">Potential Fit</Badge>;
      case "weak_fit":
        return <Badge className="bg-accent text-foreground">Weak Fit</Badge>;
      case "pass":
        return <Badge className="bg-destructive/15 text-destructive">Pass</Badge>;
      default:
        return null;
    }
  };

  const handleApprove = async (resultId: string) => {
    try {
      await api.approveResult(resultId);
      queryClient.invalidateQueries({ queryKey: ["figma", "aiRuns", runId ?? "", "results"] });
      const currentIndex = results.findIndex((r) => r.id === resultId);
      const nextPending = results.slice(currentIndex + 1).find((r) => r.status === "pending");
      if (nextPending) setSelectedResultId(nextPending.id);
      toast.success("Result approved");
    } catch {
      toast.error("Approve not yet implemented in backend");
    }
  };

  const handleReject = async (resultId: string) => {
    try {
      await api.rejectResult(resultId);
      queryClient.invalidateQueries({ queryKey: ["figma", "aiRuns", runId ?? "", "results"] });
      const currentIndex = results.findIndex((r) => r.id === resultId);
      const nextPending = results.slice(currentIndex + 1).find((r) => r.status === "pending");
      if (nextPending) setSelectedResultId(nextPending.id);
      toast.success("Result rejected");
    } catch {
      toast.error("Reject not yet implemented in backend");
    }
  };

  return (
    <div className="h-full overflow-auto bg-muted/40">
      <div className="max-w-7xl mx-auto p-8">
        <div className="mb-6">
          <Link to={`/ai/runs/${run.id}`}>
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-1" /> Run Detail
            </Button>
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-base font-semibold text-foreground mb-1">
                {run.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {template.name} • {run.total_companies} companies • Completed {run.completed_at ? (() => {
                  const d = new Date(run.completed_at);
                  const now = new Date();
                  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
                  if (mins < 60) return `${mins} minutes ago`;
                  const hours = Math.floor(mins / 60);
                  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
                  return d.toLocaleDateString();
                })() : "—"}
              </p>
            </div>
            <div className="flex gap-3">
              <div className="text-center">
                <p className="text-base font-bold text-foreground">
                  {approvedResults.length}
                </p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-foreground">
                  {pendingResults.length}
                </p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-muted-foreground">
                  {rejectedResults.length}
                </p>
                <p className="text-xs text-muted-foreground">Rejected</p>
              </div>
            </div>
          </div>
        </div>

        {results.length === 0 ? (
          <EmptyState
            title="No results yet"
            description="Analysis may still be running or no companies were processed."
          />
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Filter:</span>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="w-56 h-9">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="score-high">Score (High to Low)</SelectItem>
                  <SelectItem value="score-low">Score (Low to High)</SelectItem>
                  <SelectItem value="name-az">Name (A-Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-6">
            <div className="col-span-1">
              <Tabs defaultValue="pending">
                <TabsList className="w-full grid grid-cols-3">
                  <TabsTrigger value="pending">
                    Pending ({pendingResults.length})
                  </TabsTrigger>
                  <TabsTrigger value="approved">
                    Approved ({approvedResults.length})
                  </TabsTrigger>
                  <TabsTrigger value="rejected">
                    Rejected ({rejectedResults.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="space-y-2 mt-4">
                  {pendingResults.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No pending results
                    </p>
                  ) : (
                    pendingResults.map((result) => (
                      <ResultCard
                        key={result.id}
                        result={result}
                        selectedId={selectedResultId}
                        onSelect={setSelectedResultId}
                        badge={getRecommendationBadge(result.recommendation)}
                        scoreClass="text-foreground"
                      />
                    ))
                  )}
                </TabsContent>

                <TabsContent value="approved" className="space-y-2 mt-4">
                  {approvedResults.map((result) => (
                    <ResultCard
                      key={result.id}
                      result={result}
                      selectedId={selectedResultId}
                      onSelect={setSelectedResultId}
                      badge={getRecommendationBadge(result.recommendation)}
                      scoreClass="text-primary"
                      icon={<CheckCircle className="w-4 h-4 text-primary" />}
                    />
                  ))}
                </TabsContent>

                <TabsContent value="rejected" className="space-y-2 mt-4">
                  {rejectedResults.map((result) => (
                    <ResultCard
                      key={result.id}
                      result={result}
                      selectedId={selectedResultId}
                      onSelect={setSelectedResultId}
                      badge={getRecommendationBadge(result.recommendation)}
                      scoreClass="text-muted-foreground"
                      icon={<XCircle className="w-4 h-4 text-muted-foreground" />}
                      opacity
                    />
                  ))}
                </TabsContent>
              </Tabs>
            </div>

            <div className="col-span-2">
              {selectedResult ? (
                <ResultDetail
                  result={selectedResult}
                  template={template}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ) : (
                <Card>
                  <CardContent className="p-12 text-center">
                    <p className="text-muted-foreground">Select a result to view details</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultCard({
  result,
  selectedId,
  onSelect,
  badge,
  scoreClass,
  icon,
  opacity,
}: {
  result: { id: string; company_orgnr: string; overall_score: number; recommendation: string };
  selectedId: string | null;
  onSelect: (id: string) => void;
  badge: React.ReactNode;
  scoreClass: string;
  icon?: React.ReactNode;
  opacity?: boolean;
}) {
  const { data: company } = useCompany(result.company_orgnr);
  return (
    <Card
      className={`cursor-pointer ${selectedId === result.id ? "ring-2 ring-blue-600" : ""} ${opacity ? "opacity-60" : ""}`}
      onClick={() => onSelect(result.id)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <p className="font-medium text-sm text-foreground">
            {company?.display_name ?? result.company_orgnr}
          </p>
          <span className={`text-base font-bold ${scoreClass}`}>
            {result.overall_score}
          </span>
        </div>
        <div className="flex items-center justify-between">
          {badge}
          {icon ?? (
            <span className="text-xs text-muted-foreground">
              {company?.industry_label}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ResultDetail({
  result,
  template,
  onApprove,
  onReject,
}: {
  result: { id: string; company_orgnr: string; overall_score: number; recommendation: string; summary: string; strengths: string[]; concerns: string[]; status?: string; dimension_scores?: Record<string, number>; analyzed_at?: string; tokens_used?: number; cost?: number };
  template: { scoringDimensions: { id: string; name: string; description?: string }[] };
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const { data: company } = useCompany(result.company_orgnr);

  const getRecommendationBadge = (rec: string) => {
    switch (rec) {
      case "strong_fit":
        return <Badge className="bg-primary/15 text-primary">Strong Fit</Badge>;
      case "potential_fit":
        return <Badge className="bg-accent text-foreground">Potential Fit</Badge>;
      case "weak_fit":
        return <Badge className="bg-accent text-foreground">Weak Fit</Badge>;
      case "pass":
        return <Badge className="bg-destructive/15 text-destructive">Pass</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-base font-bold text-foreground">
                  {company?.display_name ?? result.company_orgnr}
                </h2>
                <Link
                  to={`/company/${result.company_orgnr}`}
                  className="text-primary hover:text-primary"
                >
                  <ExternalLink className="w-5 h-5" />
                </Link>
              </div>
              <p className="text-muted-foreground">
                {company?.industry_label} • {company?.region ?? ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-base font-bold text-foreground mb-1">
                {result.overall_score}
              </p>
              <p className="text-sm text-muted-foreground">AI Fit Score</p>
              {getRecommendationBadge(result.recommendation)}
            </div>
          </div>
        </CardContent>
      </Card>

      {template.scoringDimensions.length > 0 && result.dimension_scores && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Scoring Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {template.scoringDimensions.map((dim) => {
                const score = result.dimension_scores?.[dim.id] ?? 0;
                return (
                  <div key={dim.id}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium text-foreground">{dim.name}</p>
                        {dim.description && (
                          <p className="text-xs text-muted-foreground">{dim.description}</p>
                        )}
                      </div>
                      <span
                        className={`text-base font-bold ${
                          score >= 75
                            ? "text-primary"
                            : score >= 50
                              ? "text-foreground"
                              : "text-destructive"
                        }`}
                      >
                        {Math.round(score)}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          score >= 75
                            ? "bg-primary"
                            : score >= 50
                              ? "bg-accent"
                              : "bg-destructive"
                        }`}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {company && (
        <Card>
          <CardHeader>
            <CardTitle>Key Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">Revenue</p>
                <p className="font-medium text-foreground">
                  {formatRevenueSEK(getLatestFinancials(company).revenue ?? company.revenue_latest)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">EBITDA</p>
                <p className="font-medium text-foreground">
                  {formatRevenueSEK(getLatestFinancials(company).ebitda)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Growth</p>
                <p className={`font-medium ${(calculateRevenueCagr(company) ?? 0) >= 0 ? "text-primary" : "text-destructive"}`}>
                  {calculateRevenueCagr(company) != null ? formatPercent(calculateRevenueCagr(company)!) : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>AI Analysis Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-foreground whitespace-pre-line leading-relaxed">
            {result.summary || "No summary available."}
          </p>
        </CardContent>
      </Card>

      {(result.strengths?.length > 0 || result.concerns?.length > 0) && (
        <div className="grid grid-cols-2 gap-6">
          {result.strengths?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <TrendingUp className="w-5 h-5" />
                  Key Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-foreground">{s}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {result.concerns?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  Concerns & Red Flags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.concerns.map((c, i) => (
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

      {result.status === "pending" && (
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onReject(result.id)}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <ThumbsDown className="w-4 h-4 mr-2" />
            Reject
          </Button>
          <Button
            onClick={() => onApprove(result.id)}
            className="bg-primary hover:bg-primary/90"
          >
            <ThumbsUp className="w-4 h-4 mr-2" />
            Approve
          </Button>
        </div>
      )}
    </div>
  );
}
