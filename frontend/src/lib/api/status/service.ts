import {
  getLatestApiError as getLatestHttpApiError,
  getRecentApiErrors as getRecentHttpApiErrors,
  type ApiErrorLog,
} from "@/lib/api/httpClient";
import { getBackendStatusClient } from "@/lib/api/status/client";
import type { BackendStatus } from "@/lib/api/status/types";

export async function getBackendStatus(): Promise<BackendStatus> {
  return getBackendStatusClient();
}

export function getLatestApiError(): ApiErrorLog | null {
  return getLatestHttpApiError();
}

export function getRecentApiErrors(): ApiErrorLog[] {
  return getRecentHttpApiErrors();
}
