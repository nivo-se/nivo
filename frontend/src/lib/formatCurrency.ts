/**
 * Currency formatting utilities for displaying SEK values.
 * 
 * IMPORTANT: Database now stores values in actual SEK (not thousands).
 * Allabolag values are multiplied by 1000 when stored.
 * 
 * Example:
 * - Database: 125,265,353 SEK (actual SEK)
 * - Display: 125.3 mSEK (millions) or 0.1 bSEK (billions)
 */

/**
 * Format a SEK value for display
 * 
 * @param value - Value in SEK (actual SEK, not thousands)
 * @param decimals - Number of decimal places (default: 1)
 * @param unit - Unit to display ('auto', 'mSEK', 'bSEK', 'tSEK', 'SEK')
 * @returns Formatted string like "125.3 mSEK" or "0.1 bSEK"
 */
export function formatCurrency(
  value: number | null | undefined,
  decimals: number = 1,
  unit: 'auto' | 'mSEK' | 'bSEK' | 'tSEK' | 'SEK' = 'auto'
): string {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return 'N/A'
  }

  // Handle string values that might come from API
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  
  if (typeof numValue !== 'number' || !Number.isFinite(numValue) || Number.isNaN(numValue)) {
    return 'N/A'
  }

  // Handle zero
  if (numValue === 0) {
    return '0 SEK'
  }

  // Auto-detect unit if not specified
  if (unit === 'auto') {
    const absValue = Math.abs(numValue)
    
    if (absValue >= 1_000_000_000) {
      // Billions
      const billions = numValue / 1_000_000_000
      return `${billions.toFixed(decimals)} bSEK`
    } else if (absValue >= 1_000_000) {
      // Millions
      const millions = numValue / 1_000_000
      return `${millions.toFixed(decimals)} mSEK`
    } else if (absValue >= 1_000) {
      // Thousands
      const thousands = numValue / 1_000
      return `${thousands.toFixed(decimals)} tSEK`
    } else {
      // Actual SEK
      return `${numValue.toFixed(0)} SEK`
    }
  }

  // Use specified unit
  switch (unit) {
    case 'bSEK':
      return `${(numValue / 1_000_000_000).toFixed(decimals)} bSEK`
    case 'mSEK':
      return `${(numValue / 1_000_000).toFixed(decimals)} mSEK`
    case 'tSEK':
      return `${(numValue / 1_000).toFixed(decimals)} tSEK`
    case 'SEK':
      return `${numValue.toFixed(0)} SEK`
    default:
      return `${numValue.toFixed(decimals)} SEK`
  }
}

/**
 * Format a SEK value as a compact number (e.g., "125M" instead of "125.3 mSEK")
 * 
 * @param value - Value in SEK
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted string like "125.3M" or "0.1B"
 */
export function formatCurrencyCompact(
  value: number | null | undefined,
  decimals: number = 1
): string {
  if (value === null || value === undefined) {
    return 'N/A'
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value
  
  if (typeof numValue !== 'number' || !Number.isFinite(numValue) || Number.isNaN(numValue)) {
    return 'N/A'
  }

  const absValue = Math.abs(numValue)
  
  if (absValue >= 1_000_000_000) {
    return `${(numValue / 1_000_000_000).toFixed(decimals)}B`
  } else if (absValue >= 1_000_000) {
    return `${(numValue / 1_000_000).toFixed(decimals)}M`
  } else if (absValue >= 1_000) {
    return `${(numValue / 1_000).toFixed(decimals)}K`
  } else {
    return `${numValue.toFixed(0)}`
  }
}

/**
 * Format a SEK value with full locale formatting (e.g., "125 265 353 SEK")
 * 
 * @param value - Value in SEK
 * @returns Formatted string with Swedish locale formatting
 */
export function formatCurrencyFull(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return 'N/A'
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value
  
  if (typeof numValue !== 'number' || !Number.isFinite(numValue) || Number.isNaN(numValue)) {
    return 'N/A'
  }

  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(numValue)
}

/**
 * Format a percentage value
 * 
 * @param value - Percentage value (e.g., 15.5 for 15.5%)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted string like "15.5%"
 */
export function formatPercentage(
  value: number | null | undefined,
  decimals: number = 1
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'N/A'
  }

  return `${Number(value).toFixed(decimals)}%`
}

