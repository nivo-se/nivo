/**
 * Valuation Assumptions Loader
 * Loads and manages valuation assumptions from database with fallbacks
 */

import { SupabaseClient } from '@supabase/supabase-js'
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

/**
 * Load assumptions for a specific model and company profile
 */
export async function loadAssumptions(
  supabase: SupabaseClient,
  modelKey: string,
  industry: string,
  sizeBucket: string,
  growthBucket: string,
  overrides?: AssumptionsOverride
): Promise<ValuationAssumptions> {
  try {
    // Try to find exact match first
    let { data, error } = await supabase
      .from('valuation_assumptions')
      .select('*')
      .eq('model_key', modelKey)
      .eq('industry', industry)
      .eq('size_bucket', sizeBucket)
      .eq('growth_bucket', growthBucket)
      .single()

    // If no exact match, try with null industry (generic)
    if (error && error.code === 'PGRST116') {
      const { data: genericData, error: genericError } = await supabase
        .from('valuation_assumptions')
        .select('*')
        .eq('model_key', modelKey)
        .is('industry', null)
        .eq('size_bucket', sizeBucket)
        .eq('growth_bucket', growthBucket)
        .single()

      if (!genericError && genericData) {
        data = genericData
        error = null
      }
    }

    // If still no match, try with null size/growth (most generic)
    if (error && error.code === 'PGRST116') {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('valuation_assumptions')
        .select('*')
        .eq('model_key', modelKey)
        .is('industry', null)
        .is('size_bucket', null)
        .is('growth_bucket', null)
        .single()

      if (!fallbackError && fallbackData) {
        data = fallbackData
        error = null
      }
    }

    // If still no match, use defaults
    if (error || !data) {
      console.warn(`No assumptions found for ${modelKey}, using defaults`)
      return getDefaultAssumptions(modelKey, overrides)
    }

    // Convert database record to assumptions object
    const assumptions: ValuationAssumptions = {
      modelKey: data.model_key,
      revenueMultiple: data.revenue_multiple,
      ebitdaMultiple: data.ebitda_multiple,
      earningsMultiple: data.earnings_multiple,
      discountRate: data.discount_rate,
      terminalMultiple: data.terminal_multiple,
      netDebtMethod: (data.net_debt_method as any) || 'zero',
      netDebtK: data.net_debt_k,
      netDebtDirect: undefined // Not stored in DB, only from overrides
    }

    // Apply overrides if provided
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

/**
 * Load all assumptions for a company profile
 */
export async function loadAllAssumptions(
  supabase: SupabaseClient,
  industry: string,
  sizeBucket: string,
  growthBucket: string,
  overrides?: AssumptionsOverride[]
): Promise<ValuationAssumptions[]> {
  const modelKeys = ['revenue_multiple', 'ebitda_multiple', 'earnings_multiple', 'dcf_lite', 'hybrid_score']
  const assumptions: ValuationAssumptions[] = []

  for (const modelKey of modelKeys) {
    const override = overrides?.find(o => o.modelKey === modelKey)
    const assumption = await loadAssumptions(supabase, modelKey, industry, sizeBucket, growthBucket, override)
    assumptions.push(assumption)
  }

  return assumptions
}

/**
 * Get default assumptions when database lookup fails
 */
function getDefaultAssumptions(modelKey: string, overrides?: AssumptionsOverride): ValuationAssumptions {
  const defaults: Record<string, Partial<ValuationAssumptions>> = {
    revenue_multiple: {
      revenueMultiple: 1.5,
      netDebtMethod: 'ratio_revenue',
      netDebtK: 0.2
    },
    ebitda_multiple: {
      ebitdaMultiple: 6.0,
      netDebtMethod: 'ratio_revenue',
      netDebtK: 0.2
    },
    earnings_multiple: {
      earningsMultiple: 8.0,
      netDebtMethod: 'ratio_revenue',
      netDebtK: 0.2
    },
    dcf_lite: {
      discountRate: 0.10,
      terminalMultiple: 8.0,
      netDebtMethod: 'ratio_revenue',
      netDebtK: 0.2
    },
    hybrid_score: {
      netDebtMethod: 'ratio_revenue',
      netDebtK: 0.2
    }
  }

  const defaultAssumptions: ValuationAssumptions = {
    modelKey,
    netDebtMethod: 'zero',
    ...defaults[modelKey]
  }

  // Apply overrides if provided
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

/**
 * Get all available assumptions for admin editing
 */
export async function getAllAssumptions(supabase: SupabaseClient): Promise<ValuationAssumptionsRecord[]> {
  try {
    const { data, error } = await supabase
      .from('valuation_assumptions')
      .select('*')
      .order('model_key', { ascending: true })
      .order('industry', { ascending: true })
      .order('size_bucket', { ascending: true })
      .order('growth_bucket', { ascending: true })

    if (error) {
      console.error('Error loading all assumptions:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error loading all assumptions:', error)
    return []
  }
}

/**
 * Update assumptions (admin only)
 */
export async function updateAssumptions(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<ValuationAssumptionsRecord>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('valuation_assumptions')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      console.error('Error updating assumptions:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error updating assumptions:', error)
    return false
  }
}

/**
 * Create new assumptions (admin only)
 */
export async function createAssumptions(
  supabase: SupabaseClient,
  assumptions: Omit<ValuationAssumptionsRecord, 'id' | 'created_at' | 'updated_at'>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('valuation_assumptions')
      .insert(assumptions)

    if (error) {
      console.error('Error creating assumptions:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error creating assumptions:', error)
    return false
  }
}

/**
 * Delete assumptions (admin only)
 */
export async function deleteAssumptions(supabase: SupabaseClient, id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('valuation_assumptions')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting assumptions:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error deleting assumptions:', error)
    return false
  }
}
