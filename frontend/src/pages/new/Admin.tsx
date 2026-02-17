import { useState } from "react";
import { useAIRuns, useLists, useCompanies } from "@/lib/hooks/figmaQueries";
import { useAuth } from "@/contexts/AuthContext";
import { getLastApiErrors } from "@/lib/services/figmaApi";
import * as api from "@/lib/services/figmaApi";
import { getListItems } from "@/lib/services/listsService";
import { runNewUniverseUrlStateDevTest } from "@/lib/newUniverseUrlState";
import { API_BASE } from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type SmokeStep = "idle" | "running" | "pass" | "fail";

export default function NewAdmin() {
  const { user, session } = useAuth();
  const { data: companies = [], isError: companiesError } = useCompanies({ limit: 100 });
  const { data: lists = [], isError: listsError } = useLists();
  const { data: runs = [], isError: runsError } = useAIRuns();

  const [smokeState, setSmokeState] = useState<{
    step1: SmokeStep;
    step2: SmokeStep;
    step3: SmokeStep;
    lastError?: string;
  }>({ step1: "idle", step2: "idle", step3: "idle" });
  const [urlTestPass, setUrlTestPass] = useState<boolean | null>(null);

  const apiErrors = getLastApiErrors();
  const hasError = companiesError || listsError || runsError || apiErrors.length > 0;

  const runSmokeTests = async () => {
    setSmokeState({ step1: "running", step2: "idle", step3: "idle" });
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
          setSmokeState((s) => ({ ...s, step3: "pass" }));
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
          setSmokeState((s) => ({ ...s, step3: "fail", lastError }));
        }
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      setSmokeState((s) => ({ ...s, step2: "fail", lastError }));
    }
  };

  const runUrlStateTest = () => {
    const pass = runNewUniverseUrlStateDevTest();
    setUrlTestPass(pass);
  };

  return (
    <div className="h-full overflow-auto new-bg">
      <div className="max-w-5xl mx-auto px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin</h1>
        <p className="text-sm text-gray-600 mb-8">System overview</p>

        <Card className="new-card mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Contracts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <span className="text-gray-600">API base URL: </span>
              <code className="font-mono text-gray-900">{API_BASE}</code>
            </div>
            <div>
              <span className="text-gray-600">Auth: </span>
              <span className={session ? "text-green-600" : "text-amber-600"}>
                {session ? `Signed in (${user?.email ?? "user"})` : "Not signed in"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div>
                <span className="text-gray-600">getCompanies(): </span>
                <span className="font-mono font-medium">{companies.length}</span>
              </div>
              <div>
                <span className="text-gray-600">getLists(): </span>
                <span className="font-mono font-medium">{lists.length}</span>
              </div>
              <div>
                <span className="text-gray-600">getAIRuns(): </span>
                <span className="font-mono font-medium">{runs.length}</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-2">MVP Smoke Test</p>
              <div className="flex flex-wrap gap-2 items-center">
                <Button size="sm" variant="outline" onClick={runSmokeTests} disabled={smokeState.step1 === "running"}>
                  Run smoke tests
                </Button>
                <span className="text-xs text-gray-500">
                  1) getCompanies(limit=1) {smokeState.step1 === "pass" ? "✓" : smokeState.step1 === "fail" ? "✗" : ""}
                  {" "}2) getLists() {smokeState.step2 === "pass" ? "✓" : smokeState.step2 === "fail" ? "✗" : ""}
                  {" "}3) getListItems {smokeState.step3 === "pass" ? "✓" : smokeState.step3 === "fail" ? "✗" : ""}
                </span>
              </div>
              {smokeState.lastError && (
                <p className="text-xs text-red-600 mt-1">Last: {smokeState.lastError}</p>
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-2">URL state decode test (dev)</p>
              <Button size="sm" variant="ghost" onClick={runUrlStateTest}>
                Run URL decode test
              </Button>
              {urlTestPass !== null && (
                <span className="ml-2 text-sm">{urlTestPass ? "PASS" : "FAIL"}</span>
              )}
            </div>
            {hasError && (
              <div className="mt-3 p-3 rounded bg-red-50 border border-red-200 text-sm">
                <span className="text-red-800 font-medium">
                  {apiErrors.length > 0 ? `Last ${apiErrors.length} API error${apiErrors.length > 1 ? "s" : ""}` : "Query error"}
                </span>
                {apiErrors.length > 0 ? (
                  <ul className="mt-2 space-y-2 text-red-700">
                    {apiErrors.map((err, i) => (
                      <li key={i} className="border-b border-red-200 last:border-0 pb-2 last:pb-0">
                        <div><strong>Message:</strong> {err.message}</div>
                        <div><strong>Endpoint:</strong> <code className="font-mono">{err.endpoint}</code></div>
                        {err.status != null && <div><strong>Status:</strong> {err.status}</div>}
                        <div><strong>Time:</strong> {new Date(err.timestamp).toLocaleString()}</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-red-700 block mt-1">Query error (see console)</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-6">
          <Card className="new-card">
            <CardContent className="p-6">
              <p className="text-sm text-gray-600 mb-1">Companies (sample)</p>
              <p className="text-2xl font-semibold">{companies.length}</p>
            </CardContent>
          </Card>
          <Card className="new-card">
            <CardContent className="p-6">
              <p className="text-sm text-gray-600 mb-1">Lists</p>
              <p className="text-2xl font-semibold">{lists.length}</p>
            </CardContent>
          </Card>
          <Card className="new-card">
            <CardContent className="p-6">
              <p className="text-sm text-gray-600 mb-1">AI Runs</p>
              <p className="text-2xl font-semibold">{runs.length}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
