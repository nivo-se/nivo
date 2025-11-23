# Quick Start: Local Testing Guide

**Goal:** Test all features locally before Supabase migration.

## Prerequisites Check

```bash
# 1. Verify database exists and has data
sqlite3 data/nivo_optimized.db "SELECT COUNT(*) FROM companies;"
# Should return: ~13,610

sqlite3 data/nivo_optimized.db "SELECT COUNT(*) FROM financials;"
# Should return: ~66,130

sqlite3 data/nivo_optimized.db "SELECT COUNT(*) FROM company_kpis;"
# Should return: ~13,610

# 2. Verify environment variables
python3 scripts/verify_env_setup.py
```

**Required:**
- ✅ Local SQLite database populated
- ✅ `OPENAI_API_KEY` set
- ✅ `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set (for ai_profiles storage)
- ✅ `REDIS_URL` set (for background jobs)
- ✅ `DATABASE_SOURCE=local` in `.env`

---

## Step 1: Start Backend

```bash
# Terminal 1: Start backend
cd backend
source venv/bin/activate
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

**Verify:** Open http://localhost:8000/docs - should see API documentation

---

## Step 2: Start Redis (for background jobs)

```bash
# Terminal 2: Start Redis
redis-server

# Verify Redis is running
redis-cli ping
# Should return: PONG
```

---

## Step 3: Start RQ Worker (for enrichment jobs)

```bash
# Terminal 3: Start RQ worker
cd backend
source venv/bin/activate
rq worker --url $REDIS_URL
```

**Verify:** Worker should show "Listening for jobs..."

---

## Step 4: Test AI Filter API

```bash
# Test 1: Basic revenue filter
curl -X POST http://localhost:8000/api/ai-filter \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Find companies with revenue over 100 million SEK",
    "limit": 10,
    "offset": 0
  }' | python3 -m json.tool

# Expected:
# - "org_numbers": array of org numbers
# - "total": number > 0
# - "parsed_where_clause": SQL WHERE clause
# - "metadata": { "used_llm": true/false }

# Test 2: Growth filter
curl -X POST http://localhost:8000/api/ai-filter \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Find growing companies with EBITDA margin above 10%",
    "limit": 20,
    "offset": 0
  }' | python3 -m json.tool
```

**Check:**
- [ ] Returns org_numbers array
- [ ] Total count is reasonable
- [ ] SQL WHERE clause is valid SQL
- [ ] Results match the prompt criteria

---

## Step 5: Test Company Batch Endpoint

```bash
# Get some org numbers from previous test
ORGNUMS="5569771651,5561234567"  # Replace with actual org numbers from Step 4

curl -X POST http://localhost:8000/api/companies/batch \
  -H "Content-Type: application/json" \
  -d "{\"orgnrs\": [$ORGNUMS]}" | python3 -m json.tool
```

**Check:**
- [ ] Returns array of company objects
- [ ] Each has: `orgnr`, `company_name`, `latest_revenue_sek`
- [ ] Revenue values are in actual SEK (e.g., 151929000, not 151929)
- [ ] Margins are decimals (0.15 = 15%)
- [ ] AI profile fields present if company was enriched

---

## Step 6: Test Company Financials Endpoint

```bash
# Pick a company from your database
curl http://localhost:8000/api/companies/5569771651/financials | python3 -m json.tool
```

**Check:**
- [ ] Returns array of financial records (one per year)
- [ ] Each record has: `year`, `revenue_sek`, `ebit_sek`, `profit_sek`
- [ ] Revenue matches Allabolag.se (spot check one company)
- [ ] EBIT matches Allabolag.se (spot check one company)
- [ ] Margins calculated: `ebit_margin`, `net_margin`

**Manual Verification:**
1. Pick a company from results
2. Go to https://www.allabolag.se/[orgnr]
3. Compare revenue and EBIT values for 2024
4. Should match (within rounding)

---

## Step 7: Test Enrichment Pipeline

```bash
# Start enrichment job
curl -X POST http://localhost:8000/api/enrichment/start \
  -H "Content-Type: application/json" \
  -d '{
    "org_numbers": ["5569771651"],
    "force_refresh": false
  }' | python3 -m json.tool

# Save the job_id from response, then check status:
curl http://localhost:8000/api/enrichment/status/JOB_ID | python3 -m json.tool
```

**Watch Terminal 3 (RQ Worker):**
- Should see: "Starting enrichment for 1 companies"
- Should see: Website discovery, scraping, AI analysis steps
- Should see: "Enrichment complete: 1/1 companies enriched"

**Check Supabase ai_profiles table:**
```sql
-- In Supabase SQL Editor
SELECT 
  org_number,
  website,
  product_description,
  industry_sector,
  strategic_fit_score,
  strategic_playbook,
  agent_type,
  scraped_pages
FROM ai_profiles
WHERE org_number = '5569771651';
```

**Verify:**
- [ ] `website` populated (from SerpAPI or existing homepage)
- [ ] `product_description` - Non-empty
- [ ] `industry_sector` - Classified
- [ ] `strategic_fit_score` - Integer 1-10
- [ ] `strategic_playbook` - Markdown formatted
- [ ] `next_steps` - JSON array
- [ ] `scraped_pages` - Array of URLs
- [ ] `agent_type` - "default" or other

---

## Step 8: Test Frontend Dashboard

```bash
# Terminal 4: Start frontend
cd frontend
npm run dev
```

**Navigate to:** http://localhost:5173/dashboard

### Test AI Chat Filter (Left Panel)

1. **Enter prompt:** "Find companies with revenue over 50 million SEK"
2. **Click Submit**
3. **Verify:**
   - [ ] Loading indicator shows
   - [ ] Results display: "X matches found"
   - [ ] SQL WHERE clause shown
   - [ ] Prompt added to history

### Test Company Explorer (Right Panel)

1. **Verify table displays:**
   - [ ] Companies listed with: orgnr, name, revenue, EBITDA margin, growth, AI score
   - [ ] Checkboxes work for selection
   - [ ] Pagination works

2. **Test "Enrich selection":**
   - [ ] Select 1-2 companies
   - [ ] Click "Enrich selection"
   - [ ] Should show "Enriching..." status
   - [ ] Check RQ worker terminal for job progress

3. **Test "View AI Profile":**
   - [ ] Select an enriched company
   - [ ] Click "View AI Profile"
   - [ ] Should open dialog/modal with AI insights

4. **Test "Save List":**
   - [ ] Select companies
   - [ ] Click "Save List"
   - [ ] Enter name and description
   - [ ] Verify saved (check Supabase `saved_company_lists` table)

### Test Session Persistence

1. **Perform a search**
2. **Refresh the page**
3. **Verify:**
   - [ ] AI results persist
   - [ ] Companies list persists
   - [ ] Prompt history persists
   - [ ] Pagination state persists

---

## Step 9: Test Company Detail Page

1. **Click on a company in the Explorer table**
2. **Navigate to:** `/companies/{orgnr}`

**Verify:**
- [ ] **Financials Table:**
  - [ ] Shows years 2020-2024 (or available years)
  - [ ] Revenue in tSEK format (matches Allabolag)
  - [ ] EBIT in tSEK format (matches Allabolag)
  - [ ] Margins as percentages (e.g., "10.6%")

- [ ] **Growth Metrics:**
  - [ ] CAGR 3Y calculated
  - [ ] YoY growth calculated

- [ ] **AI Insights (if enriched):**
  - [ ] Product description
  - [ ] Industry sector/subsector
  - [ ] Market regions (chips)
  - [ ] Strategic fit score
  - [ ] Risk flags (list)
  - [ ] Strategic playbook (markdown)
  - [ ] Next steps (numbered list)

---

## Step 10: Test Multi-Page Scraping

```bash
# Test Puppeteer scraper directly
python3 -c "
from backend.workers.scrapers.puppeteer_scraper import PuppeteerScraper
scraper = PuppeteerScraper()
pages = scraper.scrape_multiple_pages('https://example.com')
print(f'Pages scraped: {len(pages)}')
for url, content in list(pages.items())[:3]:
    print(f'{url}: {len(content)} chars')
"
```

**Verify:**
- [ ] Scrapes multiple pages (about, products, services, clients)
- [ ] Handles 404s gracefully
- [ ] Returns structured dict: `{url: content}`

**Note:** If Puppeteer not configured, should fall back to SerpAPI basic scraping.

---

## Step 11: Test Prompt Configuration

```bash
python3 -c "
from backend.workers.prompt_config import PromptConfig

# Test default agent
config = PromptConfig(agent_type='default')
print('Default agent metadata:', config.metadata())

# Test tech-focused agent
config_tech = PromptConfig(agent_type='tech_focused')
print('Tech agent metadata:', config_tech.metadata())

# Test system prompt
prompt = config.get_system_prompt('content_summarization')
print('System prompt length:', len(prompt))
"
```

**Verify:**
- [ ] Default agent loads
- [ ] Tech-focused agent loads (extends default)
- [ ] System prompts load from JSON config
- [ ] User templates load from text files

---

## Step 12: Test Investment Criteria

```bash
python3 -c "
from backend.workers.strategic_fit_analyzer import StrategicFitAnalyzer

analyzer = StrategicFitAnalyzer()
result = analyzer.evaluate(
    company_name='Test Company',
    financial_metrics={
        'latest_revenue_sek': 100000000,
        'avg_ebitda_margin': 0.15,
        'revenue_cagr_3y': 0.10
    },
    summary={'product_description': 'SaaS platform'}
)
print(f'Score: {result.score}/10')
print(f'Defensibility: {result.defensibility}/10')
print(f'Risk flags: {result.risk_flags}')
print(f'Strategy: {result.matched_strategy}')
"
```

**Verify:**
- [ ] Investment criteria loads from JSON
- [ ] Multiple strategies available
- [ ] Scores calculated correctly (1-10)
- [ ] Risk flags generated

---

## Step 13: Test SerpAPI Optimization

```bash
# Enrich a company that already has homepage
# First, check if company has homepage:
sqlite3 data/nivo_optimized.db "SELECT orgnr, homepage FROM companies WHERE homepage IS NOT NULL LIMIT 1;"

# Use that org number for enrichment
curl -X POST http://localhost:8000/api/enrichment/start \
  -H "Content-Type: application/json" \
  -d "{\"org_numbers\": [\"ORGNR_FROM_ABOVE\"], \"force_refresh\": false}"
```

**Check RQ worker logs:**
- [ ] Should see: "Using existing homepage from companies table (saved SerpAPI call)"
- [ ] SerpAPI call count should NOT increase
- [ ] Website should be used from database

---

## Step 14: Data Accuracy Spot Check

Pick 2-3 companies and verify against Allabolag.se:

### Company 1: [Enter name]
- **Org Number:** [Enter]
- **Allabolag Revenue (2024):** [Enter from allabolag.se]
- **Our Database Revenue:** [Check via API]
- **Match:** [ ] Yes / [ ] No

### Company 2: [Enter name]
- **Org Number:** [Enter]
- **Allabolag EBIT (2024):** [Enter from allabolag.se]
- **Our Database EBIT:** [Check via API]
- **Match:** [ ] Yes / [ ] No

---

## Common Issues & Fixes

### Issue: "Failed to connect to Redis"
**Fix:**
```bash
redis-server
# Or install: brew install redis (Mac) / sudo apt install redis (Linux)
```

### Issue: "SUPABASE_URL must be set"
**Fix:** Check `.env` file has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

### Issue: "No companies returned from AI filter"
**Fix:** Check database has companies matching criteria. Try broader search: "revenue over 10 million SEK"

### Issue: "Enrichment job stuck"
**Fix:** 
- Check RQ worker is running
- Check Redis is running
- Check OpenAI API key is valid
- Check Supabase credentials are valid

### Issue: "Puppeteer scraping fails"
**Fix:** 
- This is optional! System will fall back to SerpAPI basic scraping
- If you want Puppeteer: Set `PUPPETEER_SERVICE_URL` and `PUPPETEER_SERVICE_TOKEN` in `.env`

---

## Testing Checklist Summary

- [ ] Backend starts successfully
- [ ] Redis running
- [ ] RQ worker running
- [ ] AI filter API works
- [ ] Company batch API works
- [ ] Company financials API works
- [ ] Enrichment pipeline works end-to-end
- [ ] Frontend dashboard loads
- [ ] AI chat filter works
- [ ] Company explorer works
- [ ] Enrichment button works
- [ ] AI profile view works
- [ ] Company detail page works
- [ ] Financial data matches Allabolag
- [ ] Multi-page scraping works (or falls back gracefully)
- [ ] Prompt configuration loads
- [ ] Investment criteria loads
- [ ] SerpAPI optimization works (skips existing homepages)

---

## Next Steps After Testing

Once all tests pass:

1. ✅ Document any issues found
2. ✅ Fix critical bugs
3. ✅ Re-test fixed features
4. ✅ **Then** proceed with Supabase migration planning

**Only migrate to Supabase when local testing is 100% complete!**

