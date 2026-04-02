/**
 * Frontend feature flags (Vite env).
 * Unified nav defaults on (primary product shell); see README "Unified Nav v1" and .env.example.
 */

function readEnvBool(value: string | undefined): boolean {
  if (value === undefined || value === "") return false;
  const v = String(value).trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

function readEnvBoolDefaultUnifiedNav(value: string | undefined): boolean {
  if (value === undefined) return true;
  const v = String(value).trim();
  if (v === "") return true;
  const lower = v.toLowerCase();
  if (lower === "false" || lower === "0" || lower === "no") return false;
  return true;
}

/** Primary nav: segmented shell (Daily workstreams / Research / CRM) with phase-1 route aliases. Default on. */
export function isNavUnifiedV1(): boolean {
  return readEnvBoolDefaultUnifiedNav(import.meta.env.VITE_NAV_UNIFIED_V1);
}

/** Hide "In development" sidebar section (screening, deep research preview links). */
export function isHideInDevelopmentNav(): boolean {
  return readEnvBool(import.meta.env.VITE_HIDE_IN_DEVELOPMENT);
}

/**
 * When legacy nav is active, hide Prospects and GPT target universe from the sidebar.
 * (Unified nav already omits them.)
 */
export function isHideLegacySurfacesNav(): boolean {
  return readEnvBool(import.meta.env.VITE_HIDE_LEGACY_SURFACES);
}
