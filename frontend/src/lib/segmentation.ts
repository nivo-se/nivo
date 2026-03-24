/**
 * Segmentation tiers — tiered company lists were previously loaded from Postgres via a direct client.
 * Tier queries now run through the API / DB layer; this module returns empty tiers until a dedicated endpoint exists.
 */

import type { CompanyRecord } from './companyTypes'

export interface SegmentedTargets {
  tier1: CompanyRecord[]
  tier2: CompanyRecord[]
  tier3: CompanyRecord[]
}

export interface SegmentationOptions {
  limit1?: number
  limit2?: number
  limit3?: number
  includeMetrics?: boolean
}

export async function getSegmentedTargets(_options: SegmentationOptions = {}): Promise<SegmentedTargets> {
  return { tier1: [], tier2: [], tier3: [] }
}

export async function getSegmentationStats(): Promise<{
  tier1Count: number
  tier2Count: number
  tier3Count: number
  unsegmentedCount: number
}> {
  return {
    tier1Count: 0,
    tier2Count: 0,
    tier3Count: 0,
    unsegmentedCount: 0,
  }
}

/** No-op: scoring jobs run server-side / in batch pipelines. */
export async function refreshSegmentationScores(): Promise<{ ok: boolean; message: string }> {
  return { ok: true, message: 'Segmentation refresh is handled by backend jobs.' }
}
