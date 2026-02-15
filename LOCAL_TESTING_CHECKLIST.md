# Local Testing Checklist

Complete guide for testing all features locally before migrating to Supabase.

## Prerequisites

- ✅ Local SQLite database (`data/nivo_optimized.db`) is populated
- ✅ Backend dependencies installed (`backend/requirements.txt`)
- ✅ Frontend dependencies installed (`frontend/package.json`)
- ✅ Environment variables configured (`.env` file)
- ✅ Redis running (for background jobs)

## Environment Setup Verification

```bash
# 1. Verify environment variables
python3 scripts/verify_env_setup.py

# 2. Check database exists and has data
sqlite3 data/nivo_optimized.db "SELECT COUNT(*) FROM companies;"
sqlite3 data/nivo_optimized.db "SELECT COUNT(*) FROM financials;"
sqlite3 data/nivo_optimized.db "SELECT COUNT(*) FROM company_kpis;"
```

## Feature Testing Checklist

### 1. Backend API Health ✅

**Test:**
```bash
curl http://localhost:8000/health
```

**Expected:** `{"status": "healthy", "service": "nivo-intelligence-api"}`

**Status:** [ ] Pass / [ ] Fail

---

### 2. AI Filter Endpoint ✅

**Test:**
```bash
curl -X POST http://localhost:8000/api/ai-filter \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Find companies with revenue over 100 million SEK",
    "limit": 10,
    "offset": 0
  }'
```

**Expected:**
- Returns `org_numbers` array
- Returns `total` count
- Returns `parsed_where_clause` (SQL WHERE clause)
- Returns `metadata` with `used_llm: true/false`

**Verify:**
- [ ] Results match the prompt criteria
- [ ] SQL WHERE clause is valid
- [ ] Total count is accurate
- [ ] Companies returned have revenue >= 100M SEK

**Status:** [ ] Pass / [ ] Fail

---

### 3. Company Batch Endpoint ✅

**Test:**
```bash
# First, get some org numbers from AI filter
ORGNUMS="5569771651,5561234567"  # Replace with actual org numbers

curl -X POST http://localhost:8000/api/companies/batch \
  -H "Content-Type: application/json" \
  -d "{\"orgnrs\": [$ORGNUMS]}"
```

**Expected:**
- Returns array of company objects
- Each company has: `orgnr`, `company_name`, `latest_revenue_sek`, `avg_ebitda_margin`, etc.
- AI profile data merged if available (`ai_strategic_score`, `ai_product_description`, etc.)

**Verify:**
- [ ] All requested companies returned
- [ ] Financial data is accurate (revenue in actual SEK, not thousands)
- [ ] Margins are percentages (0.15 = 15%)
- [ ] AI profile fields present if company was enriched

**Status:** [ ] Pass / [ ] Fail

---

### 4. Company Financials Endpoint ✅

**Test:**
```bash
curl http://localhost:8000/api/companies/5569771651/financials
```

**Expected:**
- Returns array of financial records (one per year)
- Each record has: `year`, `revenue_sek`, `ebit_sek`, `profit_sek`, `ebit_margin`, `net_margin`
- Revenue uses `COALESCE(si_sek, sdi_sek)` (prefers SI/Net Revenue)
- EBIT uses `resultat_e_avskrivningar_sek` (correct account code)

**Verify:**
- [ ] Historical data for multiple years
- [ ] Revenue values match Allabolag (check one company manually)
- [ ] EBIT values match Allabolag (check one company manually)
- [ ] Margins calculated correctly (EBIT/Revenue, Profit/Revenue)
- [ ] No NULL values for core metrics (Revenue, EBIT, Profit)

**Status:** [ ] Pass / [ ] Fail

---

### 5. Enrichment Pipeline (End-to-End) ✅

**Test:**
```bash
# Start enrichment job
curl -X POST http://localhost:8000/api/enrichment/start \
  -H "Content-Type: application/json" \
  -d '{
    "org_numbers": ["5569771651"],
    "force_refresh": false
  }'
```

**Expected:**
- Returns `job_id`
- Returns `status: "queued"` or `"skipped"` (if already enriched)
- Returns `count: 1`
- Returns `queued_org_numbers` array

**Check Job Status:**
```bash
# Replace JOB_ID with actual job ID from response
curl http://localhost:8000/api/enrichment/status/JOB_ID
```

**Verify Enrichment Steps:**
1. [ ] **Website Discovery:**
   - Checks `companies.homepage` first (persistent cache)
   - Falls back to `ai_profiles.website` if exists
   - Only uses SerpAPI if no existing website found
   - Saves discovered website to `companies.homepage`

2. [ ] **Multi-Page Scraping:**
   - Scrapes `/about`, `/products`, `/services`, `/clients` pages
   - Combines all page content
   - Falls back to SerpAPI basic scraping if Puppeteer unavailable

3. [ ] **AI Analysis (4 Steps):**
   - Step 1: Content Summarization (product, market, customers, value chain)
   - Step 2: Industry Classification (sector, subsector, regions)
   - Step 3: Strategic Fit Analysis (scores, risk flags, upside)
   - Step 4: Playbook Generation (strategic playbook, next steps)

4. [ ] **Data Storage:**
   - All fields saved to `ai_profiles` table (Supabase)
   - Website saved to `companies.homepage` (local SQLite)
   - `scraped_pages` array includes all URLs scraped
   - `agent_type` indicates which agent was used

**Verify AI Profile Fields:**
- [ ] `product_description` - Non-empty
- [ ] `industry_sector` - Classified
- [ ] `industry_subsector` - Classified
- [ ] `market_regions` - JSON array of regions
- [ ] `strategic_fit_score` - Integer 1-10
- [ ] `defensibility_score` - Integer 1-10
- [ ] `risk_flags` - JSON array (may be empty)
- [ ] `upside_potential` - Text description
- [ ] `strategic_playbook` - Markdown formatted
- [ ] `next_steps` - JSON array of actionable steps
- [ ] `agent_type` - "default" or other agent type
- [ ] `scraped_pages` - JSON array of URLs

**Status:** [ ] Pass / [ ] Fail

---

### 6. Frontend Dashboard ✅

**Test:**
1. Start frontend: `cd frontend && npm run dev`
2. Navigate to: `http://localhost:5173/dashboard`
3. Login (if auth required)

**Verify:**
- [ ] **AI Chat Filter Panel (Left):**
  - [ ] Prompt input field works
  - [ ] Submit button triggers API call
  - [ ] Loading indicator shows during request
  - [ ] Results display: total matches, current count
  - [ ] SQL WHERE clause displayed and copyable
  - [ ] Prompt history shows previous searches
  - [ ] Clicking history item re-runs search

- [ ] **Company Explorer Panel (Right):**
  - [ ] Companies table displays results
  - [ ] Columns: orgnr, name, revenue, EBITDA margin, growth, AI score
  - [ ] Checkboxes for selection work
  - [ ] Pagination controls work
  - [ ] "Enrich selection" button works
  - [ ] "Export to CRM" button works
  - [ ] "View AI Profile" button works
  - [ ] "Save List" button works

- [ ] **Session Persistence:**
  - [ ] Refresh page - AI results persist
  - [ ] Refresh page - Companies list persists
  - [ ] Refresh page - Prompt history persists
  - [ ] Refresh page - Pagination state persists

**Status:** [ ] Pass / [ ] Fail

---

### 7. Company Detail Page ✅

**Test:**
1. Click on a company in the Explorer table
2. Navigate to: `http://localhost:5173/companies/{orgnr}`

**Verify:**
- [ ] Company name and basic info displayed
- [ ] **Financials Table:**
  - [ ] Historical years displayed (2020-2024)
  - [ ] Revenue in tSEK (thousands) - matches Allabolag format
  - [ ] EBIT in tSEK - matches Allabolag
  - [ ] Net Profit in tSEK - matches Allabolag
  - [ ] Margins displayed as percentages (e.g., "10.6%")
  - [ ] Values match Allabolag (spot check 1-2 companies)

- [ ] **Growth Metrics:**
  - [ ] CAGR 3Y calculated correctly
  - [ ] YoY growth calculated correctly
  - [ ] Based on actual financial data (not estimates)

- [ ] **AI Insights (if enriched):**
  - [ ] Product description displayed
  - [ ] Industry sector/subsector displayed
  - [ ] Market regions shown as chips
  - [ ] Strategic fit score (1-10) displayed
  - [ ] Defensibility score (1-10) displayed
  - [ ] Risk flags shown as list
  - [ ] Upside potential displayed
  - [ ] Strategic playbook rendered (markdown)
  - [ ] Next steps shown as numbered list
  - [ ] Scraped pages listed with links

**Status:** [ ] Pass / [ ] Fail

---

### 8. AI Insights Component ✅

**Test:**
1. Navigate to page with AI Insights component
2. Enter an org number that has been enriched
3. Click "Load insights"

**Verify:**
- [ ] All new fields display correctly:
  - [ ] Industry sector/subsector
  - [ ] Market regions (as chips)
  - [ ] Risk flags (as list)
  - [ ] Upside potential
  - [ ] Strategic playbook (formatted markdown)
  - [ ] Next steps (numbered list)
  - [ ] Agent type indicator
  - [ ] Scraped pages metadata

**Status:** [ ] Pass / [ ] Fail

---

### 9. Prompt Configuration System ✅

**Test:**
1. Check that agent configs load:
```bash
python3 -c "
from backend.workers.prompt_config import PromptConfig
config = PromptConfig(agent_type='default')
print('Available agents:', config.available_agents())
print('Metadata:', config.metadata())
"
```

**Verify:**
- [ ] Default agent loads successfully
- [ ] Tech-focused agent loads (extends default)
- [ ] Manufacturing agent loads (extends default)
- [ ] Services agent loads (extends default)
- [ ] Prompt templates exist in `backend/config/prompts/`
- [ ] System prompts load from `backend/config/ai_agents.json`

**Status:** [ ] Pass / [ ] Fail

---

### 10. Investment Criteria Configuration ✅

**Test:**
```bash
python3 -c "
from backend.workers.strategic_fit_analyzer import StrategicFitAnalyzer
analyzer = StrategicFitAnalyzer()
result = analyzer.evaluate(
    company_name='Test Co',
    financial_metrics={'latest_revenue_sek': 100000000, 'avg_ebitda_margin': 0.15},
    summary={}
)
print('Score:', result.score)
print('Strategy:', result.matched_strategy)
"
```

**Verify:**
- [ ] Investment criteria loads from `backend/config/investment_criteria.json`
- [ ] Multiple strategies available (core_thesis, tech_rollup, etc.)
- [ ] Strategic fit analyzer evaluates correctly
- [ ] Risk flags generated based on criteria
- [ ] Scores normalized to 1-10 range

**Status:** [ ] Pass / [ ] Fail

---

### 11. Multi-Page Scraping ✅

**Test:**
```bash
python3 -c "
from backend.workers.scrapers.puppeteer_scraper import PuppeteerScraper
scraper = PuppeteerScraper()
pages = scraper.scrape_multiple_pages('https://example.com')
print('Pages scraped:', len(pages))
for url, content in pages.items():
    print(f'{url}: {len(content)} chars')
"
```

**Verify:**
- [ ] Scrapes multiple pages (about, products, services, clients)
- [ ] Handles 404s gracefully (skips missing pages)
- [ ] Combines content up to max_chars limit
- [ ] Returns structured dict: `{url: content}`
- [ ] Falls back to SerpAPI if Puppeteer unavailable

**Status:** [ ] Pass / [ ] Fail

---

### 12. SerpAPI Optimization ✅

**Test:**
1. Enrich a company that already has `homepage` in database
2. Check logs for "Using existing homepage" message
3. Verify SerpAPI call count doesn't increase

**Verify:**
- [ ] Companies with existing `homepage` skip SerpAPI lookup
- [ ] Discovered websites saved to `companies.homepage`
- [ ] In-memory cache prevents duplicate lookups in same batch
- [ ] API call count tracked correctly
- [ ] Warning logged if approaching free tier limit (250/month)

**Status:** [ ] Pass / [ ] Fail

---

## Data Accuracy Verification

### Financial Data Spot Checks

Pick 2-3 companies and verify against Allabolag.se:

1. **Company:** [Enter company name]
   - **Org Number:** [Enter orgnr]
   - **Allabolag Revenue (2024):** [Enter value from Allabolag]
   - **Our Database Revenue:** [Check via API]
   - **Match:** [ ] Yes / [ ] No

2. **Company:** [Enter company name]
   - **Org Number:** [Enter orgnr]
   - **Allabolag EBIT (2024):** [Enter value from Allabolag]
   - **Our Database EBIT:** [Check via API]
   - **Match:** [ ] Yes / [ ] No

---

## Performance Checks

- [ ] AI filter returns results in < 3 seconds
- [ ] Company batch endpoint returns in < 1 second (for 50 companies)
- [ ] Enrichment completes in < 2 minutes per company
- [ ] Frontend loads dashboard in < 2 seconds
- [ ] No memory leaks during long-running enrichment jobs

---

## Error Handling

Test error scenarios:

- [ ] AI filter with invalid prompt (should return fallback or error)
- [ ] Enrichment with non-existent org number (should handle gracefully)
- [ ] Company detail page with missing data (should show "N/A" not crash)
- [ ] Frontend with backend down (should show error message)
- [ ] Enrichment with missing API keys (should log warning, use fallback)

---

## Next Steps After Local Testing

Once all tests pass:

1. ✅ Document any issues found
2. ✅ Fix critical bugs
3. ✅ Run Supabase setup script: `database/supabase_setup_from_scratch.sql`
4. ✅ Create data migration script (SQLite → Supabase)
5. ✅ Test migration with small dataset
6. ✅ Update `DATABASE_SOURCE=supabase` in `.env`
7. ✅ Verify all features work with Supabase

---

## Notes

- Keep this checklist updated as you test
- Document any deviations or issues
- Take screenshots of UI for reference
- Save API responses for comparison

