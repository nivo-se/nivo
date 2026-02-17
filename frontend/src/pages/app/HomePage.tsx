import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getHomeDashboard, type TimeRange } from "@/lib/services/homeService";
import { buildUniverseSearchParams } from "@/lib/universeUrlState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  BarChart3,
  ListTodo,
  Play,
  TrendingUp,
  ExternalLink,
  Zap,
  Layers,
  Eye,
} from "lucide-react";

function fmt(val: number | null | undefined, suffix = ""): string {
  if (val == null) return "—";
  return typeof val === "number" ? val.toLocaleString() + suffix : String(val);
}

function fmtPct(val: number | null | undefined): string {
  if (val == null) return "—";
  return `${Number(val).toFixed(1)}%`;
}

export function HomePage() {
  const navigate = useNavigate();
  const [range, setRange] = useState<TimeRange>("30d");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["homeDashboard", range],
    queryFn: () => getHomeDashboard(range),
    staleTime: 30_000,
  });

  const goToUniverse = (preset?: string) => {
    const params = buildUniverseSearchParams({ preset: preset ?? undefined });
    navigate(`/app/universe?${params.toString()}`);
  };

  const chartData = data?.chart_series ?? [];

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Home</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            CEO view: universe snapshot, pipeline snapshot, active runs
          </p>
        </div>
        <Card>
          <CardContent className="py-6">
            <p className="text-muted-foreground text-sm">
              Could not load dashboard. Ensure the backend is running and configured.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Page header */}
      <div>
        <h1 className="text-base font-semibold tracking-tight">Home</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          CEO view: universe snapshot, pipeline snapshot, active runs
        </p>
      </div>

      {/* Section: Universe */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Universe
          </CardTitle>
          <CardDescription>Total companies and query scope</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total companies</span>
            <span className="font-medium">
              {isLoading ? <Skeleton className="h-5 w-16 inline-block" /> : fmt(data?.universe?.total_companies ?? data?.coverage?.total_companies)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Matched</span>
            <span className="font-medium">
              {data?.universe?.matched != null ? fmt(data.universe.matched) : "All"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Updated last 7d</span>
            <span className="font-medium">—</span>
          </div>
        </CardContent>
      </Card>

      {/* Section: Coverage */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Coverage
          </CardTitle>
          <CardDescription>AI profile, 3Y financials, staleness</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">AI profile %</span>
            <span className="font-medium">
              {isLoading ? <Skeleton className="h-5 w-12 inline-block" /> : fmtPct(data?.coverage?.ai_profile_pct)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Stale %</span>
            <span className="font-medium">{fmtPct(data?.coverage?.stale_pct)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">3Y financials %</span>
            <span className="font-medium">{fmtPct(data?.coverage?.financial_3y_pct)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Section: Pipeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ListTodo className="h-4 w-4" />
            Pipeline
          </CardTitle>
          <CardDescription>Team lists, my lists, last updated</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Team lists</span>
            <span className="font-medium">
              {isLoading ? <Skeleton className="h-5 w-8 inline-block" /> : fmt(data?.pipeline?.team_lists_count)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">My lists</span>
            <span className="font-medium">{fmt(data?.pipeline?.my_lists_count)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Updated last</span>
            <span className="font-medium">—</span>
          </div>
          {data?.pipeline?.last_updated_lists?.length ? (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-2">Recent lists</p>
              <ul className="text-sm space-y-1">
                {data.pipeline.last_updated_lists.slice(0, 3).map((l) => (
                  <li key={l.id} className="flex justify-between">
                    <span>{l.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {l.updated_at ? new Date(l.updated_at).toLocaleDateString("sv-SE", { month: "short", day: "numeric" }) : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <Button variant="outline" size="xs" onClick={() => navigate("/app/pipeline")} className="mt-2">
            Open Pipeline
            <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        </CardContent>
      </Card>

      {/* Section: Runs & Jobs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Play className="h-4 w-4" />
            Runs & Jobs
          </CardTitle>
          <CardDescription>Active runs and failures</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Active</span>
            <span className="font-medium">
              {isLoading ? <Skeleton className="h-5 w-8 inline-block" /> : fmt(data?.runs?.active_runs)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Failed</span>
            <span className="font-medium">{fmt(data?.runs?.failed_count)}</span>
          </div>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" size="xs" disabled>
              Retry last failed (placeholder)
            </Button>
            <Button variant="outline" size="xs" onClick={() => navigate("/app/runs")}>
              Open Runs
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Section: Analytics + Chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Analytics</CardTitle>
          <CardDescription>Activity over time. Range:</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-1">
            {(["1d", "7d", "30d"] as const).map((r) => (
              <Button
                key={r}
                variant={range === r ? "default" : "outline"}
                size="xs"
                onClick={() => setRange(r)}
              >
                {r}
              </Button>
            ))}
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" /> Enrichment
              </span>
              <span>—</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" /> Shortlists
              </span>
              <span>—</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5" /> Views
              </span>
              <span>—</span>
            </div>
          </div>
          <div className="h-[200px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Section: Next actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Next actions
          </CardTitle>
          <CardDescription>Quick links to Universe presets and Pipeline</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" size="xs" className="w-full justify-start" onClick={() => goToUniverse("coverage_gaps")}>
            Enrich: All companies missing AI profile
            <ExternalLink className="h-3 w-3 ml-auto" />
          </Button>
          <Button variant="outline" size="xs" className="w-full justify-start" onClick={() => goToUniverse("coverage_gaps")}>
            Review: Top 10 coverage gaps sorted by quality
            <ExternalLink className="h-3 w-3 ml-auto" />
          </Button>
          <Button variant="outline" size="xs" className="w-full justify-start" onClick={() => navigate("/app/universe")}>
            Curate: Build Team list from current view
            <ExternalLink className="h-3 w-3 ml-auto" />
          </Button>
          <Button variant="outline" size="xs" className="w-full justify-start" onClick={() => goToUniverse("profitable_growers")}>
            Explore: Profitable growers
            <ExternalLink className="h-3 w-3 ml-auto" />
          </Button>
          <Button variant="outline" size="xs" className="w-full justify-start" onClick={() => goToUniverse("large_profitable")}>
            Explore: Large profitable companies
            <ExternalLink className="h-3 w-3 ml-auto" />
          </Button>
          <Button variant="outline" size="xs" className="w-full justify-start" onClick={() => navigate("/app/pipeline")}>
            Open Pipeline
            <ExternalLink className="h-3 w-3 ml-auto" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
