/**
 * Shared API base URL for backend calls.
 * In dev with no VITE_API_BASE_URL: use '' so requests go through Vite proxy → FastAPI (8000).
 * Otherwise use env var or fallback.
 */
export const API_BASE =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? "" : "http://127.0.0.1:8000");
