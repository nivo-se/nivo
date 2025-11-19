# Financial Accounts Normalization - Implementation Roadmap

## Quick Decision Summary

**✅ RECOMMENDATION: Create normalized `financial_accounts` table**

### Why?
- **10-100x faster** SQL queries for AI analysis
- **Easier calculations** - direct SQL operations instead of JSONB parsing
- **Better scalability** - performance improves as data grows
- **AI-friendly** - enables complex analytical queries needed for AI analysis

### Trade-off
- **10x storage increase** (330MB vs 33MB) - minimal cost for significant benefits

---

## Implementation Steps

### Step 1: Generate Local Dataset with Normalized Schema ⏱️ 5 minutes

```bash
# Transform staging data into new schema + financial_accounts
python scripts/migrate_staging_to_new_schema.py \
    --source scraper/allabolag-scraper/staging/<combined.db> \
    --local-sqlite data/new_schema_local.db \
    --csv-dir data/csv_export
```

**Files:**
- `scripts/migrate_staging_to_new_schema.py` – now creates `financial_accounts` rows alongside `company_financials`
- `database/financial_accounts_schema_sqlite.sql` – SQLite schema executed within the script

**Output:**
- Updated `data/new_schema_local.db` containing `financial_accounts`
- CSV exports (`data/csv_export/*.csv`) including `financial_accounts.csv`

---

### Step 2: Materialise Account Codes Locally ⏱️ 5 minutes

Populate the normalized table from existing JSON blobs (idempotent):

```bash
# Preview changes
python scripts/migrate_account_codes_to_normalized_local.py --dry-run

# Execute migration
python scripts/migrate_account_codes_to_normalized_local.py \
    --db data/new_schema_local.db --truncate
```

**What it does:**
- Reads `company_financials.account_codes`
- Inserts rows into `financial_accounts` (one row per code)
- Supports dry-run and truncate options

---

### Step 3: Import Nordstjernan JSON Locally ⏱️ 5 minutes

```bash
python scripts/import_nordstjernan_to_financial_accounts_local.py \
    556000-0000 \
    --db data/new_schema_local.db \
    --json-dir .
```

**What it does:**
- Parses `nordstjernan_*_raw.json`
- Matches `orgnr/year/period` against local `company_financials`
- Inserts/updates normalized rows using deterministic IDs

---

### Step 4: Validate Local Data ⏱️ 2 minutes

```bash
python scripts/validate_financial_accounts_local.py --db data/new_schema_local.db
```

Checks include:
- Record coverage (no missing financial_id)
- Account code distribution
- Random spot checks against JSON payloads
- Accounts-per-company summary

---

### Step 5: Explore Queries Locally ⏱️ 2 minutes

- Use `database/financial_accounts_query_examples_sqlite.sql`
- Connect via `sqlite3 data/new_schema_local.db`
- Run AI analysis-style queries before exporting

---

### Step 6: Export Normalized Accounts to CSV ⏱️ 2 minutes

```bash
python scripts/export_financial_accounts_to_csv.py \
    --db data/new_schema_local.db \
    --out data/csv_export/financial_accounts.csv
```

CSV columns: `financial_id, orgnr, year, period, account_code, amount_sek, created_at`

---

### Step 7: Prepare Supabase Schema ⏱️ 5 minutes

```bash
psql $SUPABASE_DB_URL -f database/new_schema.sql
psql $SUPABASE_DB_URL -f database/financial_accounts_schema.sql
```

- `new_schema.sql` creates `companies`, `company_financials`, `company_metrics`
- `financial_accounts_schema.sql` creates normalized table and indexes

---

### Step 8: Load Data into Supabase ⏱️ 5-10 minutes

```bash
# Option A: Load just the normalized table
./scripts/load_financial_accounts_to_supabase.sh

# Option B: Load all tables in order (companies → financials → financial_accounts → metrics)
./scripts/load_data_to_supabase.sh
```

Both scripts respect `SUPABASE_DB_URL` (or `SUPABASE_DB_PASSWORD`). `load_data_to_supabase.sh` now expects `financial_accounts.csv` to exist.

---

### Step 9: Run Full Migration Workflow (Drop + Recreate) ⏱️ 5 minutes

```bash
./scripts/full_migration_local_to_supabase.sh
```

This script:
1. Drops `financial_accounts`, `company_metrics`, `company_financials`, `companies`
2. Recreates schema via `new_schema.sql` and `financial_accounts_schema.sql`
3. Loads CSV exports using `load_data_to_supabase.sh`
4. Prints post-load row counts

---

### Step 10: Update Data Pipeline (Future Work) ⏱️ 30-60 minutes

Modify your scraper/migration scripts to populate both:
1. `company_financials.account_codes` (JSONB) - for backward compatibility
2. `financial_accounts` (normalized) - for new queries

**Files to update:**
- `scripts/migrate_staging_to_new_schema.py` - Add insert into `financial_accounts`
- Scraper scripts that create financial records

**Example addition:**
```python
# After inserting into company_financials
financial_id = inserted_record['id']

# Also insert into financial_accounts
account_rows = [
    {
        "financial_id": financial_id,
        "orgnr": orgnr,
        "year": year,
        "period": period,
        "account_code": code,
        "amount_sek": amount,
    }
    for code, amount in account_codes.items()
]
supabase.table("financial_accounts").upsert(account_rows).execute()
```

---

### Step 11: Update AI Analysis Code (Future) ⏱️ 1-2 hours

Update AI analysis to use normalized table for better performance:

**Current approach (JSONB):**
```typescript
const rg = item.account_codes?.RG || item.ebitda_sek
```

**New approach (Normalized):**
```sql
SELECT 
    fa.orgnr,
    MAX(CASE WHEN fa.account_code = 'RG' THEN fa.amount_sek END) as ebit_sek,
    MAX(CASE WHEN fa.account_code = 'SDI' THEN fa.amount_sek END) as revenue_sek
FROM financial_accounts fa
WHERE fa.orgnr = $1 AND fa.year = $2
GROUP BY fa.orgnr
```

**Files to update:**
- `backend/agentic_pipeline/data_access.py` - Fetch financial data
- `frontend/server/ai-analysis-enhanced.ts` - Company profile generation
- `api/ai-analysis.ts` - Financial data access

---

## Verification

### Check Migration Success

```sql
-- Count total account rows
SELECT COUNT(*) FROM financial_accounts;
-- Expected: ~3.3M rows

-- Check account codes distribution
SELECT account_code, COUNT(*) as count
FROM financial_accounts
GROUP BY account_code
ORDER BY count DESC
LIMIT 20;

-- Verify data integrity
SELECT 
    cf.orgnr,
    cf.year,
    COUNT(DISTINCT fa.account_code) as account_count,
    COUNT(DISTINCT fa.id) as total_rows
FROM company_financials cf
LEFT JOIN financial_accounts fa ON fa.financial_id = cf.id
GROUP BY cf.orgnr, cf.year
HAVING COUNT(DISTINCT fa.account_code) < 10  -- Flag records with few accounts
LIMIT 10;
```

### Test Query Performance

```sql
-- Compare JSONB vs Normalized query performance
EXPLAIN ANALYZE
SELECT orgnr, (account_codes->>'RG')::numeric as ebit
FROM company_financials
WHERE year = 2024 AND account_codes ? 'RG';

EXPLAIN ANALYZE
SELECT orgnr, amount_sek as ebit
FROM financial_accounts
WHERE year = 2024 AND account_code = 'RG';
```

---

## Query Examples

See `database/financial_accounts_query_examples.sql` for PostgreSQL-focused examples and `database/financial_accounts_query_examples_sqlite.sql` for local testing.
- Basic queries
- AI analysis queries
- Calculated metrics
- Trend analysis
- Comparative analysis
- Using the pivot view

---

## Rollback Plan

If you need to rollback:

```sql
-- Drop the normalized table (data in JSONB is still safe)
DROP TABLE IF EXISTS public.financial_accounts CASCADE;
DROP VIEW IF EXISTS public.financial_accounts_pivot;
```

The original `account_codes` JSONB data remains untouched in `company_financials`.

---

## Next Steps

1. ✅ **Review** `FINANCIAL_ACCOUNTS_NORMALIZATION_ANALYSIS.md` for detailed analysis
2. ✅ **Create schema** - Run `financial_accounts_schema.sql`
3. ✅ **Migrate data** - Populate normalized table locally
4. ✅ **Import Nordstjernan** - Import JSON files into local DB
5. ✅ **Validate** - Run `validate_financial_accounts_local.py`
6. ✅ **Export** - Produce CSV for Supabase
7. ✅ **Load Supabase** - Use load scripts after dropping tables
8. ✅ **Update pipeline** - Modify scraper to populate normalized table
   - ✅ `scripts/migrate_staging_to_new_schema.py` already populates `financial_accounts` table (lines 441-451)
   - ✅ Scraper writes to staging DB → migration script transforms to normalized table
   - No changes needed - pipeline already supports normalized table
9. ✅ **Update AI code** - Use normalized table for better performance
   - Updated `frontend/server/ai-analysis-enhanced.ts` - Uses `financial_accounts` table with fallback
   - Updated `frontend/src/lib/supabaseDataService.ts` - Uses normalized table in two methods
10. ✅ **Monitor** - Check query performance improvements
   - Created `scripts/compare_query_performance.py` - Performance monitoring script
   - Compares JSONB vs normalized queries with timing and EXPLAIN plans
   - Run with: `python3 scripts/compare_query_performance.py --db-url $SUPABASE_DB_URL`

---

## Questions?

- **Storage concerns?** The 10x storage increase (330MB) is minimal compared to performance gains
- **Backward compatibility?** Keep `account_codes` JSONB populated for existing code
- **Performance?** Expect 10-100x faster queries for analytical operations
- **Complexity?** Normalized table is actually simpler to query than JSONB

---

## Files Created

1. `database/FINANCIAL_ACCOUNTS_NORMALIZATION_ANALYSIS.md` - Detailed analysis
2. `database/financial_accounts_schema_sqlite.sql` - Local schema (SQLite)
3. `database/financial_accounts_schema.sql` - Supabase schema (PostgreSQL)
4. `database/financial_accounts_query_examples_sqlite.sql` - Local query examples
5. `database/financial_accounts_query_examples.sql` - Supabase query examples
6. `scripts/migrate_staging_to_new_schema.py` - Generates local dataset + CSVs
7. `scripts/migrate_account_codes_to_normalized_local.py` - Local migration helper
8. `scripts/import_nordstjernan_to_financial_accounts_local.py` - Nordstjernan importer (SQLite)
9. `scripts/validate_financial_accounts_local.py` - Validation utility
10. `scripts/export_financial_accounts_to_csv.py` - CSV export for Supabase
11. `scripts/load_financial_accounts_to_supabase.sh` - Load normalized table into Supabase
12. `scripts/load_data_to_supabase.sh` - Bulk load workflow (includes financial_accounts)
13. `scripts/full_migration_local_to_supabase.sh` - Drop/recreate + load everything
14. `database/FINANCIAL_ACCOUNTS_IMPLEMENTATION_ROADMAP.md` - This file

