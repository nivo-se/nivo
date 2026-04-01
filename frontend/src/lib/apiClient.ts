/**
 * Shared API base URL for backend calls.
 * In dev: omit VITE_API_BASE_URL so requests use same-origin /api → Vite proxy to FastAPI
 * (proxy target: VITE_DEV_API_PROXY_TARGET in frontend/.env.local; see vite.config.ts).
 * In production, set VITE_API_BASE_URL to the public API origin.
 */
export const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").trim();

if (!import.meta.env.DEV && !API_BASE) {
  // eslint-disable-next-line no-console
  console.warn("VITE_API_BASE_URL is not set. Backend API calls will use same-origin paths.");
}
