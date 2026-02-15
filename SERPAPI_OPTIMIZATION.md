# SerpAPI Optimization Guide

## ⚠️ Free Tier Limitation

SerpAPI's free tier allows **250 searches/month**. If you enrich 200 companies per batch, you'll use 200 API calls, almost maxing out your quota.

## ✅ Optimizations Implemented

### 1. **Skip Companies with Existing Homepages**

The enrichment worker now checks for existing websites in this priority order:

1. **`ai_profiles.website`** - Already enriched companies (saves API call)
2. **`companies.homepage`** - From your database (saves API call)
3. **SerpAPI lookup** - Only if no existing website found

**Result:** Companies that already have a homepage in your database won't trigger SerpAPI calls.

### 2. **In-Memory Caching**

The `SerpAPIScraper` now caches lookups within a single enrichment batch:

- If you look up "Acme Corp" twice in the same batch, only 1 API call is made
- Cache is per-instance (resets between batches)

**Result:** Duplicate company names in the same batch won't cause duplicate API calls.

### 3. **API Usage Tracking**

The enrichment worker now tracks and reports:

- **`serpapi_calls`** - Number of API calls made
- **`serpapi_saved`** - Number of calls saved by using existing homepages
- **`skipped_with_homepage`** - Companies that had existing homepages

**Result:** You can monitor your API usage and see how many calls you're saving.

### 4. **Quota Warnings**

The system warns you when approaching limits:

- **>200 calls:** Warning about approaching free tier limit
- **>100 calls:** Info message with remaining quota estimate

## 📊 Example Output

After enrichment, you'll see stats like:

```json
{
  "enriched": 150,
  "total": 200,
  "skipped": 50,
  "skipped_with_homepage": 120,
  "serpapi_calls": 30,
  "serpapi_saved": 120,
  "success_rate": 0.75
}
```

**Interpretation:**
- 200 companies total
- 50 already had profiles (skipped entirely)
- 120 had existing homepages (saved 120 SerpAPI calls!)
- Only 30 needed SerpAPI lookup
- **Total SerpAPI usage: 30 calls** (instead of 200!)

## 🎯 Best Practices

### 1. **Test with Small Batches First**

```bash
# Test with 5-10 companies
# Check SerpAPI usage in response
# Then scale up
```

### 2. **Use Existing Data**

- Companies already in your database with `homepage` field won't trigger SerpAPI
- Previously enriched companies (in `ai_profiles`) won't trigger SerpAPI
- Use `force_refresh: true` only when you need to re-enrich

### 3. **Monitor Usage**

Check enrichment job status to see API usage:

```bash
GET /api/enrichment/status/{job_id}
```

Response includes:
```json
{
  "serpapi_usage": {
    "calls_made": 30,
    "calls_saved": 120,
    "quota_info": "ℹ️  30 calls used. ~220 remaining this month (free tier)."
  }
}
```

### 4. **Batch Size Recommendations**

**Free Tier (250/month):**
- **Small batches:** 10-20 companies (safe for testing)
- **Medium batches:** 50-100 companies (if most have homepages)
- **Large batches:** 200+ companies (only if 80%+ have existing homepages)

**Paid Tier:**
- Can handle larger batches
- Still benefits from optimizations (saves money!)

## 🔄 How It Works

### Before Optimization:
```
200 companies → 200 SerpAPI calls → 200/250 quota used (80%)
```

### After Optimization:
```
200 companies
├─ 50 already enriched → Skip (0 calls)
├─ 120 have homepage → Use existing (0 calls)
└─ 30 need lookup → SerpAPI (30 calls)
Total: 30/250 quota used (12%) ✅
```

## 📈 Expected Savings

If your database has homepages for **60% of companies**:

- **Before:** 200 companies = 200 API calls
- **After:** 200 companies = 80 API calls
- **Savings:** 120 calls (60% reduction)

## 🚀 Next Steps

1. **Test with small batch** (5-10 companies)
2. **Check SerpAPI usage** in job status
3. **Scale up** based on your quota
4. **Upgrade SerpAPI** if needed (or use alternatives)

## 🔗 Alternatives

If you hit SerpAPI limits:

1. **Bing Web Search API** (Azure) - $4 per 1,000 queries
2. **Google Programmable Search Engine** - Free tier available
3. **Upgrade SerpAPI** - $50/month for 5,000 searches

See `PUPPETEER_DECISION_GUIDE.md` for more options.

