import { ApiRequestError, requestJson } from "@/lib/api/httpClient";
import type { BackendStatus } from "@/lib/api/status/types";

export async function getBackendStatusClient(): Promise<BackendStatus> {
  try {
    return await requestJson("/api/status");
  } catch (error) {
    // /api/status requires auth. Treat 401 as auth-required and verify DB via public ping.
    if (error instanceof ApiRequestError && error.status === 401) {
      const db = await requestJson<{ ok: boolean }>("/api/db/ping");
      return {
        status: db.ok ? "auth_required" : "degraded",
        db_ok: db.ok,
      };
    }
    throw error;
  }
}
