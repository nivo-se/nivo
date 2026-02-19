import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getAiCreditsConfig,
  updateAiCreditsConfig,
  getAiCreditsUsage,
  type AICreditsConfig,
  type AICreditsUsageResponse,
} from "@/lib/services/adminService";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Coins, Loader2 } from "lucide-react";

export default function AICreditsAdmin() {
  const [config, setConfig] = useState<AICreditsConfig | null>(null);
  const [usage, setUsage] = useState<AICreditsUsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState("current_month");
  const [globalLimit, setGlobalLimit] = useState("");
  const [perUserLimit, setPerUserLimit] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, u] = await Promise.all([
        getAiCreditsConfig(),
        getAiCreditsUsage(period),
      ]);
      setConfig(c);
      setUsage(u);
      setGlobalLimit(String(c.global_monthly_limit_usd));
      setPerUserLimit(c.per_user_monthly_limit_usd != null ? String(c.per_user_monthly_limit_usd) : "");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (config == null) return;
    getAiCreditsUsage(period).then(setUsage).catch(() => {});
  }, [period]);

  const handleSaveLimits = async () => {
    setSaving(true);
    setError(null);
    try {
      const global = globalLimit.trim() !== "" ? parseFloat(globalLimit) : undefined;
      const perUser =
        perUserLimit.trim() === ""
          ? null
          : parseFloat(perUserLimit);
      if (global !== undefined && (isNaN(global) || global < 0)) {
        setError("Global limit must be a non-negative number.");
        setSaving(false);
        return;
      }
      if (perUser !== undefined && perUser !== null && (isNaN(perUser) || perUser < 0)) {
        setError("Per-user limit must be a non-negative number or empty.");
        setSaving(false);
        return;
      }
      const updated = await updateAiCreditsConfig({
        ...(global !== undefined && { global_monthly_limit_usd: global }),
        per_user_monthly_limit_usd: perUserLimit.trim() === "" ? null : (isNaN(perUser) ? undefined : perUser),
      });
      setConfig(updated);
      setGlobalLimit(String(updated.global_monthly_limit_usd));
      setPerUserLimit(updated.per_user_monthly_limit_usd != null ? String(updated.per_user_monthly_limit_usd) : "");
      await load();
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
        <span>Loading AI credits settings…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="app-card shadow-none">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Coins className="h-4 w-4" />
            Spend limits
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Set monthly caps on total AI spend (USD). Per-user limit is optional; leave empty for global cap only.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="global-limit" className="text-xs">Global monthly limit (USD)</Label>
              <Input
                id="global-limit"
                type="number"
                min={0}
                step={1}
                value={globalLimit}
                onChange={(e) => setGlobalLimit(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="per-user-limit" className="text-xs">Per-user monthly limit (USD, optional)</Label>
              <Input
                id="per-user-limit"
                type="number"
                min={0}
                step={1}
                placeholder="None"
                value={perUserLimit}
                onChange={(e) => setPerUserLimit(e.target.value)}
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
          <Button size="sm" variant="outline" onClick={handleSaveLimits} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save limits"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <Card className="app-card shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Usage by user</CardTitle>
          <p className="text-xs text-muted-foreground">
            Track each user&apos;s AI spend. Recording runs when migration 022 is applied and Supabase is configured.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Period</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current_month">Current month</SelectItem>
                <SelectItem value="last_month">Last month</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" onClick={() => load()}>Refresh</Button>
          </div>
          {usage && (
            <>
              <p className="text-sm text-foreground">
                Total spend ({usage.period}): <strong>${usage.global_total_usd.toFixed(2)}</strong>
                {usage.config.global_monthly_limit_usd != null && (
                  <span className="text-muted-foreground ml-2">
                    / ${usage.config.global_monthly_limit_usd} limit
                  </span>
                )}
              </p>
              {usage.per_user.length === 0 ? (
                <p className="text-sm text-muted-foreground">No usage recorded for this period.</p>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border">
                        <th className="text-left p-2 font-medium">User ID</th>
                        <th className="text-right p-2 font-medium">Spend (USD)</th>
                        <th className="text-left p-2 font-medium">Operations</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usage.per_user.map((row) => (
                        <tr key={row.user_id} className="border-b border-border last:border-0">
                          <td className="p-2 font-mono text-xs">{row.user_id}</td>
                          <td className="p-2 text-right tabular-nums">${row.total_usd.toFixed(2)}</td>
                          <td className="p-2 text-xs text-muted-foreground">
                            {Object.entries(row.operation_counts)
                              .map(([op, count]) => `${op}: ${count}`)
                              .join(", ") || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
