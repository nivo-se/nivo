# New Company Data Schema

This document defines the target schema that will replace the legacy `master_analytics` / `company_accounts_by_id` tables. The goal is to store the raw Allabolag payload alongside normalized fields and derived metrics, while keeping the structure simple enough for Supabase access and local development.

## Table: `companies`
| Column | Type | Notes |
|--------|------|-------|
| `orgnr` | TEXT PRIMARY KEY | Swedish organisation number (10 digits, no formatting) |
| `company_id` | TEXT UNIQUE | Allabolag internal company ID (`companyId` / `listingId`) |
| `company_name` | TEXT NOT NULL | Display name |
| `company_type` | TEXT | e.g. `AB` |
| `homepage` | TEXT | URL if available |
| `email` | TEXT | Contact email |
| `phone` | TEXT | Optional main phone |
| `address` | JSONB | `{ street, zip_code, city, county, country }` |
| `segment_names` | JSONB | Array of industry/segment labels |
| `nace_codes` | JSONB | Array of NACE codes |
| `foundation_year` | INTEGER | Year founded |
| `employees_latest` | INTEGER | Latest headcount (as reported by Allabolag) |
| `accounts_last_year` | TEXT | Raw year string for the latest accounts in Allabolag |
| `created_at` | TIMESTAMPTZ DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ DEFAULT NOW() | |

**Notes**
- All string columns are stored unformatted (no spaces or punctuation in `orgnr`).
- `address` is stored as JSON to preserve multiple fields without exploding the table.
- If an Allabolag ID cannot be found (rare), `company_id` is NULL but the row still exists (flagged via `company_metrics`).

## Table: `company_financials`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PRIMARY KEY DEFAULT gen_random_uuid() |
| `orgnr` | TEXT REFERENCES companies(orgnr) ON DELETE CASCADE |
| `company_id` | TEXT | Copy of Allabolag ID for convenience |
| `year` | INTEGER NOT NULL |
| `period` | TEXT NOT NULL | `"12"`, `"2024-06"`, etc. |
| `period_start` | DATE | Parsed from Allabolag JSON |
| `period_end` | DATE | Parsed from Allabolag JSON |
| `currency` | TEXT DEFAULT 'SEK' |
| `revenue_sek` | NUMERIC | Raw amount in SEK (thousands in Allabolag → multiply by 1 000) |
| `profit_sek` | NUMERIC | Net profit in SEK |
| `ebitda_sek` | NUMERIC | From account code `ORS` when available |
| `equity_sek` | NUMERIC | From account code `EK` |
| `debt_sek` | NUMERIC | From account code `FK` |
| `employees` | INTEGER | Employees for period if reported |
| `account_codes` | JSONB | Flattened map `{ "SDI": value, ... }` (all 50+ account codes) |
| `raw_json` | JSONB NOT NULL | Original Allabolag `_next/data` payload for traceability |
| `scraped_at` | TIMESTAMPTZ DEFAULT NOW() |
| `source_job_id` | TEXT | References staging job ID |

**Notes**
- Monetary amounts are stored in SEK (not thousands). The ETL layer converts by ×1 000.
- `account_codes` lets analytics access the entire Allabolag chart of accounts without re-parsing `raw_json`.
- `(orgnr, year, period)` should be unique. We enforce with a unique index.

## Table: `company_metrics`
| Column | Type | Notes |
|--------|------|-------|
| `orgnr` | TEXT PRIMARY KEY REFERENCES companies(orgnr) ON DELETE CASCADE |
| `latest_year` | INTEGER | Convenience pointer to `company_financials` |
| `latest_revenue_sek` | NUMERIC |
| `latest_profit_sek` | NUMERIC |
| `latest_ebitda_sek` | NUMERIC |
| `revenue_cagr_3y` | NUMERIC | Decimal (e.g. 0.12 = 12 %) |
| `revenue_cagr_5y` | NUMERIC |
| `avg_ebitda_margin` | NUMERIC |
| `avg_net_margin` | NUMERIC |
| `equity_ratio_latest` | NUMERIC |
| `debt_to_equity_latest` | NUMERIC |
| `revenue_per_employee` | NUMERIC |
| `ebitda_per_employee` | NUMERIC |
| `digital_presence` | BOOLEAN | Derived from homepage/email availability |
| `company_size_bucket` | TEXT | e.g. `small`, `medium`, `large` |
| `growth_bucket` | TEXT | e.g. `declining`, `flat`, `moderate`, `high` |
| `profitability_bucket` | TEXT |
| `calculated_at` | TIMESTAMPTZ DEFAULT NOW() |
| `source_job_id` | TEXT | To track which staging batch fed the metrics |

**Notes**
- Metrics table keeps frequently accessed KPIs; ETL recomputes and upserts per run.
- Buckets can evolve; store as text to mirror frontend logic.

## Indexes
- `companies`: `CREATE UNIQUE INDEX companies_company_id_idx ON companies(company_id) WHERE company_id IS NOT NULL;`
- `company_financials`: `CREATE UNIQUE INDEX company_financials_unique_period ON company_financials(orgnr, year, period);`
- `company_financials`: `CREATE INDEX company_financials_year_idx ON company_financials(year DESC);`
- `company_metrics`: no additional indexes beyond PK (queries are by orgnr).

## Legacy Table Plan
- Tables to **keep**: AI analysis tables (`ai_ops.*`), valuation tables, user roles.
- Tables to **archive then drop**: `master_analytics`, `company_accounts_by_id`, `company_kpis`, `companies_enriched`, `saved_company_lists`.
- Tables to **copy then drop**: `scraper_staging_*` (after confirming snapshots), older exports (e.g., `digitizable_*`).
- Backups are taken before anything is dropped.

## Local Development Schema
- Mirror the same structure in a local SQLite/Postgres DB for analytics notebooks and dashboards.
- Provide helper scripts to load from the combined staging datasets into the new schema locally.

