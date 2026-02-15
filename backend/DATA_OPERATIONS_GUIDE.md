# Data Operations Guide

## Fetching New Data from Allabolag.se

### 1. Fetch Company Data
```bash
python3 fetch_allabolag.py
```

### 2. Fetch Financial Data
```bash
python3 fetch_financials_by_companyid.py
```

### 3. Enrich Data
```bash
python3 enrich_financials.py
```

### 4. Calculate KPIs
```bash
python3 calc_kpis.py
```

## Data Migration to Supabase

### 1. Setup Supabase Connection
```bash
python3 setup_supabase.py
```

### 2. Migrate Data
```bash
python3 migrate_to_supabase_optimized.py
```

## Data Analysis and Reporting

### 1. Generate Company Report
```bash
python3 company_data_report.py
```

### 2. Analyze Top Companies
```bash
python3 analyze_top_companies.py
```

### 3. Export to Excel
```bash
python3 export_to_excel.py
```

### 4. Run Agentic Targeting Pipeline with Optional AI Analysis
```bash
python3 run_agentic_targeting_pipeline.py --db-path allabolag.db --top 30 --ai-analysis --ai-limit 10
```

- Add `--ai-no-supabase` to skip writing AI insights back to Supabase.
- Use `--ai-table your_table` to override the default `ai_company_analysis` table name.
- Provide `OPENAI_API_KEY` and Supabase credentials (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) as environment variables before running.

### 5. Run AI Analysis Against Existing Shortlist CSV
```bash
python3 run_ai_analysis.py shortlist.csv --write-supabase --initiated-by "analyst@nivo.ai"
```

- Accepts any CSV exported from the shortlist tooling and stores structured insights in the `ai_ops` schema.
- Pass `--filters '{"segment": "Digital services"}'` to log context about the triggering filters.

## Data Quality and Validation

### 1. Check Database Health
```bash
python3 check_empty_tables.py
```

### 2. Validate KPIs
```bash
python3 validate_kpis.py
```

## Data Enrichment

### 1. Find Websites
```bash
python3 find_websites.py
```

### 2. Calculate Website Fit Scores
```bash
python3 website_fit_score.py
```

### 3. Run Full Enrichment Loop
```bash
python3 run_enrichment_loop.py
```

## Industry Classification

### 1. Create Alternative Classification
```bash
python3 create_alternative_classification.py
```

## Database Management

### 1. Interactive Database Cleaner
```bash
python3 interactive_db_cleaner.py
```

