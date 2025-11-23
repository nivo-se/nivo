# Persistent Website Caching

## 🎯 Goal

**Never search for the same company website twice.** Once we find a website via SerpAPI, it's saved to the database permanently.

## ✅ Implementation

### 1. **Check Database First**

Before making any SerpAPI call, the system checks:

1. **`ai_profiles.website`** - Already enriched companies
2. **`companies.homepage`** - Persistent cache (saved from previous lookups)
3. **SerpAPI lookup** - Only if no website exists

### 2. **Save Discovered Websites**

When SerpAPI finds a website:

```python
# Immediately save to companies table
db.run_raw_query(
    "UPDATE companies SET homepage = ? WHERE orgnr = ?",
    [website, orgnr]
)
```

**Result:** Next time you enrich this company, it will use the cached homepage (zero SerpAPI calls).

### 3. **Database Commit**

The `LocalDBService` now commits all updates:

```python
def _execute(self, sql: str, params: Optional[Sequence[Any]] = None):
    cursor = self._conn.execute(sql, params or [])
    self._conn.commit()  # ✅ Persist updates
    return rows
```

## 📊 How It Works

### First Enrichment (Company has no homepage):
```
Company "Acme Corp"
├─ Check ai_profiles.website → None
├─ Check companies.homepage → None
├─ SerpAPI lookup → "https://acme.com"
├─ 💾 SAVE to companies.homepage
└─ ✅ Done (1 SerpAPI call)
```

### Second Enrichment (Same company):
```
Company "Acme Corp"
├─ Check ai_profiles.website → None (or exists)
├─ Check companies.homepage → "https://acme.com" ✅
└─ ✅ Done (0 SerpAPI calls - saved!)
```

### Batch Enrichment (200 companies):
```
200 companies
├─ 50 already have homepage in DB → 0 calls
├─ 100 need lookup → 100 calls
├─ 💾 Save all 100 to DB
└─ Next batch: 0 calls for those 100! ✅
```

## 🎯 Benefits

### 1. **Progressive Savings**

- **First batch:** 200 companies = 200 SerpAPI calls
- **Second batch (same companies):** 200 companies = 0 SerpAPI calls
- **Mixed batch:** 200 companies = ~50-100 calls (only new companies)

### 2. **Persistent Cache**

- Websites saved to `companies.homepage` column
- Survives restarts, deployments, database migrations
- Works across all enrichment jobs

### 3. **Zero Duplicate Searches**

- Same company name = same result (cached)
- Different batches = no duplicate lookups
- Database is the source of truth

## 📈 Expected Impact

### Scenario: Enriching 1000 companies over time

**Without caching:**
- Batch 1 (200): 200 calls
- Batch 2 (200): 200 calls
- Batch 3 (200): 200 calls
- Batch 4 (200): 200 calls
- Batch 5 (200): 200 calls
- **Total: 1000 SerpAPI calls** ❌

**With persistent caching:**
- Batch 1 (200): 200 calls → Save 200 to DB
- Batch 2 (200): 0 calls (all cached)
- Batch 3 (200): 0 calls (all cached)
- Batch 4 (200): 0 calls (all cached)
- Batch 5 (200): 0 calls (all cached)
- **Total: 200 SerpAPI calls** ✅ (80% savings!)

## 🔍 Verification

Check if websites are being saved:

```sql
-- See companies with homepages
SELECT orgnr, company_name, homepage 
FROM companies 
WHERE homepage IS NOT NULL 
LIMIT 10;

-- Count companies with homepages
SELECT COUNT(*) 
FROM companies 
WHERE homepage IS NOT NULL AND homepage != '';
```

## 🚀 Usage

The caching is **automatic** - no configuration needed:

1. Enrich companies normally
2. System checks database first
3. If missing, uses SerpAPI
4. Saves result to database
5. Next time: uses cached value

## ⚠️ Force Refresh

If you need to re-lookup a website (e.g., company changed domain):

```python
# Use force_refresh flag
POST /api/enrichment/start
{
  "org_numbers": ["1234567890"],
  "force_refresh": true  // Will re-lookup even if cached
}
```

## 📝 Logs

Watch for these log messages:

```
💾 Saved discovered website to companies table: Acme Corp -> https://acme.com
Using existing homepage from companies table for Acme Corp (saved SerpAPI call)
Found existing homepage in companies table for 1234567890
```

## ✅ Summary

- ✅ **Persistent cache** in `companies.homepage`
- ✅ **Zero duplicate searches** for same company
- ✅ **Automatic** - no configuration needed
- ✅ **Progressive savings** - each batch improves cache hit rate
- ✅ **Survives restarts** - database is persistent

**Result:** Your SerpAPI quota will last much longer! 🎉

