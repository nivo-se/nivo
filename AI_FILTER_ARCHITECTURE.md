# AI Filter Architecture & Public Information Integration

## Overview

The AI Filter uses **full LLM analysis** (OpenAI) to translate natural language investor theses into SQL queries, with optional post-filtering using public information from enriched company profiles.

## Architecture

### 1. **LLM-Based Prompt Analysis** (Primary)

**Location:** `backend/api/ai_filter.py` → `_call_openai_for_where_clause()`

**How it works:**
- Uses OpenAI GPT-4o-mini to analyze the investor thesis
- **No rule-based parsing** - the LLM understands context and generates appropriate SQL
- Comprehensive system prompt that explains:
  - Database schema (companies, company_kpis, financials)
  - Available columns and their meanings
  - Revenue conversion guidelines
  - Interpretation guidelines (e.g., "around 100M" = 80M-120M range)
  - Examples of good SQL generation

**Example:**
```
User Prompt: "Find companies with around 100M turnover and healthy margins yet with improvement potential"

LLM Analysis:
- "around 100M" → f.latest_revenue_sek >= 80000000 AND f.latest_revenue_sek <= 120000000
- "healthy margins" → (k.avg_ebitda_margin >= 0.10 OR k.avg_net_margin >= 0.05)
- "improvement potential" → k.avg_ebitda_margin < 0.20 AND k.avg_ebitda_margin > 0

Generated SQL WHERE clause:
f.latest_revenue_sek >= 80000000 AND f.latest_revenue_sek <= 120000000 
AND (k.avg_ebitda_margin >= 0.10 OR k.avg_net_margin >= 0.05) 
AND k.avg_ebitda_margin < 0.20 AND k.avg_ebitda_margin > 0
```

**Benefits:**
- Understands natural language nuances
- Handles complex multi-criteria queries
- Adapts to different phrasings
- Can interpret vague criteria intelligently

### 2. **Public Information Integration** (Post-Filter)

**Location:** `backend/api/ai_filter.py` → `_filter_by_ai_profiles()`

**How it works:**
- After SQL query returns financial/KPI matches, check if prompt mentions:
  - Product offerings
  - Strategic fit
  - Business model
  - Industry/sector details
- If yes, fetch `ai_profiles` from Supabase for those companies
- Filter companies based on enriched profile data

**Current Implementation:**
- Basic filtering: If prompt mentions "product" or "strategy", filter to companies that have been enriched
- **Future Enhancement:** Use LLM to score each company's profile against the prompt for semantic matching

**Example Flow:**
```
1. User Prompt: "Companies that fit Nivo's acquisition strategy with product offerings"
2. LLM generates SQL for financial criteria (if any)
3. SQL query returns companies matching financials
4. Post-filter: Check ai_profiles for product_description, strategic_fit_score
5. Return only companies with enriched profiles that match
```

## Public Information Enrichment Pipeline

### Current Status: ✅ **Fully Implemented**

The enrichment pipeline **does exist** and scrapes public information:

1. **Website Discovery** (`backend/workers/scrapers/serpapi_scraper.py`)
   - Uses SerpAPI to find company websites
   - Caches results in `companies.homepage` to avoid duplicate searches

2. **Multi-Page Scraping** (`backend/workers/scrapers/puppeteer_scraper.py`)
   - Scrapes multiple pages: `/about`, `/products`, `/services`, etc.
   - Uses Browserless.io or self-hosted Puppeteer service
   - Combines content from all pages

3. **AI Analysis** (`backend/workers/ai_analyzer.py`)
   - Multi-step analysis:
     - Content summarization (product, customers, business model)
     - Industry classification (sector, subsector, regions)
     - Strategic fit analysis (vs. investment criteria)
     - Playbook generation (actionable next steps)
   - Uses configurable AI agents (default, tech_focused, manufacturing, services)

4. **Storage** (`backend/workers/enrichment_worker.py`)
   - Stores results in Supabase `ai_profiles` table
   - Includes: product_description, industry_sector, strategic_fit_score, business_model_summary, etc.

### How to Use Enrichment

**Step 1: Enrich Companies**
- Select companies in the dashboard
- Click "Enrich selection"
- Background worker scrapes websites and analyzes them
- Results stored in `ai_profiles` table

**Step 2: Filter Using Enriched Data**
- When you search for "companies with product offerings that fit Nivo's strategy"
- The AI filter will:
  1. Generate SQL for financial criteria
  2. Post-filter using `ai_profiles` data
  3. Return only companies that match both financials AND product/strategy criteria

## Integration Points

### Financial Data (Local SQLite)
- **Source:** `data/nivo_optimized.db`
- **Tables:** `companies`, `company_kpis`, `financials`
- **Used for:** Revenue, margins, growth, size, profitability filtering
- **Query:** Direct SQL JOIN in `BASE_SQL`

### Public Information (Supabase)
- **Source:** Supabase `ai_profiles` table
- **Data:** Product descriptions, industry classification, strategic fit scores, business models
- **Used for:** Product/strategy matching, industry filtering
- **Query:** Post-filter after SQL query (Python-based)

## Future Enhancements

### 1. **Semantic Profile Matching**
Instead of simple keyword matching, use LLM to score each company's profile:
```python
# For each company with ai_profiles:
# 1. Combine: prompt + company profile data
# 2. Ask LLM: "Does this company match the thesis? Score 1-10"
# 3. Filter to companies with score >= 7
```

### 2. **Real-Time Enrichment**
- If prompt mentions product/strategy but companies aren't enriched yet
- Trigger enrichment on-the-fly for top candidates
- Return results after enrichment completes

### 3. **Hybrid Filtering**
- Generate SQL that includes both financial AND profile criteria
- Requires syncing ai_profiles to local DB or using Supabase as primary source

## Current Limitations

1. **ai_profiles in Supabase only**
   - Can't JOIN directly in SQL (different databases)
   - Post-filtering happens in Python after SQL query
   - Only filters companies that have been enriched

2. **Enrichment is Manual**
   - Must click "Enrich selection" first
   - Not automatic during filtering
   - Takes time (scraping + AI analysis)

3. **Basic Profile Filtering**
   - Currently just checks if profile exists
   - Doesn't do semantic matching yet
   - Future: LLM-based profile scoring

## How to Improve Results

### For Better Financial Filtering:
- ✅ Already using full LLM analysis
- ✅ Improved system prompt with comprehensive guidelines
- ✅ Handles "around", "healthy margins", "improvement potential"

### For Better Product/Strategy Filtering:
1. **Enrich companies first:**
   - Select companies from initial search
   - Click "Enrich selection"
   - Wait for enrichment to complete

2. **Then search with product criteria:**
   - "Companies with product offerings that fit Nivo's strategy"
   - System will filter to enriched companies

3. **Future:** Automatic enrichment for top candidates

## API Flow

```
User Prompt
    ↓
OpenAI LLM Analysis
    ↓
SQL WHERE Clause Generated
    ↓
SQL Query on Local DB (financials + KPIs)
    ↓
Company Org Numbers Returned
    ↓
[If prompt mentions product/strategy]
    ↓
Fetch ai_profiles from Supabase
    ↓
Post-filter by profile data
    ↓
Final Company List
```

## Configuration

**OpenAI Model:**
- Default: `gpt-4o-mini` (cost-effective)
- Configurable via `OPENAI_MODEL` env var
- Can upgrade to `gpt-4o` for better analysis

**Enrichment:**
- SerpAPI: Website discovery (optional, cached)
- Puppeteer: Deep scraping (optional, Browserless.io or self-hosted)
- AI Analysis: Multi-step analysis with configurable agents

## Summary

✅ **LLM Analysis:** Full OpenAI-based prompt understanding (not rule-based)
✅ **Public Information:** Enrichment pipeline exists and works
✅ **Integration:** Post-filtering using ai_profiles when prompt requires it
⏳ **Future:** Semantic profile matching, automatic enrichment, hybrid filtering

The system is designed to be **intelligent and flexible**, using LLM analysis for financial criteria and post-filtering for public information when needed.

