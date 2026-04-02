/**
 * Shared API base URL for backend calls.
 * In dev: omit VITE_API_BASE_URL so requests use same-origin /api → Vite proxy to FastAPI
 * (proxy target: VITE_DEV_API_PROXY_TARGET in frontend/.env.local; see vite.config.ts).
 * In production, set VITE_API_BASE_URL to the public API origin.
 */

function _envTruthy(v: unknown): boolean {
  if (v === true) return true
  if (v === false || v === undefined) return false
  const s = String(v).toLowerCase().trim()
  return s === "1" || s === "true" || s === "yes"
}

function resolveApiBase(): string {
  const raw = (import.meta.env.VITE_API_BASE_URL ?? "").trim()
  // HARD GUARDRAIL: keep local dev on same-origin `/api` when auth is disabled.
  // Why: frontend/.env commonly points VITE_API_BASE_URL at production; using that in dev without JWT
  // causes 401 on Universe and the dashboard appears as 0 companies.
  // Only bypass this by setting VITE_DEV_ALLOW_REMOTE_API=true on purpose.
  if (
    import.meta.env.DEV &&
    _envTruthy(import.meta.env.VITE_DISABLE_AUTH) &&
    !_envTruthy(import.meta.env.VITE_DEV_ALLOW_REMOTE_API)
  ) {
    return ""
  }
  return raw
}

export const API_BASE = resolveApiBase();

if (!import.meta.env.DEV && !API_BASE) {
  // eslint-disable-next-line no-console
  console.warn("VITE_API_BASE_URL is not set. Backend API calls will use same-origin paths.");
}
