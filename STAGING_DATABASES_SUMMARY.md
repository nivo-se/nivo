# Staging Databases Summary

## Current Situation

### Combined Database
- **File**: `scraper/allabolag-scraper/staging/staging_50_200_combined.db`
- **Size**: 1.3 GB
- **Companies**: 13,610
- **Financials**: 66,614 records
- **Status**: Only includes 2 sessions (Session 1 + Session 2)

### Individual Staging Databases

**Total Found**: 33 individual staging databases

**Main Sessions** (with financials):
1. **Session 1**: `staging_151e5a04-14f6-48db-843e-9dad22f371d0.db`
   - Size: 860 MB
   - Companies: 8,663
   - Financials: 42,324
   - ✅ Included in combined

2. **Session 2**: `staging_af674a42-4859-4e15-a641-9da834ddbb09.db`
   - Size: 522 MB
   - Companies: 4,947
   - Financials: 24,290
   - ✅ Included in combined

3. **Session 3**: `staging_de2cea99-ce04-4fce-bc15-695c672e4c22.db`
   - Size: 1.0 GB
   - Companies: 10,000
   - Financials: 48,947
   - ❌ **NOT included in combined** - Missing!

**Other Databases with Companies** (no financials):
- `staging_3d149ef7-78f7-47b0-8a2e-cda19c60b257.db`: 3,600 companies
- `staging_ccd7f390-518b-43e0-87c0-e4f5a5d22426.db`: 3,272 companies
- `staging_7365b232-96b9-45c0-ba89-96db8288204a.db`: 2,793 companies
- `staging_605d60b0-1799-4cb0-b693-aa4ad7085b56.db`: 2,793 companies
- `staging_98fbeb96-7006-4569-ad1c-3c4b47ff42d7.db`: 2,793 companies
- `staging_b534bd02-466b-448e-a127-e0a1f2c18efe.db`: 2,793 companies
- Plus many smaller ones...

## Data Gap Analysis

- **Combined database**: 13,610 companies
- **All individual databases total**: 53,346 companies
- **Missing**: ~39,736 companies (74% of data!)

### Specifically Missing:
- **Session 3**: 10,000 companies with 48,947 financial records
- **Many partial sessions**: Companies without financials (likely from incomplete scraping runs)

## Recommendation

### Option 1: Merge All Databases (Complete)
Merge ALL staging databases to capture everything:
```bash
python3 scripts/create_staging_snapshot.py \
  --output scraper/allabolag-scraper/staging/staging_ALL_COMBINED.db \
  scraper/allabolag-scraper/staging/staging_*.db
```

**Note**: This will include duplicates that need to be handled (INSERT OR REPLACE handles this).

### Option 2: Merge Only Complete Sessions (Recommended)
Merge only the 3 main sessions that have financials:
```bash
python3 scripts/create_staging_snapshot.py \
  --output scraper/allabolag-scraper/staging/staging_3_SESSIONS_COMBINED.db \
  scraper/allabolag-scraper/staging/staging_151e5a04-14f6-48db-843e-9dad22f371d0.db \
  scraper/allabolag-scraper/staging/staging_af674a42-4859-4e15-a641-9da834ddbb09.db \
  scraper/allabolag-scraper/staging/staging_de2cea99-ce04-4fce-bc15-695c672e4c22.db
```

This would give you ~23,610 unique companies (after deduplication).

### Option 3: Check What's Actually Missing
First, identify which companies are missing by comparing ORGNRs:
```bash
python3 scripts/compare_staging_databases.py
```

## Files Available

- **Merge script**: `scripts/create_staging_snapshot.py`
- **Migration script**: `scripts/migrate_staging_to_new_schema.py`
- **Documentation**: `docs/migration/runbook.md`

## Next Steps

1. **Identify missing data**: What specific companies/data are you looking for?
2. **Re-merge**: Run the merge script with all relevant databases
3. **Re-migrate**: Run the migration script to update the main database
4. **Validate**: Compare counts and verify data integrity

