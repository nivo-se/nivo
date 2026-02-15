# Optimized Database Schema

## Database Information

**Database Name**: `data/nivo_optimized.db`  
**Size**: 36.0 MB  
**Purpose**: Optimized version of staging data with extracted account codes as columns (reduced from 1.3GB by removing raw JSON)

## Tables

1. **companies** - Company master data
2. **financials** - Financial statements with extracted account codes
3. **company_kpis** - Derived metrics and KPIs (if exists)
4. **ai_profiles** - AI-generated company profiles (if exists)

---

## 1. COMPANIES TABLE

**Records**: 13,610 companies

### Columns (16)

| Column | Type | Description |
|--------|------|-------------|
| `orgnr` | TEXT | Primary Key - Organization number |
| `company_id` | TEXT | Allabolag company ID |
| `company_name` | TEXT | Company name |
| `homepage` | TEXT | Company website URL |
| `foundation_year` | INTEGER | Year company was founded |
| `employees_latest` | INTEGER | Latest employee count |
| `nace_categories` | TEXT | NACE industry codes (JSON) |
| `segment_names` | TEXT | Industry segments (JSON) |
| `address` | TEXT | Street address |
| `city` | TEXT | City name |
| `postal_code` | TEXT | Postal code |
| `country` | TEXT | Country (default: SE) |
| `phone` | TEXT | Phone number |
| `email` | TEXT | Email address |
| `scraped_at` | TEXT | When data was scraped |
| `updated_at` | TEXT | Last update timestamp |

---

## 2. FINANCIALS TABLE

**Records**: 66,130 financial records (year >= 2020)

### Base Columns (11)

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Primary Key - `{orgnr}_{year}_{period}` |
| `orgnr` | TEXT | Organization number (FK to companies) |
| `company_id` | TEXT | Allabolag company ID |
| `year` | INTEGER | Financial year |
| `period` | TEXT | Period (e.g., '2024-12', '2024-08') |
| `period_start` | TEXT | Period start date |
| `period_end` | TEXT | Period end date |
| `currency` | TEXT | Currency (default: SEK) |
| `employees` | INTEGER | Employee count for this period |
| `scraped_at` | TEXT | When data was scraped |
| `created_at` | TEXT | Record creation timestamp |

### Account Code Columns (53)

All financial values are in **SEK** (converted from thousands in source data).

#### Revenue & Sales
- `si_sek` - **Net Revenue** (Nettoomsättning) - **PREFERRED**
- `sdi_sek` - Total Revenue (Omsättning) - Fallback

#### Profitability Metrics
- `resultat_e_avskrivningar_sek` - **EBIT** (Rörelseresultat efter avskrivningar) - **PREFERRED**
- `ebitda_sek` - **EBITDA** - **PREFERRED**
- `ors_sek` - Operating Result (EBITDA fallback)
- `dr_sek` - Net Profit (Årets resultat)
- `be_sek` - Gross Profit (Bruttoresultat)
- `resultat_e_finansnetto_sek` - Profit Before Tax (PBT)
- `rpe_sek` - Result after financial items
- `tr_sek` - Operating Result

#### Balance Sheet
- `ek_sek` - Equity (Eget kapital)
- `fk_sek` - Debt (Främmande kapital)
- `sv_sek` - Total Assets (Summa tillgångar)

#### Depreciation
- `adi_sek` - Total Depreciation (Avskrivningar)
- `adk_sek` - Building Depreciation (Avskrivningar på byggnader)
- `adr_sek` - Equipment Depreciation (Avskrivningar på inventarier)

#### Fixed Assets
- `ak_sek` - Fixed Assets (Anläggningskapital)
- `sfa_sek` - Total Financial Fixed Assets

#### Employees
- `ant_sek` - Number of Employees (NOT in thousands - actual count)
- `gg_sek` - Average Employees

#### Financial Items
- `fi_sek` - Financial Income
- `sek_sek` - Cash and Cash Equivalents

#### Liabilities
- `kb_sek` - Short-term Liabilities (Kortfristiga belopp)
- `kbp_sek` - Short-term Liabilities, Staff
- `lg_sek` - Long-term Liabilities (Långfristiga skulder)

#### Sum Codes
- `sap_sek`, `sed_sek`, `sf_sek`, `sge_sek`, `sia_sek`, `sik_sek`
- `skg_sek`, `skgki_sek`, `sko_sek`, `slg_sek`, `som_sek`, `sub_sek`
- `svd_sek`

#### Other Codes
- `fsd_sek` - Sales & Distribution Costs
- `utr_sek`, `awa_sek`, `iac_sek`, `min_sek`
- `rg_sek` - **Working Capital** (NOT EBIT! - kept for reference)
- `cpe_sek`

#### Calculated/Derived Fields
- `summa_rorelsekostnader_sek` - Total Operating Costs
- `summa_finansiella_anltillg_sek` - Total Financial Fixed Assets
- `summa_langfristiga_skulder_sek` - Total Long-term Liabilities
- `avk_eget_kapital_sek` - Return on Equity (ROE)
- `avk_totalt_kapital_sek` - Return on Total Capital (ROA)
- `eka_sek` - Equity Ratio
- `loner_styrelse_vd_sek` - Board and CEO Salaries
- `loner_ovriga_sek` - Other Salaries

---

## Key Financial Metrics (Most Important)

### Revenue
- **Primary**: `si_sek` (Net Revenue - Nettoomsättning)
- **Fallback**: `sdi_sek` (Total Revenue)

### EBIT (Operating Profit)
- **Primary**: `resultat_e_avskrivningar_sek` (Rörelseresultat efter avskrivningar)
- **⚠️ DO NOT USE**: `rg_sek` (This is Working Capital, NOT EBIT!)

### EBITDA
- **Primary**: `ebitda_sek`
- **Fallback**: `ors_sek`

### Net Profit
- **Primary**: `dr_sek` (Årets resultat)

### Balance Sheet
- **Equity**: `ek_sek`
- **Debt**: `fk_sek`
- **Total Assets**: `sv_sek`

---

## Data Source

All account codes are extracted from `raw_data` JSON in the staging database:
- **Source**: `staging_financials.raw_data` (Allabolag JSON)
- **Extraction**: `extract_account_codes_from_raw_data()` function
- **Conversion**: Values multiplied by 1000 (from thousands to SEK)
- **Exception**: `ant_sek` (employees) is NOT multiplied (actual count)

---

## Filtering

- **Year Filter**: Only records with `year >= 2020` are included
- **Records Excluded**: 484 records from 2019 and earlier

---

## Size Optimization

- **Staging DB**: 1,380.8 MB (with raw JSON)
- **Optimized DB**: 36.0 MB (extracted columns only)
- **Reduction**: 97.4%
- **Trade-off**: Raw JSON removed, but all account codes extracted as columns for fast querying

---

## Usage Example

```sql
-- Get latest financials for a company
SELECT 
    year,
    si_sek as revenue,
    resultat_e_avskrivningar_sek as ebit,
    ebitda_sek,
    dr_sek as net_profit
FROM financials
WHERE orgnr = '5562642362'
ORDER BY year DESC
LIMIT 5;
```

---

## Related Files

- **Migration Script**: `scripts/create_optimized_db.py`
- **Account Code Mapping**: `database/allabolag_account_code_mapping.json`
- **Schema Documentation**: This file

