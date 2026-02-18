import { requestJson } from "@/lib/api/httpClient";
import type { BackendStatus } from "@/lib/api/status/types";

export async function getBackendStatusClient(): Promise<BackendStatus> {
  return requestJson("/api/status");
}
