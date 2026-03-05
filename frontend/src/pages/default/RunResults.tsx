import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  useAIRun,
  useRunResults,
  useCompany,
  useCompaniesBatch,
  usePromptTemplate,
} from "@/lib/hooks/apiQueries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  CheckCircle,
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
} from "@/lib/utils/companyMetrics";
import { ErrorState } from "@/components/default/ErrorState";
import { EmptyState } from "@/components/default/EmptyState";

export default function RunResults() {
  const { runId } = useParams<{ runId: string }>();
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

  const sortedResults = sortResults(results);

  const getRecommendationBadge = (rec: string) => {
    switch (rec) {
      case "strong_fit":
        return <Badge className="bg-muted text-foreground">Strong Fit</Badge>;
      case "potential_fit":
        return <Badge className="bg-muted text-foreground">Potential Fit</Badge>;
      case "weak_fit":
        return <Badge className="bg-muted text-foreground">Weak Fit</Badge>;
      case "pass":
        return <Badge className="bg-destructive/15 text-destructive">Pass</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="h-full overflow-auto app-bg">
      <div className="max-w-5xl mx-auto px-8 py-8 space-y-6">
        <div>
          <Link
            to={`/ai/runs/${run.id}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Run Detail
          </Link>

          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-foreground mb-1 truncate">
                {run.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {template.name} • {run.total_companies} companies • Completed{" "}
                {run.completed_at
                  ? (() => {
                      const d = new Date(run.completed_at);
                      const now = new Date();
                      const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
                      if (mins < 60) return `${mins} minutes ago`;
                      const hours = Math.floor(mins / 60);
                      if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
                      return d.toLocaleDateString();
                    })()
                  : "—"}
              </p>
            </div>

            <div className="text-center">
              <p className="text-base font-bold text-foreground">{results.length}</p>
              <p className="text-xs text-muted-foreground">Companies analyzed</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium text-foreground">{run.status}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">List</span>
              <Link to={`/lists/${run.list_id}`} className="font-medium text-primary hover:underline">
                {run.list_id}
              </Link>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Processed</span>
              <span className="font-medium text-foreground">
                {run.processed_companies}/{run.total_companies}{" "}
                <span className="text-muted-foreground">({run.failed_companies} failed)</span>
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Cost</span>
              <span className="font-medium text-foreground">
                est {run.estimated_cost.toFixed(4)} • actual {run.actual_cost.toFixed(4)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Created</span>
              <span className="font-medium text-foreground">
                {new Date(run.created_at).toLocaleString()}
              </span>
            </div>
            {run.completed_at && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Completed</span>
                <span className="font-medium text-foreground">
                  {new Date(run.completed_at).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {results.length === 0 ? (
          <EmptyState
            title="No results yet"
            description="Analysis may still be running or no companies were processed."
          />
        ) : (
          <div className="space-y-4">
            <div className="bg-card rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-4 mb-4">
                <span className="text-sm font-medium text-foreground">Sort</span>
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

              <div className="space-y-2">
                {sortedResults.map((result) => (
                  <ResultCard
                    key={result.id}
                    result={result}
                    selectedId={selectedResultId}
                    onSelect={setSelectedResultId}
                    badge={getRecommendationBadge(result.recommendation)}
                    scoreClass="text-foreground"
                  />
                ))}
              </div>
            </div>

            {selectedResult ? (
              <ResultDetail result={selectedResult} template={template} />
            ) : (
              <div className="bg-card rounded-lg border border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">Select a result to view details</p>
              </div>
            )}
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
}: {
  result: { id: string; company_orgnr: string; overall_score: number; recommendation: string };
  selectedId: string | null;
  onSelect: (id: string) => void;
  badge: React.ReactNode;
  scoreClass: string;
}) {
  const { data: company } = useCompany(result.company_orgnr);
  return (
    <Card
      className={`cursor-pointer ${selectedId === result.id ? "ring-2 ring-border" : ""}`}
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
          <span className="text-xs text-muted-foreground">
            {company?.industry_label}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function ResultDetail({
  result,
  template,
}: {
  result: {
    id: string;
    company_orgnr: string;
    overall_score: number;
    recommendation: string;
    summary: string;
    strengths: string[];
    concerns: string[];
    prompt_used?: string;
    dimension_scores?: Record<string, number>;
    analyzed_at?: string;
    tokens_used?: number;
    cost?: number;
  };
  template: { scoringDimensions: { id: string; name: string; description?: string }[] };
}) {
  const { data: company } = useCompany(result.company_orgnr);

  const getRecommendationBadge = (rec: string) => {
    switch (rec) {
      case "strong_fit":
        return <Badge className="bg-muted text-foreground">Strong Fit</Badge>;
      case "potential_fit":
        return <Badge className="bg-muted text-foreground">Potential Fit</Badge>;
      case "weak_fit":
        return <Badge className="bg-muted text-foreground">Weak Fit</Badge>;
      case "pass":
        return <Badge className="bg-destructive/15 text-destructive">Pass</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-base font-bold text-foreground">
                  {company?.display_name ?? result.company_orgnr}
                </h2>
                <Link
                  to={`/company/${result.company_orgnr}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="w-5 h-5" />
                </Link>
              </div>
              <p className="text-sm text-muted-foreground">
                {company?.industry_label} • {company?.region ?? ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Analyzed: {result.analyzed_at ? new Date(result.analyzed_at).toLocaleString() : "—"}</span>
                <span>Tokens: {result.tokens_used ?? "—"}</span>
                <span>Cost: {typeof result.cost === "number" ? result.cost.toFixed(4) : "—"}</span>
              </div>
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

      {template.scoringDimensions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Scoring Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const dimScores = result.dimension_scores ?? {};
              const hasData = template.scoringDimensions.some(
                (dim) => typeof dimScores[dim.id] === "number" && dimScores[dim.id] > 0
              );
              if (!hasData) {
                return (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Dimension scores are not available for this result. They appear when the
                    analysis pipeline returns per-dimension scores for this template.
                  </p>
                );
              }
              return (
                <div className="space-y-4">
                  {template.scoringDimensions.map((dim) => {
                    const score = dimScores[dim.id] ?? 0;
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
                                ? "text-foreground"
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
                                ? "bg-foreground/60"
                                : score >= 50
                                  ? "bg-foreground/30"
                                  : "bg-destructive"
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {company && (
        <Card>
          <CardHeader>
            <CardTitle>Key Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <p className="text-muted-foreground">Revenue</p>
                <p className="font-medium text-foreground">
                  {formatRevenueSEK(
                    getLatestFinancials(company).revenue ?? company.revenue_latest
                  )}
                </p>
              </div>
              <div className="flex items-center justify-between gap-4">
                <p className="text-muted-foreground">EBITDA</p>
                <p className="font-medium text-foreground">
                  {formatRevenueSEK(getLatestFinancials(company).ebitda)}
                </p>
              </div>
              <div className="flex items-center justify-between gap-4">
                <p className="text-muted-foreground">Growth</p>
                <p
                  className={`font-medium ${
                    (calculateRevenueCagr(company) ?? 0) >= 0
                      ? "text-foreground"
                      : "text-destructive"
                  }`}
                >
                  {calculateRevenueCagr(company) != null
                    ? formatPercent(calculateRevenueCagr(company)!)
                    : "—"}
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

      {!!result.prompt_used && (
        <Card>
          <CardHeader>
            <CardTitle>Prompt Used</CardTitle>
          </CardHeader>
          <CardContent>
            <details className="group">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                View prompt
              </summary>
              <pre className="mt-3 whitespace-pre-wrap text-xs text-foreground bg-muted rounded-md p-3 border border-border">
                {result.prompt_used}
              </pre>
            </details>
          </CardContent>
        </Card>
      )}

      {(result.strengths?.length > 0 || result.concerns?.length > 0) && (
        <div className="space-y-4">
          {result.strengths?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <TrendingUp className="w-5 h-5" />
                  Key Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-foreground flex-shrink-0 mt-0.5" />
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

    </div>
  );
}
