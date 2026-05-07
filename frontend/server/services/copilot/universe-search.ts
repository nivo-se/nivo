import { getLocalDB, localDBExists } from '../../local-db.js'

export interface UniverseSearchRow {
  orgnr: string
  name: string
  revenue_sek: number | null
  city: string | null
  homepage: string | null
}

export function searchUniverseForCopilot(opts: {
  search?: string
  min_revenue_sek?: number
  limit?: number
}): { ok: boolean; error?: string; rows?: UniverseSearchRow[] } {
  if (!localDBExists()) {
    return { ok: false, error: 'Local Universe database is not available on this server.' }
  }
  try {
    const db = getLocalDB()
    const limit = Math.min(Math.max(opts.limit ?? 8, 1), 25)
    const clauses: string[] = []
    const params: unknown[] = []

    if (opts.search?.trim()) {
      const p = `%${opts.search.trim()}%`
      clauses.push('(c.company_name LIKE ? OR c.orgnr LIKE ?)')
      params.push(p, p)
    }
    if (opts.min_revenue_sek != null && Number.isFinite(opts.min_revenue_sek)) {
      clauses.push('COALESCE(k.latest_revenue_sek, 0) >= ?')
      params.push(opts.min_revenue_sek)
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const sql = `
      SELECT c.orgnr, c.company_name, k.latest_revenue_sek, c.city, c.homepage
      FROM companies c
      LEFT JOIN company_kpis k ON c.orgnr = k.orgnr
      ${where}
      ORDER BY COALESCE(k.latest_revenue_sek, 0) DESC, c.company_name ASC
      LIMIT ?
    `
    const stmt = db.prepare(sql)
    const rows = stmt.all(...params, limit) as Array<{
      orgnr: string
      company_name: string
      latest_revenue_sek: number | null
      city: string | null
      homepage: string | null
    }>

    return {
      ok: true,
      rows: rows.map((r) => ({
        orgnr: r.orgnr,
        name: r.company_name,
        revenue_sek: r.latest_revenue_sek ?? null,
        city: r.city ?? null,
        homepage: r.homepage ?? null,
      })),
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}
