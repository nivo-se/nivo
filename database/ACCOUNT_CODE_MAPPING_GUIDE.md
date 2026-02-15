# Allabolag Account Code Mapping Guide

## Overview

This document provides the authoritative mapping between Allabolag account codes and financial metrics. Use this to ensure 100% accuracy in data extraction and display.

## Critical Mappings

### Revenue

| Code | Swedish Name | English Name | Value (Example) | Usage |
|------|--------------|--------------|-----------------|-------|
| **SI** | Nettoomsättning | Net Revenue | 121,329 tSEK | **PREFERRED** - Matches Allabolag's displayed revenue |
| SDI | Omsättning | Total Revenue | 121,450 tSEK | Fallback - May include all revenue streams |

**Recommendation**: Use **SI** for revenue display to match Allabolag exactly.

### EBIT (Operating Profit)

| Code | Swedish Name | English Name | Value (Example) | Usage |
|------|--------------|--------------|-----------------|-------|
| **resultat_e_avskrivningar** | Rörelseresultat efter avskrivningar | Operating Profit after Depreciation | 69 tSEK | **PREFERRED** - Matches Allabolag's EBIT |
| RG | Rörelsekapital | Working Capital | 129 tSEK | **DO NOT USE** - This is working capital, NOT EBIT! |

**⚠️ CRITICAL**: RG is **NOT** EBIT. It's working capital. Always use `resultat_e_avskrivningar` for EBIT.

### EBITDA

| Code | Swedish Name | English Name | Value (Example) | Usage |
|------|--------------|--------------|-----------------|-------|
| **EBITDA** | EBITDA | EBITDA | 82 tSEK | **PREFERRED** if available |
| ORS | Rörelseresultat | Operating Result | 7 tSEK | Fallback |

### Net Profit

| Code | Swedish Name | English Name | Value (Example) | Usage |
|------|--------------|--------------|-----------------|-------|
| **DR** | Årets resultat | Net Profit | 4 tSEK | Use for net profit/loss |

## Complete Account Code List

See `allabolag_account_code_mapping.json` for the complete list of all account codes with descriptions.

## Implementation

### Database Schema

The `financials` table stores account codes as columns:
- `si_sek` - Net revenue (preferred)
- `sdi_sek` - Total revenue (fallback)
- `resultat_e_avskrivningar_sek` - EBIT (preferred)
- `rg_sek` - Working capital (NOT EBIT!)
- `ebitda_sek` - EBITDA
- `ors_sek` - Operating result (EBITDA fallback)
- `dr_sek` - Net profit

### API Usage

```sql
-- Correct way to get revenue and EBIT:
SELECT 
    COALESCE(si_sek, sdi_sek) as revenue_sek,
    COALESCE(resultat_e_avskrivningar_sek, NULL) as ebit_sek,  -- Don't fallback to RG!
    COALESCE(ebitda_sek, ors_sek) as ebitda_sek,
    dr_sek as profit_sek
FROM financials
```

## Data Quality Rules

1. **Revenue**: Always prefer SI over SDI
2. **EBIT**: Always use `resultat_e_avskrivningar`, never RG
3. **EBITDA**: Prefer EBITDA code, fallback to ORS
4. **Thousands Conversion**: All values multiplied by 1000 (except ANT/employees)
5. **Currency**: All values in SEK unless currency field indicates otherwise

## Verification

To verify correct extraction:
1. Check `allabolag_account_code_mapping.json` for expected values
2. Compare extracted values with Allabolag website display
3. Ensure SI matches "Nettoomsättning" in income statement
4. Ensure `resultat_e_avskrivningar` matches "Rörelseresultat efter avskrivningar"

