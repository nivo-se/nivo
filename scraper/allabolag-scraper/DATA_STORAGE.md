# Data Storage Documentation

This document describes the data storage structure for the Allabolag scraper, including what data is collected, how it's stored, and how to access it.

## Database Schema

### Local Staging Database

The scraper uses a local SQLite database for staging scraped data before migration to production. Each job creates a separate database file: `staging/staging_{jobId}.db`

### Tables

#### 1. `staging_jobs`
Stores job metadata and progress tracking.

```sql
CREATE TABLE staging_jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  filter_hash TEXT NOT NULL,
  params TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  stage TEXT NOT NULL DEFAULT 'stage1_segmentation',
  last_page INTEGER DEFAULT 0,
  processed_count INTEGER DEFAULT 0,
  total_companies INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  migration_status TEXT DEFAULT 'pending',
  rate_limit_stats TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

#### 2. `staging_companies`
Stores basic company information from segmentation stage.

```sql
CREATE TABLE staging_companies (
  orgnr TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  company_id TEXT,
  company_id_hint TEXT,
  homepage TEXT,
  nace_categories TEXT DEFAULT '[]',
  segment_name TEXT DEFAULT '[]',
  revenue_sek REAL,
  profit_sek REAL,
  foundation_year INTEGER,
  company_accounts_last_year TEXT,
  scraped_at TEXT DEFAULT CURRENT_TIMESTAMP,
  job_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  last_processed_at TEXT,
  error_count INTEGER DEFAULT 0,
  error_message TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Fields:**
- `orgnr`: Swedish organization number (primary key)
- `company_name`: Company display name
- `company_id`: Allabolag.se internal company ID
- `homepage`: Company website URL
- `nace_categories`: JSON array of NACE industry codes
- `segment_name`: JSON array of industry segment names
- `revenue_sek`: Latest revenue in SEK (from segmentation)
- `profit_sek`: Latest profit in SEK (from segmentation)
- `foundation_year`: Year company was founded
- `status`: Processing status (`pending`, `id_resolved`, `financials_fetched`, `error`)

#### 3. `staging_company_ids`
Stores resolved company IDs from enrichment stage.

```sql
CREATE TABLE staging_company_ids (
  orgnr TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  resolved_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (orgnr) REFERENCES staging_companies(orgnr)
);
```

#### 4. `staging_financials`
Stores detailed financial data from Allabolag.se.

```sql
CREATE TABLE staging_financials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orgnr TEXT NOT NULL,
  company_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  period TEXT,
  period_start TEXT,
  period_end TEXT,
  currency TEXT DEFAULT 'SEK',
  
  -- Core financial metrics
  sdi REAL,  -- Revenue (Omsättning)
  dr REAL,   -- Net Profit (Årets resultat)
  ors REAL,  -- EBITDA (Rörelseresultat)
  ek REAL,   -- Equity (Eget kapital)
  fk REAL,   -- Debt (Skulder)
  
  -- Additional account codes (50+ fields)
  adi REAL, adk REAL, adr REAL, ak REAL, ant REAL,
  fi REAL, gg REAL, kbp REAL, lg REAL, rg REAL,
  sap REAL, sed REAL, si REAL, sek REAL, sf REAL,
  sfa REAL, sge REAL, sia REAL, sik REAL, skg REAL,
  skgki REAL, sko REAL, slg REAL, som REAL, sub REAL,
  sv REAL, svd REAL, utr REAL, fsd REAL, kb REAL,
  awa REAL, iac REAL, min REAL, be REAL, tr REAL,
  
  -- Metadata
  raw_data TEXT,  -- Complete JSON response from Allabolag.se
  validation_status TEXT DEFAULT 'pending',
  validation_errors TEXT,
  job_id TEXT NOT NULL,
  scraped_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (orgnr) REFERENCES staging_companies(orgnr)
);
```

## Financial Data Fields

### Core Metrics
- **SDI (Omsättning)**: Revenue/Turnover
- **DR (Årets resultat)**: Net Profit/Annual Result
- **ORS (Rörelseresultat)**: Operating Result/EBITDA
- **EK (Eget kapital)**: Equity/Own Capital
- **FK (Skulder)**: Debt/Liabilities

### Additional Account Codes
The scraper captures 50+ additional account codes from Allabolag.se's financial reports. These include:
- **ADI, ADK, ADR**: Various depreciation accounts
- **AK**: Fixed assets
- **ANT**: Number of employees
- **FI**: Financial income
- **GG**: Cost of goods sold
- **KBP**: Capital and reserves
- **LG**: Personnel costs
- **RG**: Operating income
- **SAP**: Sales and marketing
- **SED**: Other operating expenses
- **SI**: Financial expenses
- **SEK**: Currency adjustments
- **SF, SFA**: Various expense accounts
- **SGE**: Other operating income
- **SIA, SIK**: Various income accounts
- **SKG, SKGKI**: Various cost accounts
- **SKO**: Other costs
- **SLG**: Personnel expenses
- **SOM**: Other operating costs
- **SUB**: Subsidies
- **SV, SVD**: Various expense accounts
- **UTR**: Other income
- **FSD**: Financial statement date
- **KB**: Capital base
- **AWA**: Average number of employees
- **IAC**: Interest and similar charges
- **MIN**: Minority interests
- **BE**: Business expenses
- **TR**: Tax-related accounts

## Additional Company Data

The scraper also extracts additional company information from the Allabolag.se JSON response, stored in the `raw_data` field and parsed for display:

### Available Fields
- **employees**: Number of employees (or year)
- **description**: Company description (HTML)
- **phone**: Contact phone number
- **email**: Contact email address
- **legalName**: Official company name
- **domicile**: Location information (municipality, county)
- **signatory**: Authorized signatories
- **directors**: Board members
- **foundationDate**: Exact foundation date
- **businessUnitType**: Type of business unit
- **industries**: Industry classifications
- **certificates**: Company certificates
- **externalLinks**: External website links

### Accessing Additional Data

The additional data is stored in the `raw_data` JSON field and can be accessed like this:

```typescript
// Parse raw_data to get additional company information
const rawData = JSON.parse(financialRecord.raw_data);
const companyData = rawData?.pageProps?.company;

// Access specific fields
const employees = companyData?.employees;
const phone = companyData?.phone;
const domicile = companyData?.domicile;
const directors = companyData?.directors;
```

## Data Flow

### Stage 1: Segmentation
1. Scraper searches Allabolag.se with filters
2. Extracts basic company information
3. Stores in `staging_companies` table
4. Status: `pending`

### Stage 2: Enrichment
1. For each company, searches Allabolag.se by name
2. Resolves the internal `company_id` needed for financial data
3. Updates `staging_companies.status` to `id_resolved`
4. Stores resolved IDs in `staging_company_ids`

### Stage 3: Financial Data
1. For each resolved company, fetches detailed financial data
2. Parses annual reports and account codes
3. Stores in `staging_financials` table
4. Updates `staging_companies.status` to `financials_fetched`

## Validation and Migration

### Validation
- Check data completeness and consistency
- Validate financial data ranges
- Flag missing or suspicious data
- Update `validation_status` in `staging_financials`

### Migration to Production
- Export validated data from staging database
- Transform data to production schema
- Insert into Supabase production tables
- Update migration status

## API Endpoints

### Validation Data
- **GET** `/api/validation/data?jobId={jobId}`
- Returns structured validation data with company and financial information
- Includes summary statistics and year ranges

### Job Statistics
- **GET** `/api/job/statistics?jobId={jobId}`
- Returns job progress and data quality metrics

## Data Quality Considerations

### Inconsistent Data
- Companies may have different numbers of board members
- Financial data availability varies by company
- Some fields may be missing or null
- Account codes may not be present for all companies

### Validation Rules
- Revenue (SDI) should be positive for active companies
- Net profit (DR) can be negative (losses)
- Equity (EK) should generally be positive
- Year should be within reasonable range (2000-current year)

### Data Completeness
- Not all companies have financial data for all years
- Some companies may have only recent data
- Historical data availability varies by company size and type

## Usage Examples

### Query Companies with Financial Data
```sql
SELECT c.company_name, c.orgnr, c.foundation_year,
       COUNT(f.year) as financial_years,
       MIN(f.year) as earliest_year,
       MAX(f.year) as latest_year
FROM staging_companies c
LEFT JOIN staging_financials f ON c.orgnr = f.orgnr
WHERE c.status = 'financials_fetched'
GROUP BY c.orgnr, c.company_name, c.foundation_year
ORDER BY c.company_name;
```

### Get Financial Trends
```sql
SELECT year, 
       AVG(sdi) as avg_revenue,
       AVG(dr) as avg_profit,
       COUNT(*) as company_count
FROM staging_financials
WHERE sdi IS NOT NULL AND dr IS NOT NULL
GROUP BY year
ORDER BY year DESC;
```

### Extract Additional Company Data
```sql
SELECT c.company_name, c.orgnr,
       json_extract(f.raw_data, '$.pageProps.company.employees') as employees,
       json_extract(f.raw_data, '$.pageProps.company.phone') as phone,
       json_extract(f.raw_data, '$.pageProps.company.domicile.municipality') as municipality
FROM staging_companies c
JOIN staging_financials f ON c.orgnr = f.orgnr
WHERE c.status = 'financials_fetched'
LIMIT 10;
```

## Troubleshooting

### Common Issues
1. **Missing financial data**: Check if company_id was resolved in Stage 2
2. **Incomplete data**: Some companies may not have all account codes
3. **Data inconsistencies**: Validate against known company information
4. **Performance**: Large datasets may require pagination

### Data Validation
- Use the validation UI to check data completeness
- Verify financial data ranges are reasonable
- Check for duplicate entries
- Validate organization numbers format
