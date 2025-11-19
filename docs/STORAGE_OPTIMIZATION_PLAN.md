# Storage Optimization Plan

## Current Situation
- **Total Supabase Storage**: ~1.46 GB
- **financial_accounts**: 1,076 MB (74% of total) - 3.3M rows
- **company_financials**: 352 MB (24%) - 66k rows
- **companies**: 7 MB - 13.6k rows
- **company_metrics**: 4 MB - 13.6k rows

## Problem
The normalized `financial_accounts` table stores every account code as a separate row, resulting in 3.3M rows. While this enables flexible queries, it's storage-intensive.

## Optimization Strategies

### Option 1: Keep Only Essential Account Codes ⭐ RECOMMENDED
**Impact**: Reduce `financial_accounts` by ~70-80% (to ~200-300 MB)

**Action**: Filter to only store the most commonly used account codes:
- `SDI` - Revenue
- `RG` - EBIT  
- `DR` - Profit
- `EBITDA` - EBITDA
- `EK` - Equity
- `FK` - Debt
- `SV` - Total Assets
- `ANT` - Employees
- `EKA` - Equity Ratio

**Implementation**:
```sql
-- Delete non-essential account codes
DELETE FROM financial_accounts 
WHERE account_code NOT IN (
    'SDI', 'RG', 'DR', 'EBITDA', 'EK', 'FK', 'SV', 'ANT', 'EKA'
);
```

**Pros**:
- Immediate 70-80% storage reduction
- Keeps all essential metrics for UI and analysis
- No schema changes needed

**Cons**:
- Loses access to less common account codes
- May need to re-import if requirements change

---

### Option 2: Archive Old Financial Data
**Impact**: Reduce storage by 30-50% depending on retention period

**Action**: Keep only last 3-5 years of financial data

**Implementation**:
```sql
-- Keep only last 5 years
DELETE FROM financial_accounts 
WHERE year < EXTRACT(YEAR FROM CURRENT_DATE) - 5;

DELETE FROM company_financials 
WHERE year < EXTRACT(YEAR FROM CURRENT_DATE) - 5;
```

**Pros**:
- Reduces storage while keeping recent data
- Historical data can be archived to local DB or cold storage

**Cons**:
- Loses historical trend analysis capability
- May need historical data for CAGR calculations

---

### Option 3: Hybrid Approach - Essential in Supabase, Full Data Local
**Impact**: Reduce Supabase to ~400-500 MB, keep full data locally

**Action**:
- Keep only essential account codes in Supabase `financial_accounts`
- Keep full `account_codes` JSONB in `company_financials` for detailed analysis
- Use local SQLite for deep historical analysis

**Pros**:
- Best of both worlds
- Supabase stays lean for production queries
- Full data available locally for analysis

**Cons**:
- More complex data management
- Need to sync essential codes to Supabase

---

### Option 4: Optimize Data Types and Indexes
**Impact**: Reduce storage by 10-20%

**Actions**:
1. Change `amount_sek` from `NUMERIC` to `BIGINT` (store in thousands as integers)
2. Remove redundant indexes
3. Use `SMALLINT` for `year` instead of `INTEGER`
4. Compress `period` text (use codes like '2024-12' → '2412')

**Pros**:
- No data loss
- Improves query performance

**Cons**:
- Requires schema migration
- Limited impact compared to Option 1

---

### Option 5: Table Partitioning by Year
**Impact**: Enables easy archiving, but doesn't reduce current storage

**Action**: Partition `financial_accounts` by year, archive old partitions

**Pros**:
- Easy to archive old data
- Better query performance for recent data

**Cons**:
- Complex to implement
- Doesn't reduce current storage immediately

---

## Recommended Approach: **Option 1 + Option 2 Combined**

1. **Immediate**: Delete non-essential account codes (Option 1)
   - Expected reduction: ~800 MB → ~200-300 MB
   - New total: ~600-700 MB

2. **Next**: Archive data older than 5 years (Option 2)
   - Additional reduction: ~100-150 MB
   - Final total: ~500-600 MB

3. **Future**: Consider Option 3 if storage grows again

## Implementation Steps

### Step 1: Identify Essential Account Codes
```sql
-- See which account codes are most used
SELECT account_code, COUNT(*) as usage_count
FROM financial_accounts
GROUP BY account_code
ORDER BY usage_count DESC;
```

### Step 2: Backup Before Deletion
```sql
-- Export to CSV before deleting
\copy (SELECT * FROM financial_accounts WHERE account_code NOT IN ('SDI','RG','DR','EBITDA','EK','FK','SV','ANT','EKA')) TO '/tmp/non_essential_accounts.csv' CSV HEADER;
```

### Step 3: Delete Non-Essential Codes
```sql
DELETE FROM financial_accounts 
WHERE account_code NOT IN (
    'SDI', 'RG', 'DR', 'EBITDA', 'EK', 'FK', 'SV', 'ANT', 'EKA'
);
```

### Step 4: Vacuum to Reclaim Space
```sql
VACUUM FULL financial_accounts;
```

### Step 5: Verify Storage Reduction
```sql
SELECT pg_size_pretty(pg_total_relation_size('financial_accounts'));
```

## Expected Results

**Before**:
- financial_accounts: 1,076 MB
- Total: ~1,460 MB

**After Option 1**:
- financial_accounts: ~200-300 MB (estimated)
- Total: ~600-700 MB

**After Option 1 + 2**:
- financial_accounts: ~150-250 MB
- Total: ~500-600 MB

**Storage Savings**: ~900 MB (62% reduction)

## Risk Assessment

**Low Risk**: Option 1 (keeping essential codes)
- All UI metrics use essential codes
- Can re-import if needed

**Medium Risk**: Option 2 (archiving old data)
- May break historical trend analysis
- Need to ensure CAGR calculations work with 5 years

**Recommendation**: Start with Option 1, monitor storage, then consider Option 2 if needed.

