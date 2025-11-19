# Why Do We Have 3.3 Million Rows?

## The Answer: **Normalization Multiplies Rows**

### The Math
- **company_financials**: 66,614 rows (one per company/year/period)
- **financial_accounts**: 3,314,236 rows
- **Ratio**: ~50 account codes per financial record

### How It Works

Each financial statement (one row in `company_financials`) contains **~50 different account codes** stored as a JSONB object:

```json
{
  "SDI": 72000000,
  "RG": 2969900,
  "DR": 1348000000,
  "EK": 50000000,
  "FK": 20000000,
  "SV": 70000000,
  "ANT": 150,
  "ADR": 1000000,
  "FI": 500000,
  ... (40+ more codes)
}
```

### Normalization = One Row Per Account Code

Instead of storing this as JSONB, we **normalized** it into separate rows:

**Before (JSONB in company_financials):**
```
1 row = 1 financial statement with all account codes in JSONB
66,614 rows total
```

**After (Normalized financial_accounts):**
```
1 row = 1 account code for 1 financial statement
66,614 financial statements × 50 account codes = 3,314,236 rows
```

### Why Normalize?

**Benefits:**
- ✅ Fast SQL queries: `WHERE account_code = 'RG'` is instant
- ✅ Easy aggregations: `GROUP BY account_code`
- ✅ Efficient filtering: Index on `account_code` works perfectly
- ✅ AI analysis: Can query specific codes across all companies

**Cost:**
- ❌ **50x more rows** (66k → 3.3M)
- ❌ **50x more storage** (due to normalization + indexes)

### The Account Codes

We're storing **53 unique account codes** per financial statement:

**Essential (9 codes - what we're keeping):**
- `SDI` - Revenue
- `RG` - EBIT
- `DR` - Profit
- `EBITDA` - EBITDA
- `EK` - Equity
- `FK` - Debt
- `SV` - Total Assets
- `ANT` - Employees
- `EKA` - Equity Ratio

**Non-Essential (44 codes - being deleted):**
- `ADR`, `ADK`, `FI`, `FSD`, `IAC`, `KB`, `ORS`, `SI`, `SIK`, `SKO`, `SUB`, `SAP`, `SIA`, `SVD`, `UTR`
- `resultat_e_avskrivningar`
- `summa_rorelsekostnader`
- `summa_langfristiga_skulder`
- ... and 25+ more

### Storage Impact

**Current:**
- 3.3M rows × ~325 bytes = 1,076 MB

**After keeping only 9 essential codes:**
- 66,614 financial records × 9 codes = ~600k rows
- 600k rows × ~325 bytes = ~195 MB
- **Reduction: ~880 MB (82%)**

### Is This Normal?

**Yes!** This is a classic database normalization pattern:

**Example:**
- **Orders table**: 1,000 orders
- **Order items table**: 1,000 orders × 5 items = 5,000 rows

Same pattern:
- **Financial statements**: 66,614 statements  
- **Account codes**: 66,614 × 50 codes = 3.3M rows

### Alternative Approaches

**Option 1: Keep JSONB (current company_financials)**
- ✅ Smaller storage (~330 MB)
- ❌ Slower queries
- ❌ Harder to aggregate

**Option 2: Normalized (current financial_accounts)**
- ✅ Fast queries
- ✅ Easy aggregations
- ❌ Large storage (1,076 MB)

**Option 3: Hybrid (recommended)**
- Keep essential codes normalized (9 codes)
- Keep full JSONB in company_financials for reference
- ✅ Fast queries for common codes
- ✅ Smaller storage (~500 MB)
- ✅ Full data available if needed

### Summary

**Why 3.3M rows?**
- Because we normalized 66k financial statements × 50 account codes each
- This is **expected** for a normalized design
- The issue isn't the number of rows - it's that we're storing **too many account codes** we don't use

**Solution:**
- Keep only 9 essential account codes
- Reduces to ~600k rows
- Saves ~880 MB (82% reduction)

