# Database Schema Diagram

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           companies                                      │
├─────────────────────────────────────────────────────────────────────────┤
│ PK  orgnr                    TEXT                                       │
│     company_id               TEXT (UNIQUE)                               │
│     company_name             TEXT NOT NULL                              │
│     company_type             TEXT                                       │
│     homepage                 TEXT                                       │
│     email                    TEXT                                       │
│     phone                    TEXT                                       │
│     address                  JSONB/TEXT                                 │
│     segment_names            JSONB/TEXT                                 │
│     nace_codes               JSONB/TEXT                                 │
│     foundation_year          INTEGER                                    │
│     employees_latest         INTEGER                                    │
│     accounts_last_year       TEXT                                       │
│     created_at               TIMESTAMPTZ                                │
│     updated_at               TIMESTAMPTZ                                │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      company_financials                                 │
├─────────────────────────────────────────────────────────────────────────┤
│ PK  id                      UUID/TEXT                                   │
│ FK  orgnr                   TEXT → companies.orgnr                      │
│     company_id              TEXT                                       │
│     year                    INTEGER NOT NULL                            │
│     period                  TEXT NOT NULL                              │
│     period_start            DATE/TEXT                                   │
│     period_end              DATE/TEXT                                   │
│     currency                TEXT (default: 'SEK')                       │
│     revenue_sek             NUMERIC ⚠️ (currently SEK, should be thousands)│
│     profit_sek              NUMERIC ⚠️ (currently SEK, should be thousands)│
│     ebitda_sek              NUMERIC ⚠️ (currently SEK, should be thousands)│
│     equity_sek              NUMERIC ⚠️ (currently SEK, should be thousands)│
│     debt_sek                NUMERIC ⚠️ (currently SEK, should be thousands)│
│     employees               INTEGER                                    │
│     account_codes           JSONB/TEXT                                 │
│     raw_json                JSONB/TEXT NOT NULL                         │
│     scraped_at              TIMESTAMPTZ                                │
│     source_job_id           TEXT                                       │
│                                                                         │
│ UNIQUE (orgnr, year, period)                                            │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      financial_accounts                                 │
├─────────────────────────────────────────────────────────────────────────┤
│ PK  id                      UUID/TEXT                                   │
│ FK  financial_id            UUID/TEXT → company_financials.id          │
│ FK  orgnr                   TEXT → companies.orgnr                      │
│     year                    INTEGER NOT NULL                            │
│     period                  TEXT NOT NULL                              │
│     account_code            TEXT NOT NULL                              │
│     amount_sek              NUMERIC NOT NULL ⚠️ (currently SEK, should be thousands)│
│     created_at              TIMESTAMPTZ                                 │
│                                                                         │
│ UNIQUE (financial_id, account_code)                                    │
│ INDEX (orgnr, year DESC)                                                │
│ INDEX (account_code)                                                    │
│ INDEX (orgnr, account_code, year DESC)                                 │
└─────────────────────────────────────────────────────────────────────────┘

                              │
                              │ Aggregated into VIEW
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  financial_accounts_pivot (VIEW)                        │
├─────────────────────────────────────────────────────────────────────────┤
│     orgnr                   TEXT                                       │
│     year                    INTEGER                                    │
│     period                  TEXT                                       │
│     revenue_sek             NUMERIC (from SDI)                          │
│     ebit_sek                NUMERIC (from RG)                           │
│     profit_sek              NUMERIC (from DR)                           │
│     ebitda_sek              NUMERIC (from EBITDA)                       │
│     equity_sek              NUMERIC (from EK)                           │
│     debt_sek                NUMERIC (from FK)                           │
│     total_assets_sek        NUMERIC (from SV)                          │
│     employees               NUMERIC (from ANT)                         │
│     equity_ratio            NUMERIC (from EKA)                         │
│     roe_pct                 NUMERIC                                    │
│     roa_pct                 NUMERIC                                    │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                      company_metrics                                     │
├─────────────────────────────────────────────────────────────────────────┤
│ PK  orgnr                   TEXT → companies.orgnr                      │
│     latest_year              INTEGER                                    │
│     latest_revenue_sek       NUMERIC ⚠️ (currently SEK, should be thousands)│
│     latest_profit_sek        NUMERIC ⚠️ (currently SEK, should be thousands)│
│     latest_ebitda_sek        NUMERIC ⚠️ (currently SEK, should be thousands)│
│     revenue_cagr_3y          NUMERIC                                    │
│     revenue_cagr_5y          NUMERIC                                    │
│     avg_ebitda_margin        NUMERIC                                    │
│     avg_net_margin           NUMERIC                                    │
│     equity_ratio_latest      NUMERIC                                    │
│     debt_to_equity_latest    NUMERIC                                    │
│     revenue_per_employee     NUMERIC                                    │
│     ebitda_per_employee      NUMERIC                                    │
│     digital_presence         BOOLEAN/INTEGER                            │
│     company_size_bucket      TEXT                                       │
│     growth_bucket            TEXT                                       │
│     profitability_bucket     TEXT                                       │
│     calculated_at            TIMESTAMPTZ                               │
│     source_job_id            TEXT                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
┌─────────────────┐
│  Allabolag.se   │
│  (Raw Data)     │
│  Values:        │
│  100,000 tSEK   │
└────────┬────────┘
         │
         │ Scrape
         ▼
┌─────────────────┐
│ Staging DB      │
│ (staging_*.db)  │
│ Values:         │
│ 100,000 tSEK    │
│ (as-is)         │
└────────┬────────┘
         │
         │ Migration
         │ ⚠️ CURRENTLY multiplies by 1000
         │ ✅ SHOULD store as-is
         ▼
┌─────────────────┐
│ Main Database   │
│ (new_schema)    │
│                 │
│ CURRENT:        │
│ 100,000,000 SEK │
│                 │
│ TARGET:         │
│ 100,000 tSEK    │
└────────┬────────┘
         │
         │ Query
         ▼
┌─────────────────┐
│ UI Formatting   │
│                 │
│ CURRENT:        │
│ / 1,000,000     │
│ = 100.0 mSEK    │
│                 │
│ TARGET:         │
│ / 1,000         │
│ = 100.0 mSEK    │
└─────────────────┘
```

## Table Statistics

```
companies:           13,609 records
company_financials:  66,614 records
company_metrics:     13,609 records
financial_accounts:  3,314,236 records
```

## Key Relationships

1. **companies** (1) ──< (N) **company_financials**
   - One company has many financial statements
   - CASCADE DELETE: Deleting company removes all financials

2. **company_financials** (1) ──< (N) **financial_accounts**
   - One financial statement has many account codes
   - CASCADE DELETE: Deleting financial removes all accounts

3. **companies** (1) ──< (1) **company_metrics**
   - One company has one metrics record
   - CASCADE DELETE: Deleting company removes metrics

4. **financial_accounts** ──> **financial_accounts_pivot** (VIEW)
   - Pivots normalized rows into columns for easier querying

## Indexes

### companies
- Primary Key: `orgnr`
- Unique Index: `company_id` (where not null)

### company_financials
- Primary Key: `id`
- Unique Index: `(orgnr, year, period)`
- Index: `year DESC`

### financial_accounts
- Primary Key: `id`
- Unique Constraint: `(financial_id, account_code)`
- Index: `(orgnr, year DESC)`
- Index: `account_code`
- Index: `(account_code, year DESC)`
- Index: `financial_id`
- Index: `(orgnr, account_code, year DESC)`
- Index: `(year DESC, period)`

### company_metrics
- Primary Key: `orgnr`
- No additional indexes (queries are by orgnr)

