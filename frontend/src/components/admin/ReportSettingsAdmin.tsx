import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getReportSettingsAdmin,
  updateReportSettingsAdmin,
  type ReportRetrievalConfig,
} from "@/lib/services/adminService";
import { FileSearch, Loader2 } from "lucide-react";

export default function ReportSettingsAdmin() {
  const [config, setConfig] = useState<ReportRetrievalConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maxQueriesPerStage, setMaxQueriesPerStage] = useState("");
  const [maxResultsPerQuery, setMaxResultsPerQuery] = useState("");
  const [maxExtractedUrls, setMaxExtractedUrls] = useState("");
  const [maxPerDomain, setMaxPerDomain] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const c = await getReportSettingsAdmin();
      setConfig(c);
      setMaxQueriesPerStage(String(c.max_queries_per_stage));
      setMaxResultsPerQuery(String(c.max_results_per_query));
      setMaxExtractedUrls(String(c.max_extracted_urls));
      setMaxPerDomain(String(c.max_per_domain));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const qps = parseInt(maxQueriesPerStage, 10);
      const rpq = parseInt(maxResultsPerQuery, 10);
      const meu = parseInt(maxExtractedUrls, 10);
      const mpd = parseInt(maxPerDomain, 10);

      if (isNaN(qps) || qps < 4 || qps > 20) {
        setError("Max queries per stage must be between 4 and 20.");
        setSaving(false);
        return;
      }
      if (isNaN(rpq) || rpq < 1 || rpq > 20) {
        setError("Max results per query must be between 1 and 20.");
        setSaving(false);
        return;
      }
      if (isNaN(meu) || meu < 8 || meu > 30) {
        setError("Max extracted URLs must be between 8 and 30.");
        setSaving(false);
        return;
      }
      if (isNaN(mpd) || mpd < 1 || mpd > 5) {
        setError("Max per domain must be between 1 and 5.");
        setSaving(false);
        return;
      }

      const updated = await updateReportSettingsAdmin({
        max_queries_per_stage: qps,
        max_results_per_query: rpq,
        max_extracted_urls: meu,
        max_per_domain: mpd,
      });
      setConfig(updated);
      setMaxQueriesPerStage(String(updated.max_queries_per_stage));
      setMaxResultsPerQuery(String(updated.max_results_per_query));
      setMaxExtractedUrls(String(updated.max_extracted_urls));
      setMaxPerDomain(String(updated.max_per_domain));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !config) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading report settings…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="app-card shadow-none">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSearch className="h-4 w-4" />
            Retrieval limits
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Control how much web data Deep Research fetches per run. Higher values improve report depth but increase cost and latency.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="max-queries-per-stage" className="text-xs">
                Max queries per stage (4–20)
              </Label>
              <Input
                id="max-queries-per-stage"
                type="number"
                min={4}
                max={20}
                value={maxQueriesPerStage}
                onChange={(e) => setMaxQueriesPerStage(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="max-results-per-query" className="text-xs">
                Max results per query (1–20)
              </Label>
              <Input
                id="max-results-per-query"
                type="number"
                min={1}
                max={20}
                value={maxResultsPerQuery}
                onChange={(e) => setMaxResultsPerQuery(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="max-extracted-urls" className="text-xs">
                Max extracted URLs (8–30)
              </Label>
              <Input
                id="max-extracted-urls"
                type="number"
                min={8}
                max={30}
                value={maxExtractedUrls}
                onChange={(e) => setMaxExtractedUrls(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="max-per-domain" className="text-xs">
                Max per domain (1–5)
              </Label>
              <Input
                id="max-per-domain"
                type="number"
                min={1}
                max={5}
                value={maxPerDomain}
                onChange={(e) => setMaxPerDomain(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          {config?.updated_at && (
            <p className="text-xs text-muted-foreground">
              Last updated: {new Date(config.updated_at).toLocaleString()}
              {config.updated_by && ` by ${config.updated_by}`}
            </p>
          )}
          <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save settings"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
