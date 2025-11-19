# Why Is The Database So Large?

## The Surprising Answer: **Indexes Take More Space Than Data!**

### Storage Breakdown (financial_accounts)
- **Table Data**: 375 MB (35%)
- **Indexes**: 701 MB (65%) ⚠️
- **Total**: 1,076 MB

## Why Indexes Are So Large

### 1. **UUIDs Are Expensive**
- UUID: 16 bytes per value
- Integer: 4 bytes per value
- **4x larger!**

**In financial_accounts:**
- `id` (UUID): 16 bytes
- `financial_id` (UUID): 16 bytes  
- **32 bytes per row just for IDs**
- With 3.3M rows: **105 MB just for UUIDs**

### 2. **Multiple Indexes Duplicate Data**

We have **6 indexes** on `financial_accounts`:
1. Primary Key on `id` (UUID)
2. Unique constraint on `(financial_id, account_code)` 
3. `(orgnr, year DESC)` - stores TEXT + INTEGER
4. `(account_code)` - stores TEXT
5. `(account_code, year DESC)` - stores TEXT + INTEGER
6. `(orgnr, account_code, year DESC)` - stores TEXT + TEXT + INTEGER
7. `(year DESC, period)` - stores INTEGER + TEXT
8. `(financial_id)` - stores UUID

**Each index stores a copy of the indexed columns!**

### 3. **TEXT Columns in Indexes**

Indexes on TEXT columns (`orgnr`, `account_code`, `period`) store the full text:
- `orgnr`: ~10-12 bytes per value
- `account_code`: ~3-10 bytes per value  
- `period`: ~7 bytes per value (e.g., "2024-12")

With 3.3M rows, this adds up quickly.

### 4. **Composite Indexes Multiply Storage**

Example: `idx_financial_accounts_orgnr_code_year`
- Stores: `orgnr` (TEXT) + `account_code` (TEXT) + `year` (INTEGER)
- Per row: ~25-30 bytes
- 3.3M rows × 30 bytes = **~99 MB** for this ONE index

## The Math

**Per Row Storage:**
- Row data: ~113 bytes
  - `id` (UUID): 16 bytes
  - `financial_id` (UUID): 16 bytes
  - `orgnr` (TEXT): ~12 bytes
  - `year` (INTEGER): 4 bytes
  - `period` (TEXT): ~7 bytes
  - `account_code` (TEXT): ~5 bytes
  - `amount_sek` (NUMERIC): ~8 bytes
  - `created_at` (TIMESTAMPTZ): 8 bytes
  - Row overhead: ~37 bytes

- Indexes: ~212 bytes per row (6 indexes × ~35 bytes avg)
  - Each index stores copies of columns
  - Composite indexes store multiple columns

**Total: 325 bytes per row**
- Data: 113 bytes (35%)
- Indexes: 212 bytes (65%)

With 3.3M rows: **1,072 MB** ✅ (matches our 1,076 MB!)

## Solutions to Reduce Index Size

### Option 1: Remove Redundant Indexes ⭐ RECOMMENDED
Some indexes may be redundant or rarely used:

```sql
-- Check which indexes are actually used
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as size
FROM pg_stat_user_indexes
WHERE tablename = 'financial_accounts'
ORDER BY idx_scan ASC;  -- Least used first
```

**Potential removals:**
- `idx_financial_accounts_year_period` - if rarely queried by period
- `idx_financial_accounts_code` - if `idx_financial_accounts_code_year` covers it
- `idx_financial_accounts_financial_id` - if foreign key index covers it

**Expected savings**: 100-200 MB

### Option 2: Use Integer IDs Instead of UUIDs
Replace UUIDs with BIGINT (8 bytes) or INTEGER (4 bytes):

```sql
-- Instead of UUID
id uuid PRIMARY KEY

-- Use BIGINT
id bigserial PRIMARY KEY  -- 8 bytes (vs 16)
```

**But**: Requires schema migration and breaks foreign keys.

**Expected savings**: ~50 MB

### Option 3: Partial Indexes
Only index frequently queried subsets:

```sql
-- Only index recent years
CREATE INDEX idx_financial_accounts_orgnr_year_recent
ON financial_accounts(orgnr, year DESC)
WHERE year >= 2020;
```

**Expected savings**: 30-50 MB

### Option 4: Reduce Index Columns
Remove columns from composite indexes if not needed:

```sql
-- Instead of (orgnr, account_code, year)
-- Use (orgnr, year) if account_code filter is rare
```

**Expected savings**: 20-40 MB per simplified index

## Recommended Approach

1. **Immediate**: Delete non-essential account codes (reduces rows → reduces index size)
2. **Next**: Analyze index usage and remove unused indexes
3. **Future**: Consider integer IDs for new tables

## Why This Happened

The normalized `financial_accounts` table was designed for **query performance**, not storage efficiency:
- ✅ Fast queries with multiple indexes
- ❌ Large storage footprint

This is a classic **performance vs. storage tradeoff**.

## Comparison: Normalized vs. JSONB

**Current (Normalized):**
- 3.3M rows × 325 bytes = 1,076 MB
- Fast queries ✅
- Large storage ❌

**Alternative (JSONB in company_financials):**
- ~66k rows × ~5 KB = ~330 MB
- Slower queries ❌
- Smaller storage ✅

**Tradeoff**: We chose performance over storage, which is fine for production, but problematic for free tier limits.

