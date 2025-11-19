# City Data Solution

## Current Situation

City data is **not available** in the current database because:
1. The `companies.address` field is empty (set to `None` during migration)
2. The `company_financials.raw_json` only contains financial data, not full company metadata
3. The staging databases don't store address information

## Solution Options

### Option 1: Fetch from Allabolag API (Recommended)

Create an endpoint that fetches company details including address from Allabolag:

```typescript
// Endpoint: GET /api/company-details/:orgnr
// Fetches full company data from Allabolag API
// Extracts: visitorAddress, mainOffice, location, domicile
```

**Pros:**
- Gets fresh, accurate data
- Includes full address information

**Cons:**
- Requires API access
- May be rate-limited
- Takes time to fetch for all companies

### Option 2: Update Migration Script

Modify `scripts/migrate_staging_to_new_schema.py` to extract address from the full Allabolag company detail response when available.

**Pros:**
- Populates data during migration
- No additional API calls needed

**Cons:**
- Requires re-running migration
- Only works if full company data is available in source

### Option 3: Use External Data Source

Use a Swedish business registry API or database to get city/postal code from `orgnr`.

**Pros:**
- Reliable source
- Can batch update all companies

**Cons:**
- Requires external API/database access
- May have costs

## Immediate Fix

The code is already set up to extract city from `raw_json` when available. The issue is that the current `raw_json` doesn't contain address data.

**Next Steps:**
1. Check if you have access to full Allabolag company detail responses
2. If yes, update the scraper to store full company data in `raw_json`
3. If no, implement Option 1 to fetch address data on-demand

## Testing

To verify city extraction works when data is available:

```bash
# Test with a company that has address in raw_json
python3 scripts/extract_city_from_raw_json.py
```

## Code Status

✅ **Ready**: The extraction code in `transformCompanyData()` will work once address data is available
✅ **Ready**: Frontend components display city when provided
⚠️ **Missing**: Address data in database

