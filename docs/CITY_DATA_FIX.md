# City Data Fix - Implementation Summary

## Problem
City data and address details were not available in the database because:
1. The migration script set `address` to `None` during migration
2. Address data existed in `raw_json` but wasn't being extracted
3. Frontend components expected both `address` and `city` fields but they were empty

## Solution Implemented

### 1. Updated Migration Script (`scripts/migrate_staging_to_new_schema.py`)

**Added address extraction function:**
- Created `extract_address_from_company_info()` function that extracts structured address data from company info
- Extracts: `addressLine`, `postPlace`, `postCode`, `city`, `county`, `country`
- Handles multiple address sources: `visitorAddress`, `mainOffice`, `location`, `domicile`

**Updated migration process:**
- During `transform()`, address data is now extracted from `raw_json` when processing financials
- Address data is collected in an `address_map` (orgnr -> address object)
- `build_companies_rows()` now accepts and uses the address map to populate the `address` field
- Address is stored as JSON string in the database

### 2. Improved Backfill Script (`scripts/extract_city_from_raw_json.py`)

**Enhanced address extraction:**
- Updated `extract_address_from_raw_json()` to match the migration script's extraction logic
- Now extracts full address details, not just city
- Handles fallback cases for different data structures

### 3. Enhanced Frontend Transform Function (`frontend/server/enhanced-server.ts`)

**Improved address parsing:**
- Better handling of address JSON objects
- Formats full address string: "addressLine, postCode, city"
- Extracts city separately for display
- Falls back to extracting from `raw_json` if address field is empty

### 4. Homepage Extraction (`scripts/extract_homepage_from_staging.py`)

**Created homepage extraction script:**
- Extracts homepage/website URLs from staging databases
- Handles both `homePage` (capital P) and `homepage` (lowercase) field names
- Normalizes URLs to include `https://` prefix if missing
- Updates `companies.homepage` field in local database

**Updated migration script:**
- Migration script now extracts homepage from `company_info` during migration
- Homepage data is collected in a `homepage_map` (orgnr -> homepage URL)
- `build_companies_rows()` now accepts and uses the homepage map

## Address Data Structure

Addresses are stored as JSON objects with the following structure:

```json
{
  "addressLine": "Street Name 123",
  "postPlace": "Stockholm",
  "postCode": "12345",
  "city": "Stockholm",
  "county": "Stockholms län",
  "country": "Sweden"
}
```

## Usage

### For New Migrations
The migration script now automatically extracts address data during migration:
```bash
python3 scripts/migrate_staging_to_new_schema.py \
    --source scraper/allabolag-scraper/staging/staging_*.db \
    --local-sqlite data/new_schema_local.db
```

### For Existing Data
To backfill address data for existing companies:
```bash
# Extract from raw_json in company_financials
python3 scripts/extract_city_from_raw_json.py

# Or extract from staging databases
python3 scripts/extract_address_from_staging.py
```

To backfill homepage data for existing companies:
```bash
# Extract homepage URLs from staging databases
python3 scripts/extract_homepage_from_staging.py
```

## Frontend Display

The frontend now displays:
- **Address**: Full formatted address string (e.g., "Street 123, 12345 Stockholm")
- **City**: City name extracted from address (e.g., "Stockholm")

Both fields are available in:
- Company search results
- Company detail views
- Analytics dashboards
- List-based analytics

## Testing

To verify the fix works:

1. **Check database:**
   ```sql
   SELECT orgnr, company_name, address 
   FROM companies 
   WHERE address IS NOT NULL 
   LIMIT 10;
   ```

2. **Run backfill script:**
   ```bash
   python3 scripts/extract_city_from_raw_json.py
   ```

3. **Check frontend:**
   - Search for companies and verify address/city display
   - Check company detail views show address information

## Files Modified

1. `scripts/migrate_staging_to_new_schema.py` - Added address and homepage extraction during migration
2. `scripts/extract_city_from_raw_json.py` - Improved address extraction logic
3. `scripts/extract_address_from_staging.py` - Extract addresses from staging databases
4. `scripts/extract_homepage_from_staging.py` - Extract homepage URLs from staging databases
5. `frontend/server/enhanced-server.ts` - Enhanced address parsing and formatting

## Next Steps

- [x] Run backfill script on existing database
- [x] Extract addresses from staging databases
- [ ] Verify address data displays correctly in frontend
- [ ] Test with new migrations to ensure address extraction works
- [ ] Consider adding address validation/normalization if needed

## Current Status

✅ **Completed:**
- Migration script extracts addresses during migration
- Backfill script extracts addresses from staging databases
- Frontend transform function handles address parsing
- **13,173 of 13,609 companies (96.8%) have city data**
- **All companies have address data (some partial with only county)**
- Migration script extracts homepage URLs during migration
- Backfill script extracts homepage URLs from staging databases
- **759 of 13,609 companies (5.6%) have homepage data**

⚠️ **Remaining:**
- 435 companies (3.2%) have partial addresses (county only, no city)
- These companies likely don't have complete address data in source databases
- 12,850 companies (94.4%) don't have homepage data - may need to fetch from Allabolag API or other sources

