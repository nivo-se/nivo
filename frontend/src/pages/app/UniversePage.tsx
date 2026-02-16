import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { universeService } from "@/lib/services/universeService";
import type { CoverageRow } from "@/lib/services/coverageService";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type CoverageFilters = {
  q: string;
  missing_homepage: boolean;
  missing_ai: boolean;
  missing_3y: boolean;
  stale_only: boolean;
  limit: number;
  offset: number;
};

export function UniversePage() {
  const navigate = useNavigate();

  const [coverageMode, setCoverageMode] = useState(true);

  const [filters, setFilters] = useState<CoverageFilters>({
    q: "",
    missing_homepage: false,
    missing_ai: false,
    missing_3y: false,
    stale_only: false,
    limit: 50,
    offset: 0,
  });

  const snapshotQ = useQuery({
    queryKey: ["coverageSnapshot"],
    queryFn: () => universeService.getCoverageSnapshot(),
    staleTime: 30_000,
  });

  const listQ = useQuery({
    queryKey: ["coverageList", filters],
    queryFn: () => universeService.getCoverageList(filters),
    staleTime: 15_000,
    enabled: coverageMode,
  });

  const rows = listQ.data?.rows ?? [];
  const total = listQ.data?.total ?? 0;

  const insightData = useMemo(() => {
    if (!snapshotQ.data) return [];
    return [
      { name: "Homepage", value: snapshotQ.data.has_homepage_pct },
      { name: "AI Profile", value: snapshotQ.data.has_ai_profile_pct },
      { name: "3Y Fin", value: snapshotQ.data.has_3y_financials_pct },
      { name: "Stale", value: snapshotQ.data.stale_pct },
    ];
  }, [snapshotQ.data]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Universe</h1>
          <p className="text-sm text-muted-foreground">
            Screen, segment, and understand what you know vs. what's missing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch checked={coverageMode} onCheckedChange={setCoverageMode} />
            <Label>Data Coverage Mode</Label>
          </div>

          <Button variant="secondary" onClick={() => listQ.refetch()}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Top: snapshot */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Companies</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {snapshotQ.data?.total_companies ?? "—"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Avg Data Quality</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {snapshotQ.data
              ? snapshotQ.data.avg_data_quality_score.toFixed(1)
              : "—"}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Coverage</CardTitle>
          </CardHeader>
          <CardContent className="h-16">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={insightData}>
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="value" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Main: 3-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Left: filters */}
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm">Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Search</Label>
              <Input
                value={filters.q}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, q: e.target.value, offset: 0 }))
                }
                placeholder="Company name or orgnr…"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label>Missing homepage</Label>
                <Switch
                  checked={filters.missing_homepage}
                  onCheckedChange={(v) =>
                    setFilters((f) => ({
                      ...f,
                      missing_homepage: v,
                      offset: 0,
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <Label>Missing AI profile</Label>
                <Switch
                  checked={filters.missing_ai}
                  onCheckedChange={(v) =>
                    setFilters((f) => ({ ...f, missing_ai: v, offset: 0 }))
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <Label>Missing 3Y financials</Label>
                <Switch
                  checked={filters.missing_3y}
                  onCheckedChange={(v) =>
                    setFilters((f) => ({ ...f, missing_3y: v, offset: 0 }))
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <Label>Stale only</Label>
                <Switch
                  checked={filters.stale_only}
                  onCheckedChange={(v) =>
                    setFilters((f) => ({ ...f, stale_only: v, offset: 0 }))
                  }
                />
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  setFilters({
                    q: "",
                    missing_homepage: false,
                    missing_ai: false,
                    missing_3y: false,
                    stale_only: false,
                    limit: 50,
                    offset: 0,
                  })
                }
              >
                Reset
              </Button>
              <Button
                onClick={() => {
                  navigate("/app/runs");
                }}
              >
                Run enrichment…
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Center: table */}
        <Card className="xl:col-span-6">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm">
              Results <span className="text-muted-foreground">({total})</span>
            </CardTitle>

            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={filters.offset === 0}
                onClick={() =>
                  setFilters((f) => ({
                    ...f,
                    offset: Math.max(0, f.offset - f.limit),
                  }))
                }
              >
                Prev
              </Button>
              <Button
                variant="outline"
                disabled={filters.offset + filters.limit >= total}
                onClick={() =>
                  setFilters((f) => ({ ...f, offset: f.offset + f.limit }))
                }
              >
                Next
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Org nr</TableHead>
                    <TableHead>Coverage</TableHead>
                    <TableHead>Quality</TableHead>
                    <TableHead>Freshness</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {rows.map((r) => (
                    <Row
                      key={r.orgnr}
                      row={r}
                      onOpen={() => navigate(`/app/companies/${r.orgnr}`)}
                    />
                  ))}

                  {listQ.isLoading && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-sm text-muted-foreground"
                      >
                        Loading…
                      </TableCell>
                    </TableRow>
                  )}

                  {!listQ.isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-sm text-muted-foreground"
                      >
                        No results.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Right: insights */}
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm">Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              This panel should react to filters. Start simple: show coverage
              deltas & "next best actions".
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Missing homepage</span>
                <span className="font-medium">
                  {countWhere(rows, (x) => !x.has_homepage)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Missing AI profile</span>
                <span className="font-medium">
                  {countWhere(rows, (x) => !x.has_ai_profile)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Stale enrichment</span>
                <span className="font-medium">
                  {countWhere(rows, (x) => x.is_stale)}
                </span>
              </div>
            </div>

            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                alert("TODO: Save this filter as a list");
              }}
            >
              Save as list
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({
  row,
  onOpen,
}: {
  row: CoverageRow;
  onOpen: () => void;
}) {
  return (
    <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onOpen}>
      <TableCell>
        <div className="font-medium">{row.name ?? "—"}</div>
        <div className="text-xs text-muted-foreground line-clamp-1">
          {(row.segment_names ?? []).join(" · ")}
        </div>
      </TableCell>

      <TableCell className="text-sm">{row.orgnr}</TableCell>

      <TableCell>
        <div className="flex flex-wrap gap-1">
          <Badge variant={row.has_homepage ? "default" : "secondary"}>
            Homepage
          </Badge>
          <Badge variant={row.has_ai_profile ? "default" : "secondary"}>
            AI
          </Badge>
          <Badge variant={row.has_3y_financials ? "default" : "secondary"}>
            3Y Fin
          </Badge>
        </div>
      </TableCell>

      <TableCell className="text-sm">{row.data_quality_score}/4</TableCell>

      <TableCell>
        {row.is_stale ? (
          <Badge variant="secondary">Stale</Badge>
        ) : (
          <Badge>Fresh</Badge>
        )}
      </TableCell>
    </TableRow>
  );
}

function countWhere<T>(arr: T[], pred: (x: T) => boolean) {
  let n = 0;
  for (const x of arr) if (pred(x)) n++;
  return n;
}
