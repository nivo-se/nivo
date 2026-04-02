/**
 * Shared Postgres pool for the Node analysis server.
 * Uses DATABASE_URL or POSTGRES_* from the same .env as the rest of the stack.
 */

import pg from 'pg'
import { PG_POOL_OPTIONS, attachPoolErrorLogging } from './pg-pool-options.js'

const { Pool } = pg

let pool: pg.Pool | null = null

export function getAppPool(): pg.Pool | null {
  if (pool) return pool
  try {
    const url = process.env.DATABASE_URL
    if (url) {
      pool = new Pool({ connectionString: url, ...PG_POOL_OPTIONS })
    } else {
      const host = process.env.POSTGRES_HOST || 'localhost'
      const port = Number(process.env.POSTGRES_PORT || 5433)
      const database = process.env.POSTGRES_DB || 'nivo'
      const user = process.env.POSTGRES_USER || 'nivo'
      const password = process.env.POSTGRES_PASSWORD || 'nivo'
      pool = new Pool({ host, port, database, user, password, ...PG_POOL_OPTIONS })
    }
    attachPoolErrorLogging(pool, 'app-db')
    return pool
  } catch (e) {
    console.error('[app-db] Pool init failed:', e)
    return null
  }
}

