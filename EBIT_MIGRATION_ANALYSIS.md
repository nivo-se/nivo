# EBIT Data Migration Analysis

## Summary

✅ **EBIT data is present in the optimized database** - 100% of records (66,130/66,130) have EBIT values.

However, there are some data reductions during migration:

## Data Loss During Migration

### 1. Year Filtering
- **Filter**: Migration script filters `year >= 2020` (line 362 in `create_optimized_db.py`)
- **Records lost**: 484 records (from years 2019 and earlier)
- **Impact**: Historical data before 2020 is excluded

### 2. Database Size Reduction
- **Staging DB**: 1,380.8 MB
- **Optimized DB**: 36.0 MB  
- **Reduction**: 97.4%
- **Reason**: Raw JSON data is removed, only extracted account codes are kept

## EBIT Extraction Process

The migration script extracts EBIT from `raw_data` JSON:

1. **Source**: `staging_financials.raw_data` (JSON from Allabolag)
2. **Extraction**: `extract_account_codes_from_raw_data()` function
3. **Account Code**: `resultat_e_avskrivningar` (correct EBIT code)
4. **Storage**: Stored in `resultat_e_avskrivningar_sek` column

### Extraction Logic
```python
# Finds matching year and period in companyAccounts
# Extracts resultat_e_avskrivningar from accounts array
# Converts from thousands to SEK (multiplies by 1000)
```

## Verification Results

### Segers Fabriker Example
- **2024 EBIT**: 7,593,000 SEK ✅
- **Source**: Extracted from `raw_data` JSON
- **Storage**: `resultat_e_avskrivningar_sek` column
- **Status**: Correctly migrated

### Overall Statistics
- **Total records (year >= 2020)**: 66,130
- **Records with EBIT**: 66,130 (100%)
- **Records without EBIT**: 0

## Potential Issues

### 1. Period Format Matching
The extraction matches periods using:
- Exact match: `period == '2024-12'`
- Or ends with `-12`: `period.endswith('-12')`
- Or equals `'12'`: `period == '12'`

**Status**: ✅ Working correctly

### 2. Year Filtering
Records from 2019 and earlier are excluded.

**Impact**: If you need historical data, you'll need to:
- Remove the `year >= 2020` filter, OR
- Keep staging database for historical queries

### 3. Missing Raw Data
If `raw_data` is NULL or malformed, extraction falls back to:
- `revenue` column → `SDI` account code
- `profit` column → `DR` account code

**Note**: This fallback does NOT include EBIT (`resultat_e_avskrivningar`)

## Recommendations

### If EBIT Values Are Missing

1. **Check specific companies**: Query the optimized DB directly:
   ```sql
   SELECT resultat_e_avskrivningar_sek 
   FROM financials 
   WHERE orgnr = 'YOUR_ORGNR' AND year = 2024
   ```

2. **Check staging database**: Verify EBIT exists in source:
   ```sql
   SELECT raw_data 
   FROM staging_financials 
   WHERE orgnr = 'YOUR_ORGNR' AND year = 2024
   ```
   Then search for `"resultat_e_avskrivningar"` in the JSON

3. **Re-run migration**: If data is missing, re-run with:
   ```bash
   python3 scripts/create_optimized_db.py \
     --source scraper/allabolag-scraper/staging/staging_50_200_combined.db \
     --output data/nivo_optimized.db \
     --discover-codes
   ```

### If You Need Historical Data

Modify `scripts/create_optimized_db.py` line 362:
```python
# Change from:
WHERE sf.year >= 2020

# To:
WHERE sf.year >= 2015  # or remove filter entirely
```

## Conclusion

✅ **EBIT data migration is working correctly** for all records in the optimized database.

The 484 missing records are due to the `year >= 2020` filter, not extraction failures.

If you're seeing missing EBIT values, please provide:
- Specific company ORGNR
- Year
- Expected vs actual value

This will help identify if there's a specific extraction issue.

