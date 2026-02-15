# EBIT Data Verification Report

## Summary

✅ **EBIT data is present and correctly stored in the database**

## Database Status

### Optimized Database (`data/nivo_optimized.db`)

**Table**: `financials`  
**Column**: `resultat_e_avskrivningar_sek` (correct account code for EBIT)

**Statistics**:
- **Total financial records**: 66,130
- **Records with EBIT**: 66,130 (100%)
- **Records with non-zero EBIT**: 65,901 (99.7%)
- **Min EBIT**: -6,563,879,000 SEK
- **Max EBIT**: 21,873,382,000 SEK
- **Avg EBIT**: 7,346,710 SEK

### Account Code Mapping

According to `database/allabolag_account_code_mapping.json`:
- **Correct code**: `resultat_e_avskrivningar` = "Rörelseresultat efter avskrivningar" (Operating Profit after Depreciation) = **EBIT**
- **Incorrect code**: `RG` = "Rörelsekapital" (Working Capital) - **DO NOT USE for EBIT**

✅ The database correctly uses `resultat_e_avskrivningar_sek` for EBIT.

## Sample Data

Recent records showing EBIT values:

| Company | Year | Revenue (MSEK) | EBIT (MSEK) | EBIT Margin |
|---------|------|----------------|-------------|-------------|
| Killbergs Bokhandel AB | 2025 | 57.5 | 2.6 | 4.5% |
| Aktiebolaget P.J. Haegerstrand | 2025 | 125.9 | 8.1 | 6.4% |
| Ingemar Larsson i Perstorp AB | 2025 | 134.2 | 0.3 | 0.2% |
| Microtec AB | 2025 | 97.6 | 4.7 | 4.8% |
| Ideus Sweden AB | 2025 | 54.9 | 3.7 | 6.7% |
| Aktiebolaget Klaes Jansson | 2025 | 99.2 | 7.3 | 7.4% |
| Norwesco Aktiebolag | 2025 | 115.2 | 12.2 | 10.5% |
| Kapsch TrafficCom AB | 2025 | 178.7 | 6.9 | 3.8% |
| Aktiebolaget Benzlers | 2025 | 116.8 | 0.6 | 0.5% |
| Matmarknad i Almås AB | 2025 | 86.5 | 0.7 | 0.8% |

## API Usage

The backend API (`backend/api/companies.py`) correctly uses EBIT:

```python
resultat_e_avskrivningar_sek as ebit_sek,  -- DO NOT fallback to RG (it's working capital!)
```

✅ The API correctly retrieves EBIT using the proper account code.

## Database Schema

The optimized database schema includes:
- `resultat_e_avskrivningar_sek NUMERIC` - EBIT (preferred)
- `ebitda_sek NUMERIC` - EBITDA
- `si_sek NUMERIC` - Net Revenue (preferred)
- `sdi_sek NUMERIC` - Total Revenue (fallback)

## Verification Query

To verify EBIT data in the future:

```sql
SELECT 
    COUNT(*) as total,
    COUNT(resultat_e_avskrivningar_sek) as has_ebit,
    COUNT(CASE WHEN resultat_e_avskrivningar_sek IS NOT NULL AND resultat_e_avskrivningar_sek != 0 THEN 1 END) as non_zero_ebit,
    MIN(resultat_e_avskrivningar_sek) as min_ebit,
    MAX(resultat_e_avskrivningar_sek) as max_ebit,
    AVG(resultat_e_avskrivningar_sek) as avg_ebit
FROM financials;
```

## Conclusion

✅ **All EBIT data is present and correctly stored using the proper account code (`resultat_e_avskrivningar`).**

The database contains:
- 66,130 financial records
- 100% have EBIT values
- Correct account code mapping
- Proper API integration

No action needed - EBIT data is complete and accurate.

