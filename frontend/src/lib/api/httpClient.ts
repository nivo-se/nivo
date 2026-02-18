import { fetchWithAuth } from "@/lib/backendFetch";
import { API_BASE } from "@/lib/apiClient";

export interface ApiErrorLog {
  message: string;
  endpoint: string;
  status?: number;
  timestamp: string;
}

const MAX_API_ERRORS = 5;
let apiErrors: ApiErrorLog[] = [];
let hasShownDevBackendToast = false;

function recordApiError(message: string, endpoint: string, status?: number): void {
  const entry: ApiErrorLog = {
    message,
    endpoint,
    status,
    timestamp: new Date().toISOString(),
  };
  apiErrors = [entry, ...apiErrors].slice(0, MAX_API_ERRORS);
}

function clearApiErrorLog(): void {
  apiErrors = [];
}

export function getLatestApiError(): ApiErrorLog | null {
  return apiErrors[0] ?? null;
}

export function getRecentApiErrors(): ApiErrorLog[] {
  return [...apiErrors];
}

function isDevelopment(): boolean {
  return Boolean(import.meta.env?.DEV);
}

async function showDevBackendToastOnce(): Promise<void> {
  if (hasShownDevBackendToast || typeof window === "undefined") return;
  hasShownDevBackendToast = true;
  try {
    const sonner = await import("sonner");
    sonner.toast.error("Backend error – see console");
  } catch {
    // No-op: diagnostics still go to console.
  }
}

export class ApiRequestError extends Error {
  status?: number;
  endpoint: string;
  responseBody?: string;

  constructor(message: string, endpoint: string, status?: number, responseBody?: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.endpoint = endpoint;
    this.responseBody = responseBody;
  }
}

export async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const endpoint = path.startsWith("/") ? path : `/${path}`;
  const res = await fetchWithAuth(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let message = `API error: ${res.status}`;
    let responseBody = "";
    try {
      responseBody = await res.text();
      message = responseBody || message;
    } catch {
      // Ignore body parsing errors.
    }
    recordApiError(message, endpoint, res.status);

    if (isDevelopment() && (res.status === 404 || res.status >= 500)) {
      console.error("[httpClient] Backend request failed", {
        endpoint,
        status: res.status,
        body: responseBody,
      });
      void showDevBackendToastOnce();
    }

    throw new ApiRequestError(message, endpoint, res.status, responseBody);
  }

  clearApiErrorLog();
  return res.json();
}
