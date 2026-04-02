/**
 * Shared node-pg Pool options: TCP keepalive + timeouts so idle Docker/LAN connections
 * don't appear as random "DB down" until process restart.
 */
import type { PoolConfig } from "pg"

export const PG_POOL_OPTIONS: Pick<
  PoolConfig,
  | "max"
  | "idleTimeoutMillis"
  | "connectionTimeoutMillis"
  | "keepAlive"
  | "keepAliveInitialDelayMillis"
> = {
  max: 20,
  idleTimeoutMillis: 60_000,
  connectionTimeoutMillis: 15_000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
}

export function attachPoolErrorLogging(pool: { on: (ev: "error", fn: (err: Error) => void) => void }, label: string) {
  pool.on("error", (err) => {
    console.error(`[${label}] Postgres pool idle client error (will reconnect on next query):`, err?.message || err)
  })
}
