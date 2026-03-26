import { requestJson } from "@/lib/api/httpClient";
import type { FinancialYear } from "@/lib/api/types";
import type { CompanyFinancialsResponse } from "@/lib/api/companies/types";

export async function getCompaniesBatchClient(
  orgnrs: string[],
  options?: { autoEnrich?: boolean }
): Promise<{ companies: Array<Record<string, unknown>>; count: number }> {
  const params = new URLSearchParams();
  if (options?.autoEnrich === false) params.set("auto_enrich", "false");
  const query = params.toString();
  const url = `/api/companies/batch${query ? `?${query}` : ""}`;

  return requestJson(url, {
    method: "POST",
    body: JSON.stringify({ orgnrs }),
  });
}

export async function getCompanyFinancialsClient(
  orgnr: string
): Promise<CompanyFinancialsResponse> {
  const enc = encodeURIComponent(orgnr);
  return requestJson(`/api/companies/${enc}/financials`);
}

export async function getCompanyAnalysisClient(
  orgnr: string
): Promise<Record<string, unknown>> {
  const enc = encodeURIComponent(orgnr);
  return requestJson(`/api/analysis/companies/${enc}/analysis`);
}
