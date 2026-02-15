# Enrichment Pipeline Status

## Current State: ⚠️ **Partially Ready**

The enrichment pipeline **will run** but **requires Supabase** to save results. Without Supabase, enrichment will:
- ✅ Scrape websites (SerpAPI + Puppeteer)
- ✅ Run AI analysis (OpenAI)
- ✅ Save discovered websites to local SQLite (`companies.homepage`)
- ❌ **FAIL when trying to save ai_profiles** (requires Supabase)

## What Works Without Supabase

### ✅ **Website Discovery & Caching**
- SerpAPI finds company websites
- Websites are saved to `companies.homepage` in local SQLite
- This persists across sessions (no Supabase needed)

### ✅ **AI Analysis**
- OpenAI analyzes scraped content
- Generates: product descriptions, industry classification, strategic fit scores, playbooks
- All analysis happens locally (no Supabase needed)

### ❌ **Profile Storage**
- `ai_profiles` table is in Supabase only
- Without Supabase, enrichment results are **lost** after the job completes
- The worker will raise an exception when trying to save

## Current Code Behavior

### Enrichment Worker (`backend/workers/enrichment_worker.py`)

**Line 216:**
```python
supabase.table("ai_profiles").upsert(profile, on_conflict="org_number").execute()
```

**Problem:** No try/except around this - will raise exception if Supabase fails.

**What happens:**
1. Worker scrapes website ✅
2. Worker runs AI analysis ✅
3. Worker saves website to `companies.homepage` ✅
4. Worker tries to save to Supabase ❌ **FAILS if Supabase not configured**
5. Job fails, results lost

## Solutions

### Option 1: **Add Fallback Storage (Recommended for Testing)**

Save to local SQLite as fallback:

```python
# In enrichment_worker.py, around line 216
try:
    supabase.table("ai_profiles").upsert(profile, on_conflict="org_number").execute()
    logger.info("Saved ai_profile to Supabase for %s", orgnr)
except Exception as supabase_exc:
    logger.warning("Failed to save to Supabase, saving to local DB: %s", supabase_exc)
    # Fallback: Save to local SQLite
    # Create ai_profiles table in local DB if it doesn't exist
    # Save profile there
```

**Pros:**
- Works without Supabase
- Results persist locally
- Can migrate to Supabase later

**Cons:**
- Need to create `ai_profiles` table in local SQLite
- AI filter post-filtering won't work (it queries Supabase)

### Option 2: **Make Supabase Optional (Graceful Degradation)**

Wrap Supabase calls in try/except and continue:

```python
try:
    supabase.table("ai_profiles").upsert(profile, on_conflict="org_number").execute()
except Exception as exc:
    logger.warning("Supabase not available, skipping ai_profiles save: %s", exc)
    # Continue - at least website is saved to companies.homepage
```

**Pros:**
- Enrichment completes successfully
- Website is saved (can re-run enrichment later)

**Cons:**
- Results are lost (no ai_profiles saved)
- Can't use ai_profiles for filtering

### Option 3: **Set Up Supabase (Recommended for Production)**

Follow the setup guide to configure Supabase:

1. **Create Supabase Project:**
   - Go to https://supabase.com
   - Create new project
   - Get URL and service role key

2. **Run Migration:**
   ```bash
   # Connect to Supabase SQL editor
   # Run: database/supabase_setup_from_scratch.sql
   ```

3. **Set Environment Variables:**
   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

4. **Test:**
   ```bash
   python3 scripts/verify_env_setup.py
   ```

## Recommended Approach

### For Local Testing (Now):
**Implement Option 1** - Add fallback to local SQLite so you can test enrichment without Supabase.

### For Production (Later):
**Use Option 3** - Set up Supabase properly for persistent storage and filtering.

## What Gets Saved Where

### Local SQLite (`data/nivo_optimized.db`)
- ✅ `companies.homepage` - Discovered websites (persistent)
- ⏳ `ai_profiles` - **Not currently saved** (would need fallback implementation)

### Supabase (when configured)
- ✅ `ai_profiles` - Full enrichment results
- ✅ `ai_queries` - AI filter query history

## Testing Without Supabase

If you want to test enrichment without Supabase:

1. **Current behavior:** Job will fail when trying to save ai_profiles
2. **What you'll see:**
   - Website discovery works ✅
   - AI analysis works ✅
   - Website saved to `companies.homepage` ✅
   - Job fails with Supabase error ❌

3. **Workaround:** Implement Option 1 (fallback to local SQLite)

## Next Steps

1. **Decide on approach:**
   - Option 1: Add local SQLite fallback (quick fix for testing)
   - Option 3: Set up Supabase (proper solution)

2. **If choosing Option 1:**
   - I can implement the fallback storage
   - Create `ai_profiles` table in local SQLite
   - Save results there when Supabase unavailable

3. **If choosing Option 3:**
   - Follow Supabase setup guide
   - Run migration script
   - Test enrichment

## Summary

| Component | Status | Requires Supabase? |
|-----------|--------|-------------------|
| Website Discovery | ✅ Ready | No |
| Website Caching | ✅ Ready | No (saves to local DB) |
| AI Analysis | ✅ Ready | No |
| Profile Storage | ❌ Not Ready | **Yes** (currently) |
| AI Filter (with profiles) | ❌ Not Ready | **Yes** (queries Supabase) |

**Bottom Line:** Enrichment pipeline will run but results won't be saved without Supabase. Need to either:
- Add local SQLite fallback, OR
- Set up Supabase

