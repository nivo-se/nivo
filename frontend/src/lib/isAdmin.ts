/**
 * Admin visibility: show Admin link and allow /admin when
 * - In dev (npm run dev): always (so you can always see and open Admin while developing), or
 * - GET /api/me returns role "admin", or
 * - user email is in VITE_ADMIN_EMAILS (comma-separated), or
 * - legacy hardcoded admin email (backward compat).
 */
const ADMIN_EMAILS_ENV = (import.meta.env.VITE_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

const LEGACY_ADMIN_EMAIL = "jesper@rgcapital.se";

export function isAdminUser(userRole: string | null, userEmail: string | null | undefined): boolean {
  if (userRole === "admin") return true;
  const email = (userEmail ?? "").trim().toLowerCase();
  if (!email) return false;
  if (email === LEGACY_ADMIN_EMAIL) return true;
  return ADMIN_EMAILS_ENV.includes(email);
}

/**
 * Whether to show the Admin nav link and allow access to /admin.
 * In dev: always true (so you always see and can open Admin when running npm run dev).
 * In production: only real admins (role or VITE_ADMIN_EMAILS).
 */
export function isAdminLinkVisible(
  userRole: string | null,
  userEmail: string | null | undefined,
  _isAuthenticated?: boolean
): boolean {
  if (import.meta.env.DEV) return true;
  return isAdminUser(userRole, userEmail);
}
