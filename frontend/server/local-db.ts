import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Local database path - using optimized database
const DB_PATH = path.resolve(__dirname, '../../data/nivo_optimized.db')

let dbInstance: Database.Database | null = null

/**
 * Get or create a connection to the local SQLite database
 */
export function getLocalDB(): Database.Database {
  if (dbInstance) {
    return dbInstance
  }

  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`Local database file not found: ${DB_PATH}`)
  }

  dbInstance = new Database(DB_PATH, { readonly: true })
  console.log(`[Local DB] Connected to database at: ${DB_PATH}`)
  
  return dbInstance
}

/**
 * Close the database connection
 */
export function closeLocalDB(): void {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
    console.log('[Local DB] Connection closed')
  }
}

/**
 * Check if local database exists
 */
export function localDBExists(): boolean {
  return fs.existsSync(DB_PATH)
}

/**
 * Get database path
 */
export function getLocalDBPath(): string {
  return DB_PATH
}

