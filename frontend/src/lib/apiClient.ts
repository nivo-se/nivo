/**
 * Shared API base URL for backend calls.
 * In dev with no VITE_API_BASE_URL: use '' so requests go through Vite proxy.
 * In production, VITE_API_BASE_URL should point to the backend API domain.
 * If missing in production, requests use same-origin path and will fail fast unless proxied.
 */
export const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").trim();

if (!import.meta.env.DEV && !API_BASE) {
  // eslint-disable-next-line no-console
  console.warn("VITE_API_BASE_URL is not set. Backend API calls will use same-origin paths.");
}
