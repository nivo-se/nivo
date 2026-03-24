/**
 * Valuation assumptions — loaded from Postgres via pg Pool.
 */

import type { Pool } from 'pg'
import { ValuationAssumptions } from './engine.js'

export interface ValuationAssumptionsRecord {
  id: string
  model_key: string
  industry: string | null
  size_bucket: string | null
  growth_bucket: string | null
  revenue_multiple: number | null
  ebitda_multiple: number | null
  earnings_multiple: number | null
  discount_rate: number | null
  terminal_multiple: number | null
  net_debt_method: string
  net_debt_k: number | null
  range_min: number | null
  range_max: number | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface AssumptionsOverride {
  modelKey: string
  revenueMultiple?: number
  ebitdaMultiple?: number
  earningsMultiple?: number
  discountRate?: number
  terminalMultiple?: number
  netDebtMethod?: 'direct' | 'ratio_revenue' | 'ratio_ebitda' | 'zero'
  netDebtK?: number
  netDebtDirect?: number
}

export async function loadAssumptions(
  pool: Pool,
  modelKey: string,
  industry: string,
  sizeBucket: string,
  growthBucket: string,
  overrides?: AssumptionsOverride
): Promise<ValuationAssumptions> {
  try {
    let data =
      (
        await pool.query(
          `SELECT * FROM valuation_assumptions
           WHERE model_key = $1 AND industry = $2 AND size_bucket = $3 AND growth_bucket = $4
           LIMIT 1`,
          [modelKey, industry, sizeBucket, growthBucket]
        )
      ).rows[0] ?? null

    if (!data) {
      const generic =
        (
          await pool.query(
            `SELECT * FROM valuation_assumptions
             WHERE model_key = $1 AND industry IS NULL AND size_bucket = $2 AND growth_bucket = $3
             LIMIT 1`,
            [modelKey, sizeBucket, growthBucket]
          )
        ).rows[0] ?? null
      data = generic
    }

    if (!data) {
      const fallback =
        (
          await pool.query(
            `SELECT * FROM valuation_assumptions
             WHERE model_key = $1 AND industry IS NULL AND size_bucket IS NULL AND growth_bucket IS NULL
             LIMIT 1`,
            [modelKey]
          )
        ).rows[0] ?? null
      data = fallback
    }

    if (!data) {
      console.warn(`No assumptions found for ${modelKey}, using defaults`)
      return getDefaultAssumptions(modelKey, overrides)
    }

    const assumptions: ValuationAssumptions = {
      modelKey: data.model_key,
      revenueMultiple: data.revenue_multiple,
      ebitdaMultiple: data.ebitda_multiple,
      earningsMultiple: data.earnings_multiple,
      discountRate: data.discount_rate,
      terminalMultiple: data.terminal_multiple,
      netDebtMethod: (data.net_debt_method as ValuationAssumptions['netDebtMethod']) || 'zero',
      netDebtK: data.net_debt_k,
      netDebtDirect: undefined,
    }

    if (overrides && overrides.modelKey === modelKey) {
      if (overrides.revenueMultiple !== undefined) assumptions.revenueMultiple = overrides.revenueMultiple
      if (overrides.ebitdaMultiple !== undefined) assumptions.ebitdaMultiple = overrides.ebitdaMultiple
      if (overrides.earningsMultiple !== undefined) assumptions.earningsMultiple = overrides.earningsMultiple
      if (overrides.discountRate !== undefined) assumptions.discountRate = overrides.discountRate
      if (overrides.terminalMultiple !== undefined) assumptions.terminalMultiple = overrides.terminalMultiple
      if (overrides.netDebtMethod !== undefined) assumptions.netDebtMethod = overrides.netDebtMethod
      if (overrides.netDebtK !== undefined) assumptions.netDebtK = overrides.netDebtK
      if (overrides.netDebtDirect !== undefined) assumptions.netDebtDirect = overrides.netDebtDirect
    }

    return assumptions
  } catch (error) {
    console.error('Error loading assumptions:', error)
    return getDefaultAssumptions(modelKey, overrides)
  }
}

export async function loadAllAssumptions(
  pool: Pool,
  industry: string,
  sizeBucket: string,
  growthBucket: string,
  overrides?: AssumptionsOverride[]
): Promise<ValuationAssumptions[]> {
  const modelKeys = ['revenue_multiple', 'ebitda_multiple', 'earnings_multiple', 'dcf_lite', 'hybrid_score']
  const assumptions: ValuationAssumptions[] = []

  for (const modelKey of modelKeys) {
    const override = overrides?.find((o) => o.modelKey === modelKey)
    const assumption = await loadAssumptions(pool, modelKey, industry, sizeBucket, growthBucket, override)
    assumptions.push(assumption)
  }

  return assumptions
}

function getDefaultAssumptions(modelKey: string, overrides?: AssumptionsOverride): ValuationAssumptions {
  const defaults: Record<string, Partial<ValuationAssumptions>> = {
    revenue_multiple: {
      revenueMultiple: 1.5,
      netDebtMethod: 'ratio_revenue',
      netDebtK: 0.2,
    },
    ebitda_multiple: {
      ebitdaMultiple: 6.0,
      netDebtMethod: 'ratio_revenue',
      netDebtK: 0.2,
    },
    earnings_multiple: {
      earningsMultiple: 8.0,
      netDebtMethod: 'ratio_revenue',
      netDebtK: 0.2,
    },
    dcf_lite: {
      discountRate: 0.1,
      terminalMultiple: 8.0,
      netDebtMethod: 'ratio_revenue',
      netDebtK: 0.2,
    },
    hybrid_score: {
      netDebtMethod: 'ratio_revenue',
      netDebtK: 0.2,
    },
  }

  const defaultAssumptions: ValuationAssumptions = {
    modelKey,
    netDebtMethod: 'zero',
    ...defaults[modelKey],
  }

  if (overrides && overrides.modelKey === modelKey) {
    if (overrides.revenueMultiple !== undefined) defaultAssumptions.revenueMultiple = overrides.revenueMultiple
    if (overrides.ebitdaMultiple !== undefined) defaultAssumptions.ebitdaMultiple = overrides.ebitdaMultiple
    if (overrides.earningsMultiple !== undefined) defaultAssumptions.earningsMultiple = overrides.earningsMultiple
    if (overrides.discountRate !== undefined) defaultAssumptions.discountRate = overrides.discountRate
    if (overrides.terminalMultiple !== undefined) defaultAssumptions.terminalMultiple = overrides.terminalMultiple
    if (overrides.netDebtMethod !== undefined) defaultAssumptions.netDebtMethod = overrides.netDebtMethod
    if (overrides.netDebtK !== undefined) defaultAssumptions.netDebtK = overrides.netDebtK
    if (overrides.netDebtDirect !== undefined) defaultAssumptions.netDebtDirect = overrides.netDebtDirect
  }

  return defaultAssumptions
}

export async function getAllAssumptions(pool: Pool): Promise<ValuationAssumptionsRecord[]> {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM valuation_assumptions
       ORDER BY model_key ASC, industry ASC NULLS LAST, size_bucket ASC NULLS LAST, growth_bucket ASC NULLS LAST`
    )
    return rows as ValuationAssumptionsRecord[]
  } catch (error) {
    console.error('Error loading all assumptions:', error)
    return []
  }
}

export async function updateAssumptions(
  pool: Pool,
  id: string,
  updates: Partial<ValuationAssumptionsRecord>
): Promise<boolean> {
  try {
    const keys = Object.keys(updates).filter((k) => k !== 'id' && k !== 'created_at')
    if (keys.length === 0) return true
    const setCl = keys.map((k, i) => `${k} = $${i + 2}`).join(', ')
    const vals = keys.map((k) => (updates as Record<string, unknown>)[k])
    await pool.query(
      `UPDATE valuation_assumptions SET ${setCl}, updated_at = NOW() WHERE id = $1`,
      [id, ...vals]
    )
    return true
  } catch (error) {
    console.error('Error updating assumptions:', error)
    return false
  }
}

export async function createAssumptions(
  pool: Pool,
  assumptions: Omit<ValuationAssumptionsRecord, 'id' | 'created_at' | 'updated_at'>
): Promise<boolean> {
  try {
    const cols = Object.keys(assumptions)
    const vals = Object.values(assumptions)
    const ph = cols.map((_, i) => `$${i + 1}`).join(', ')
    await pool.query(`INSERT INTO valuation_assumptions (${cols.join(', ')}) VALUES (${ph})`, vals)
    return true
  } catch (error) {
    console.error('Error creating assumptions:', error)
    return false
  }
}

export async function deleteAssumptions(pool: Pool, id: string): Promise<boolean> {
  try {
    await pool.query('DELETE FROM valuation_assumptions WHERE id = $1', [id])
    return true
  } catch (error) {
    console.error('Error deleting assumptions:', error)
    return false
  }
}
