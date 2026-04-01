/**
 * Frontend feature flags (Vite env). Defaults are conservative (off).
 * See README "Unified Nav v1" and .env.example.
 */

function readEnvBool(value: string | undefined): boolean {
  if (value === undefined || value === "") return false;
  const v = String(value).trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

/** Primary nav shows Today / Companies / Pipeline / Inbox / Research (phase-1 route aliases). */
export function isNavUnifiedV1(): boolean {
  return readEnvBool(import.meta.env.VITE_NAV_UNIFIED_V1);
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
