/** Financial helpers (shared by search / analytics). */

export function calculateGrowth(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || !isFinite(current) || !isFinite(previous) || previous <= 0) {
    return null
  }
  return ((current / previous) - 1) * 100
}

export function calculateEBITMargin(ebit: number | null, revenue: number | null): number | null {
  if (ebit == null || revenue == null || !isFinite(ebit) || !isFinite(revenue) || revenue <= 0) {
    return null
  }
  return (ebit / revenue) * 100
}

export function calculateProfitMargin(profit: number | null, revenue: number | null): number | null {
  if (profit == null || revenue == null || !isFinite(profit) || !isFinite(revenue) || revenue <= 0) {
    return null
  }
  return (profit / revenue) * 100
}
