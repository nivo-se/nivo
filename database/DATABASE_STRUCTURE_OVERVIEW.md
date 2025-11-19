# Database Structure Overview

**Last Updated:** 2025-01-XX  
**Current Active Database:** `data/new_schema_local.db` (SQLite) / Supabase (PostgreSQL)

---

## 📊 Data Format Standard

**CRITICAL:** All financial data from Allabolag.se should be stored in **thousands (tSEK)**.

### Current State (⚠️ INCONSISTENT):
- **Raw Data (Allabolag):** Values are in thousands (e.g., `100,000` = 100,000 tSEK)
- **Current Database Storage:** Values are stored in **SEK** (multiplied by 1000 during migration)
  - Example: `66334000.0` = 66,334,000 SEK = 66.334 mSEK
- **Current UI Formatting:** Divides by 1,000,000 (treating as SEK)

### Target State (✅ REQUIRED):
- **Raw Data (Allabolag):** Values are in thousands (e.g., `100,000` = 100,000 tSEK)
- **Database Storage:** Values should be stored **as-is in thousands** (e.g., `100000` = 100,000 tSEK)
- **UI Display:** Format thousands to mSEK (e.g., `100000` → `100.0 mSEK`)

**Target Conversion Formula:**
```
UI Display = Database Value / 1,000 = mSEK
Example: 100,000 (thousands) / 1,000 = 100.0 mSEK
```

**⚠️ ACTION REQUIRED:** Migration script currently multiplies by 1000 (converting thousands → SEK). This needs to be changed to store values as-is in thousands.

---

## 🗄️ Current Database Schema

### Primary Database: `new_schema_local.db` (SQLite)

#### 1. **companies** (Master Company Data)
| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| `orgnr` | TEXT PRIMARY KEY | Swedish organization number (10 digits) | No formatting |
| `company_id` | TEXT UNIQUE | Allabolag internal company ID | Can be NULL |
| `company_name` | TEXT NOT NULL | Company display name | |
| `company_type` | TEXT | Legal form (e.g., "AB") | |
| `homepage` | TEXT | Company website URL | |
| `email` | TEXT | Contact email | |
| `phone` | TEXT | Main phone number | |
| `address` | TEXT/JSONB | Address information | JSON format in Postgres |
| `segment_names` | TEXT/JSONB | Industry segments array | JSON format in Postgres |
| `nace_codes` | TEXT/JSONB | NACE industry codes array | JSON format in Postgres |
| `foundation_year` | INTEGER | Year company was founded | |
| `employees_latest` | INTEGER | Latest employee count | |
| `accounts_last_year` | TEXT | Latest financial year string | |
| `created_at` | TEXT/TIMESTAMPTZ | Record creation timestamp | |
| `updated_at` | TEXT/TIMESTAMPTZ | Last update timestamp | |

**Indexes:**
- Primary Key: `orgnr`
- Unique Index: `company_id` (where not null)

---

#### 2. **company_financials** (Historical Financial Statements)
| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| `id` | TEXT/UUID PRIMARY KEY | Unique financial record ID | UUID in Postgres |
| `orgnr` | TEXT NOT NULL | Foreign key to companies | CASCADE delete |
| `company_id` | TEXT | Allabolag company ID | |
| `year` | INTEGER NOT NULL | Financial year | |
| `period` | TEXT NOT NULL | Period code ("12" = annual) | |
| `period_start` | TEXT/DATE | Period start date | |
| `period_end` | TEXT/DATE | Period end date | |
| `currency` | TEXT | Currency code (default: "SEK") | |
| `revenue_sek` | REAL/NUMERIC | Revenue in **thousands** | ⚠️ Stored in thousands |
| `profit_sek` | REAL/NUMERIC | Net profit in **thousands** | ⚠️ Stored in thousands |
| `ebitda_sek` | REAL/NUMERIC | EBITDA in **thousands** | ⚠️ Stored in thousands |
| `equity_sek` | REAL/NUMERIC | Equity in **thousands** | ⚠️ Stored in thousands |
| `debt_sek` | REAL/NUMERIC | Debt in **thousands** | ⚠️ Stored in thousands |
| `employees` | INTEGER | Employee count for period | |
| `account_codes` | TEXT/JSONB | All account codes as JSON | Flattened map |
| `raw_json` | TEXT/JSONB NOT NULL | Original Allabolag payload | For traceability |
| `scraped_at` | TEXT/TIMESTAMPTZ | Scraping timestamp | |
| `source_job_id` | TEXT | Staging job ID reference | |

**Indexes:**
- Primary Key: `id`
- Unique Index: `(orgnr, year, period)` - prevents duplicates
- Index: `year DESC` - for time-based queries

**⚠️ IMPORTANT:** All `*_sek` columns **currently** store values in **SEK** (multiplied by 1000), but **should** store values in **thousands** (as-is from Allabolag)!

---

#### 3. **company_metrics** (Pre-calculated KPIs)
| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| `orgnr` | TEXT PRIMARY KEY | Foreign key to companies | CASCADE delete |
| `latest_year` | INTEGER | Most recent financial year | |
| `latest_revenue_sek` | REAL/NUMERIC | Latest revenue in **thousands** | ⚠️ Stored in thousands |
| `latest_profit_sek` | REAL/NUMERIC | Latest profit in **thousands** | ⚠️ Stored in thousands |
| `latest_ebitda_sek` | REAL/NUMERIC | Latest EBITDA in **thousands** | ⚠️ Stored in thousands |
| `revenue_cagr_3y` | REAL/NUMERIC | 3-year revenue CAGR | Decimal (0.12 = 12%) |
| `revenue_cagr_5y` | REAL/NUMERIC | 5-year revenue CAGR | Decimal |
| `avg_ebitda_margin` | REAL/NUMERIC | Average EBITDA margin | Decimal (0.15 = 15%) |
| `avg_net_margin` | REAL/NUMERIC | Average net profit margin | Decimal |
| `equity_ratio_latest` | REAL/NUMERIC | Latest equity ratio | Decimal |
| `debt_to_equity_latest` | REAL/NUMERIC | Latest debt-to-equity | Decimal |
| `revenue_per_employee` | REAL/NUMERIC | Revenue per employee | In thousands |
| `ebitda_per_employee` | REAL/NUMERIC | EBITDA per employee | In thousands |
| `digital_presence` | INTEGER/BOOLEAN | Has homepage/email | 0/1 in SQLite |
| `company_size_bucket` | TEXT | Size category | "small", "medium", "large" |
| `growth_bucket` | TEXT | Growth category | "declining", "flat", "moderate", "high" |
| `profitability_bucket` | TEXT | Profitability category | "loss-making", "low", "healthy", "high" |
| `calculated_at` | TEXT/TIMESTAMPTZ | Calculation timestamp | |
| `source_job_id` | TEXT | Source job reference | |

**⚠️ IMPORTANT:** All `*_sek` columns store values in **thousands**!

---

#### 4. **financial_accounts** (Normalized Account Codes)
| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| `id` | TEXT/UUID PRIMARY KEY | Unique account record ID | |
| `financial_id` | TEXT/UUID NOT NULL | Foreign key to company_financials | CASCADE delete |
| `orgnr` | TEXT NOT NULL | Foreign key to companies | CASCADE delete |
| `year` | INTEGER NOT NULL | Financial year | |
| `period` | TEXT NOT NULL | Period code | |
| `account_code` | TEXT NOT NULL | Account code (SDI, RG, DR, etc.) | See codes below |
| `amount_sek` | REAL/NUMERIC NOT NULL | Amount in **thousands** | ⚠️ Stored in thousands |
| `created_at` | TEXT/TIMESTAMPTZ | Record creation timestamp | |

**Indexes:**
- Primary Key: `id`
- Unique Constraint: `(financial_id, account_code)` - one code per financial period
- Index: `(orgnr, year DESC)` - company time series
- Index: `account_code` - code-based queries
- Index: `(account_code, year DESC)` - code trends
- Index: `financial_id` - financial record lookup
- Index: `(orgnr, account_code, year DESC)` - company code trends
- Index: `(year DESC, period)` - period-based queries

**Common Account Codes:**
- `SDI` - Nettoomsättning (Revenue)
- `RG` - Resultat före skatt (EBIT)
- `DR` - Årets resultat (Net Profit)
- `EBITDA` - EBITDA (calculated)
- `EK` - Eget kapital (Equity)
- `FK` - Skulder (Debt)
- `SV` - Summa tillgångar (Total Assets)
- `ANT` - Antal anställda (Employees)
- `EKA` - Eget kapital i % (Equity Ratio)
- And 40+ more codes...

**⚠️ IMPORTANT:** `amount_sek` stores values in **thousands**!

---

#### 5. **financial_accounts_pivot** (View)
A pivoted view that transforms normalized `financial_accounts` rows into columns for easier querying.

**Columns:** `orgnr`, `year`, `period`, `revenue_sek`, `ebit_sek`, `profit_sek`, `ebitda_sek`, `equity_sek`, `debt_sek`, `total_assets_sek`, `employees`, `equity_ratio`, `roe_pct`, `roa_pct`

**⚠️ IMPORTANT:** All `*_sek` columns are in **thousands**!

---

#### 6. **company_kpis_local** (Local SQLite Only)
Additional KPI calculations stored locally (not in Supabase).

---

## 📁 Old Databases Found

### Staging Databases (Scraper)
**Location:** `scraper/allabolag-scraper/staging/`

**Found 36+ staging database files:**
- `staging_current.db` - Current active staging DB
- `staging_50_200_combined.db` - Combined staging data
- `staging_*.db` - Individual job staging databases (30+ files)

**Purpose:** Temporary storage during scraping before migration to main schema.

**Status:** ⚠️ Can be cleaned up after migration verification.

---

### Backup Databases
**Location:** `backups/databases/`

- `allabolag_backup_may2024.db` - May 2024 backup
- `allabolag_original_20251023.db` - October 2025 backup

**Status:** ✅ Keep for historical reference.

---

## 🔄 Data Flow

```
Allabolag.se (Raw Data)
    ↓
    [Values in thousands: 100,000]
    ↓
Staging Database (staging_*.db)
    ↓
    [Values still in thousands: 100,000]
    ↓
Migration Script (migrate_staging_to_new_schema.py)
    ↓
    [Values stored as-is in thousands: 100,000]
    ↓
Main Database (new_schema_local.db / Supabase)
    ↓
    [Storage: 100,000 (thousands)]
    ↓
UI Formatting (formatCurrency function)
    ↓
    [Display: 100,000 / 1,000 = 100.0 mSEK]
```

---

## ⚠️ Critical Notes

1. **Data Format Consistency:**
   - All financial values (`*_sek` columns) are stored in **thousands**
   - UI must divide by 1,000 to display as mSEK
   - Never multiply by 1,000 when storing data

2. **Migration Script Behavior:**
   - `migrate_staging_to_new_schema.py` uses `thousands_to_sek()` function
   - This function multiplies by 1,000 (converting thousands → SEK)
   - **ISSUE:** This contradicts the target standard! Should store as-is in thousands.

3. **Current Database State:**
   - Values ARE currently stored in SEK (multiplied by 1000)
   - Example: `latest_revenue_sek: 66334000.0` = 66,334,000 SEK
   - UI divides by 1,000,000 to get 66.334 mSEK
   - **REQUIRED CHANGE:** Store as `66334.0` (thousands) and divide by 1,000 in UI

---

## 🔍 Verification Needed

**ACTION REQUIRED:** Verify actual data format in database:

```sql
-- Check actual values
SELECT 
    orgnr,
    latest_revenue_sek,
    latest_revenue_sek / 1000 as if_thousands,
    latest_revenue_sek / 1000000 as if_sek
FROM company_metrics 
LIMIT 5;

-- Expected: If stored in thousands, values like 100000 should display as 100 mSEK
-- Expected: If stored in SEK, values like 100000000 should display as 100 mSEK
```

---

## 📝 Schema Files

### Main Schema Definitions:
- `database/new_schema.sql` - PostgreSQL schema (Supabase)
- `database/financial_accounts_schema.sql` - Financial accounts table (PostgreSQL)
- `database/financial_accounts_schema_sqlite.sql` - SQLite version
- `scripts/migrate_staging_to_new_schema.py` - Migration script with SQLite schema

### Documentation:
- `docs/schema/new_company_schema.md` - Schema documentation
- `database/DATA_MAPPING_GUIDE.md` - Data mapping guide
- `database/FINANCIAL_ACCOUNTS_IMPLEMENTATION_ROADMAP.md` - Implementation roadmap

### Other Schemas:
- `database/saved_lists_schema.sql` - Saved company lists
- `database/ai_ops_schema.sql` - AI operations tables
- `database/valuation_schema.sql` - Valuation tables
- `database/valuation_schema_simple.sql` - Simplified valuation schema

---

## 🎯 Recommendations

1. **Standardize Data Format:**
   - Decide: Store in thousands OR SEK (not both!)
   - Update all migration scripts to be consistent
   - Update UI formatting to match storage format

2. **Clean Up Old Databases:**
   - Archive old staging databases
   - Keep only `staging_current.db` for active scraping
   - Document backup retention policy

3. **Update Documentation:**
   - Clarify data format in all schema files
   - Add data format notes to migration scripts
   - Update UI formatting documentation

4. **Add Data Validation:**
   - Add checksums/validation for data format
   - Add unit tests for data transformations
   - Add migration verification scripts

---

## 📊 Current Database Statistics

**Active Database:** `data/new_schema_local.db`

- **Companies:** ~13,609 companies
- **Financial Records:** ~10,188 companies with financials
- **Metrics:** ~9,217 companies with KPIs
- **Financial Accounts:** Normalized account code records

---

**Last Verified:** 2025-01-XX  
**Next Review:** After data format standardization

