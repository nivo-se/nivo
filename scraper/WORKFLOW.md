# Scraper Workflow

## Overview

The scraper is designed to run **locally** and is used **once a year** to collect company financial data from Allabolag.se.

## Workflow

```
1. Local Scraper (once a year)
   ↓
2. Validation (local staging database)
   ↓
3. Upload to Supabase (production database)
```

## Architecture

### Local Scraper
- **Location**: `scraper/allabolag-scraper/`
- **Database**: SQLite (local staging database)
- **Purpose**: Scrape, validate, and prepare data
- **When**: Run locally once per year

### Staging Database
- **Type**: SQLite (`better-sqlite3`)
- **Location**: `scraper/allabolag-scraper/staging/`
- **Tables**:
  - `staging_jobs` - Job tracking
  - `staging_companies` - Company data
  - `staging_company_ids` - Company ID mappings
  - `staging_financials` - Financial records

### Production Database
- **Type**: Supabase (PostgreSQL)
- **Location**: Cloud (Supabase)
- **Purpose**: Final validated data for production use

## Typical Workflow

### 1. Run Scraper Locally
```bash
cd scraper/allabolag-scraper
npm run dev
```

- Start scraping job with filters
- Data is stored in local SQLite database
- Validate data quality and completeness

### 2. Validate Data
- Review validation dashboard
- Check for missing data
- Fix any issues
- Verify financial data accuracy

### 3. Upload to Supabase
- Export validated data from staging database
- Transform to production schema
- Upload to Supabase production database
- Verify upload success

## Key Points

- ✅ **Scraper runs locally** - No Vercel deployment needed
- ✅ **SQLite is fine** - Works perfectly for local staging
- ✅ **Rarely used** - Once per year, so local setup is sufficient
- ✅ **Validation before upload** - Ensures data quality
- ✅ **Supabase for production** - Final validated data storage

## Benefits of Local Scraper

1. **No Vercel limitations** - SQLite works perfectly locally
2. **Full control** - Can run for hours/days without timeout
3. **Cost effective** - No serverless function costs
4. **Data privacy** - Data stays local until validation
5. **Flexibility** - Can pause/resume as needed

## Next Steps After Scraping

1. **Validate** - Use validation dashboard to check data
2. **Review** - Check for missing or incorrect data
3. **Fix** - Correct any issues found
4. **Export** - Prepare data for Supabase upload
5. **Upload** - Migrate validated data to Supabase

