import { useState, useEffect } from "react";
import { useAIRuns, useLists, useCompanies } from "@/lib/hooks/figmaQueries";
import { useAuth } from "@/contexts/AuthContext";
import { getLastApiErrors } from "@/lib/services/figmaApi";
import * as api from "@/lib/services/figmaApi";
import { getListItems } from "@/lib/services/listsService";
import { fetchWhoAmI, type WhoAmI } from "@/lib/services/whoamiService";
import { runDefaultUniverseUrlStateDevTest } from "@/lib/defaultUniverseUrlState";
import { API_BASE } from "@/lib/apiClient";
import AdminPanel from "@/components/AdminPanel";
import ScraperInterface from "@/components/ScraperInterface";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SmokeStep = "idle" | "running" | "pass" | "fail";

export default function Admin() {
  const { user, session } = useAuth();
  const { data: companies = [], isError: companiesError } = useCompanies({ limit: 100 });
  const { data: lists = [], isError: listsError } = useLists();
  const { data: runs = [], isError: runsError } = useAIRuns();

  const [whoami, setWhoami] = useState<WhoAmI | null>(null);
  const [whoamiError, setWhoamiError] = useState<string | null>(null);
  useEffect(() => {
    fetchWhoAmI()
      .then(setWhoami)
      .catch((e) => setWhoamiError(e instanceof Error ? e.message : String(e)));
  }, []);

  const [smokeState, setSmokeState] = useState<{
    step1: SmokeStep;
    step2: SmokeStep;
    step3: SmokeStep;
    step4: SmokeStep;
    step5: SmokeStep;
    lastError?: string;
  }>({ step1: "idle", step2: "idle", step3: "idle", step4: "idle", step5: "idle" });
  const [urlTestPass, setUrlTestPass] = useState<boolean | null>(null);

  const apiErrors = getLastApiErrors();
  const hasError = companiesError || listsError || runsError || apiErrors.length > 0;

  const runSmokeTests = async () => {
    setSmokeState({ step1: "running", step2: "idle", step3: "idle", step4: "idle", step5: "idle" });
    let lastError = "";
    try {
      await api.getCompanies({ limit: 1 });
      setSmokeState((s) => ({ ...s, step1: "pass", step2: "running" }));
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      setSmokeState((s) => ({ ...s, step1: "fail", lastError }));
      return;
    }
    try {
      const listList = await api.getLists();
      setSmokeState((s) => ({ ...s, step2: "pass", step3: listList.length > 0 ? "running" : "pass" }));
      if (listList.length > 0) {
        try {
          await getListItems(listList[0].id);
          setSmokeState((s) => ({ ...s, step3: "pass", step4: "running" }));
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
          setSmokeState((s) => ({ ...s, step3: "fail", lastError }));
          return;
        }
      }
      try {
        await api.getCompanies({ limit: 5, offset: 0, sort: { by: "orgnr", dir: "asc" } });
        setSmokeState((s) => ({ ...s, step4: "pass", step5: "running" }));
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        setSmokeState((s) => ({ ...s, step4: "fail", lastError }));
        return;
      }
      try {
        const runsList = await api.getAIRuns();
        if (runsList.length > 0) {
          await api.getAIRun(runsList[0].id);
        }
        setSmokeState((s) => ({ ...s, step5: "pass" }));
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        setSmokeState((s) => ({ ...s, step5: "fail", lastError }));
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      setSmokeState((s) => ({ ...s, step2: "fail", lastError }));
    }
  };

  const runUrlStateTest = () => {
    const pass = runDefaultUniverseUrlStateDevTest();
    setUrlTestPass(pass);
  };

  return (
    <div className="h-full overflow-auto app-bg">
      <div className="max-w-5xl mx-auto px-8 py-8">
        <h1 className="text-base font-semibold text-foreground mb-2">Admin Panel</h1>
        <p className="text-sm text-foreground mb-6">System configuration and team management</p>

        <Tabs defaultValue="overview" className="mb-8">
          <TabsList className="w-full justify-start h-auto p-0 bg-card border border-border rounded-lg overflow-hidden text-foreground">
            <TabsTrigger value="overview" className="rounded-none data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=inactive]:text-foreground">Overview</TabsTrigger>
            <TabsTrigger value="team" className="rounded-none data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=inactive]:text-foreground">Team</TabsTrigger>
            <TabsTrigger value="scraper" className="rounded-none data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=inactive]:text-foreground">Scraper</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6 space-y-6">
        <Card className="app-card mb-8">
          <CardHeader>
            <CardTitle className="text-base">Contracts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {whoami ? (
              <div className="p-3 rounded bg-muted/40 border border-border mb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">System overview (truth source)</p>
                <p className="font-mono text-sm text-foreground">
                  Backend: <strong>{whoami.port}</strong>
                  {" · "}Postgres: <strong>{whoami.db_host}:{whoami.db_port}</strong>
                  {" · "}SHA: <strong>{whoami.git_sha}</strong>
                </p>
                <p className="text-xs text-muted-foreground mt-1">API: {whoami.api_base} · started {whoami.started_at}</p>
              </div>
            ) : whoamiError ? (
              <p className="text-destructive text-sm">Backend unreachable: {whoamiError}</p>
            ) : (
              <p className="text-muted-foreground text-sm">Loading backend info…</p>
            )}
            <div>
              <span className="text-foreground">API base URL: </span>
              <code className="font-mono text-foreground">{API_BASE}</code>
            </div>
            <div>
              <span className="text-foreground">Auth: </span>
              <span className={session ? "text-foreground" : "text-destructive"}>
                {session ? `Signed in (${user?.email ?? "user"})` : "Not signed in"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div>
                <span className="text-foreground">getCompanies(): </span>
                <span className="font-mono font-medium">{companies.length}</span>
              </div>
              <div>
                <span className="text-foreground">getLists(): </span>
                <span className="font-mono font-medium">{lists.length}</span>
              </div>
              <div>
                <span className="text-foreground">getAIRuns(): </span>
                <span className="font-mono font-medium">{runs.length}</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm font-medium text-foreground mb-2">MVP Smoke Test</p>
              <div className="flex flex-wrap gap-2 items-center">
                <Button size="sm" variant="outline" onClick={runSmokeTests} disabled={smokeState.step1 === "running"}>
                  Run smoke tests
                </Button>
                <span className="text-xs text-muted-foreground">
                  1) getCompanies {smokeState.step1 === "pass" ? "✓" : smokeState.step1 === "fail" ? "✗" : ""}
                  {" "}2) getLists {smokeState.step2 === "pass" ? "✓" : smokeState.step2 === "fail" ? "✗" : ""}
                  {" "}3) getListItems {smokeState.step3 === "pass" ? "✓" : smokeState.step3 === "fail" ? "✗" : ""}
                  {" "}4) Universe query {smokeState.step4 === "pass" ? "✓" : smokeState.step4 === "fail" ? "✗" : ""}
                  {" "}5) getAIRuns+detail {smokeState.step5 === "pass" ? "✓" : smokeState.step5 === "fail" ? "✗" : ""}
                </span>
              </div>
              {smokeState.lastError && (
                <p className="text-xs text-destructive mt-1">Last: {smokeState.lastError}</p>
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-border">
              <p className="text-sm font-medium text-foreground mb-2">URL state decode test (dev)</p>
              <Button size="sm" variant="ghost" onClick={runUrlStateTest}>
                Run URL decode test
              </Button>
              {urlTestPass !== null && (
                <span className="ml-2 text-sm">{urlTestPass ? "PASS" : "FAIL"}</span>
              )}
            </div>
            {hasError && (
              <div className="mt-3 p-3 rounded bg-destructive/10 border border-destructive/40 text-sm">
                <span className="text-destructive font-medium">
                  {apiErrors.length > 0 ? `Last ${apiErrors.length} API error${apiErrors.length > 1 ? "s" : ""}` : "Query error"}
                </span>
                {apiErrors.length > 0 ? (
                  <>
                    <ul className="mt-2 space-y-2 text-destructive">
                      {apiErrors.map((err, i) => (
                        <li key={i} className="border-b border-destructive/40 last:border-0 pb-2 last:pb-0">
                          <div><strong>Message:</strong> {err.message}</div>
                          <div><strong>Endpoint:</strong> <code className="font-mono">{err.endpoint}</code></div>
                          {err.status != null && <div><strong>Status:</strong> {err.status}</div>}
                          <div><strong>Time:</strong> {new Date(err.timestamp).toLocaleString()}</div>
                        </li>
                      ))}
                    </ul>
                    {(apiErrors.some(e => e.message.includes("Cannot reach backend") || e.message.includes("Failed to fetch") || e.message.includes("Is the backend running"))) && (
                      <div className="mt-3 pt-3 border-t border-destructive/40 text-destructive">
                        <p className="font-medium mb-1">Troubleshooting (network/CORS):</p>
                        <ol className="list-decimal list-inside text-xs space-y-0.5">
                          <li>Start backend: <code className="bg-destructive/15 px-1 rounded">./scripts/start_backend.sh</code> (default port 8000)</li>
                          <li>Ensure <code className="bg-destructive/15 px-1 rounded">VITE_API_BASE_URL</code> in frontend <code className="bg-destructive/15 px-1 rounded">.env</code> matches backend (local: <code className="bg-destructive/15 px-1 rounded">http://127.0.0.1:8000</code>)</li>
                          <li>For Universe/Lists: set <code className="bg-destructive/15 px-1 rounded">DATABASE_SOURCE=postgres</code> and run migrations</li>
                        </ol>
                      </div>
                    )}
                  </>
                ) : (
                  <span className="text-destructive block mt-1">Query error (see console)</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-6">
          <Card className="app-card">
            <CardContent className="p-6">
              <p className="text-sm text-foreground mb-1">Companies (sample)</p>
              <p className="text-base font-semibold">{companies.length}</p>
            </CardContent>
          </Card>
          <Card className="app-card">
            <CardContent className="p-6">
              <p className="text-sm text-foreground mb-1">Lists</p>
              <p className="text-base font-semibold">{lists.length}</p>
            </CardContent>
          </Card>
          <Card className="app-card">
            <CardContent className="p-6">
              <p className="text-sm text-foreground mb-1">AI Runs</p>
              <p className="text-base font-semibold">{runs.length}</p>
            </CardContent>
          </Card>
        </div>
          </TabsContent>

          <TabsContent value="team" className="mt-6">
            <AdminPanel currentUser={user} />
          </TabsContent>

          <TabsContent value="scraper" className="mt-6">
            <ScraperInterface />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
