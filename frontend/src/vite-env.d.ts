/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DISABLE_AUTH?: string
  readonly VITE_AUTH0_DOMAIN?: string
  readonly VITE_AUTH0_CLIENT_ID?: string
  readonly VITE_AUTH0_AUDIENCE?: string
  readonly VITE_API_BASE_URL?: string
  /** Dev only: when true with VITE_DISABLE_AUTH, still use VITE_API_BASE_URL (remote API + real JWT testing). */
  readonly VITE_DEV_ALLOW_REMOTE_API?: string
  /** Dev only: FastAPI URL for Vite proxy (/api, /health). Set per machine in .env.local. */
  readonly VITE_DEV_API_PROXY_TARGET?: string
  /** Dev only: enhanced-server URL for Vite proxy (/crm). */
  readonly VITE_CRM_SERVER_URL?: string
  /** Unified product nav (Today, Companies, Pipeline, Inbox, Research) */
  readonly VITE_NAV_UNIFIED_V1?: string
  /** Hide "In development" sidebar block */
  readonly VITE_HIDE_IN_DEVELOPMENT?: string
  /** Legacy nav: hide Prospects + GPT target universe */
  readonly VITE_HIDE_LEGACY_SURFACES?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
