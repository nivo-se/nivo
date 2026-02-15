# Dashboard Update Analysis - New Database Schema

## Current State

### Tables Still Being Used (OLD)
1. **`master_analytics`** - Used in 9+ files
   - Should be replaced with: `companies` + `company_metrics`
   
2. **`company_accounts_by_id`** - Used for historical financial data
   - Should be replaced with: `company_financials`

3. **`company_kpis`** - Used in some places
   - Should be replaced with: `company_metrics`

### New Schema Available
- ✅ `companies` (13,609 rows) - Company master data
- ✅ `company_financials` (66,614 rows) - Historical financial records with `raw_json`
- ✅ `company_metrics` (13,609 rows) - Calculated metrics

## Key Components That Need Updates

### 1. Company Detail Modal (`EnhancedCompanySearch.tsx`)
**Location**: `frontend/src/components/EnhancedCompanySearch.tsx` (lines 802-1078)

**Current Behavior**:
- Shows financial charts using `historicalData` from `company_accounts_by_id`
- Fields used: `SDI` (revenue), `RG` (EBIT), `DR` (profit)
- Queries: `company_accounts_by_id` table (OLD)

**Required Updates**:
- Query `company_financials` instead of `company_accounts_by_id`
- Map fields:
  - `SDI` → `revenue_sek` (from `company_financials`)
  - `RG` → `ebitda_sek` (or extract from `account_codes` JSONB)
  - `DR` → `profit_sek` (from `company_financials`)
- Use `account_codes` JSONB for additional account codes if needed
- **Raw JSON**: Currently NOT used, but available in `raw_json` field

### 2. Data Service (`supabaseDataService.ts`)
**Location**: `frontend/src/lib/supabaseDataService.ts`

**Current Queries**:
- `master_analytics` table (lines 168, 312, 364)
- `company_accounts_by_id` table (lines 226, 228)

**Required Updates**:
```typescript
// OLD:
.from('master_analytics')
.select('OrgNr, name, SDI, DR, ORS, Revenue_growth...')

// NEW:
.from('companies')
.select('orgnr, company_name, company_id...')
// Join with company_metrics for calculated fields
// Join with company_financials for historical data
```

### 3. Company Profile Data Fetching
**Current**: `getCompany()` method queries `master_analytics`
**Required**: Query `companies` + `company_metrics` + `company_financials`

## Field Mapping

### Old → New Schema Mapping

| Old Table | Old Field | New Table | New Field | Notes |
|-----------|-----------|-----------|-----------|-------|
| `master_analytics` | `OrgNr` | `companies` | `orgnr` | Primary key |
| `master_analytics` | `name` | `companies` | `company_name` | |
| `master_analytics` | `SDI` | `company_financials` | `revenue_sek` | Latest year |
| `master_analytics` | `DR` | `company_financials` | `profit_sek` | Latest year |
| `master_analytics` | `ORS` | `company_financials` | `ebitda_sek` | Latest year |
| `master_analytics` | `Revenue_growth` | `company_metrics` | `revenue_cagr_3y` | |
| `master_analytics` | `EBIT_margin` | `company_metrics` | `avg_ebitda_margin` | |
| `master_analytics` | `NetProfit_margin` | `company_metrics` | `avg_net_margin` | |
| `company_accounts_by_id` | `SDI` | `company_financials` | `revenue_sek` | Historical |
| `company_accounts_by_id` | `RG` | `company_financials` | `account_codes->RG` | From JSONB |
| `company_accounts_by_id` | `DR` | `company_financials` | `profit_sek` | Historical |

## Raw JSON Usage

### Current Status
- ❌ **NOT currently used** in frontend components
- ✅ **Available** in `company_financials.raw_json` (JSONB)
- ✅ **Contains**: `company.companyAccounts` array with all account codes

### Potential Usage
The `raw_json` field contains:
```json
{
  "company": {
    "companyAccounts": [
      {
        "year": 2024,
        "period": "12",
        "accounts": [
          {"code": "SDI", "amount": "44212"},
          {"code": "RG", "amount": "1234"},
          // ... 50+ account codes
        ]
      }
    ]
  }
}
```

**To use raw JSON for financial overview**:
1. Query `company_financials.raw_json` for a company
2. Parse JSONB: `raw_json->'company'->'companyAccounts'`
3. Extract account codes as needed
4. This gives access to ALL 50+ account codes, not just the extracted ones

## Files That Need Updates

### High Priority (Dashboard Functionality)
1. `frontend/src/lib/supabaseDataService.ts` - Main data service
2. `frontend/src/components/EnhancedCompanySearch.tsx` - Company detail modal
3. `frontend/src/lib/analyticsService.ts` - Dashboard analytics

### Medium Priority (Server-side)
4. `frontend/server/enhanced-server.ts` - Valuation API
5. `frontend/server/ai-analysis-enhanced.ts` - AI analysis
6. `api/ai-analysis.ts` - AI analysis API

### Lower Priority
7. `frontend/src/pages/WorkingDashboard.tsx`
8. `frontend/src/components/AIAnalysis.tsx`
9. `frontend/server/data-enrichment.ts`

## Recommended Update Strategy

### Phase 1: Update Data Service Layer
1. Create new methods in `supabaseDataService.ts`:
   - `getCompaniesNew()` - Query `companies` + `company_metrics`
   - `getCompanyFinancials()` - Query `company_financials` for historical data
   - `getCompanyProfile()` - Combined query for company detail page

### Phase 2: Update Company Detail Modal
1. Update `EnhancedCompanySearch.tsx`:
   - Use new data service methods
   - Map `revenue_sek`, `profit_sek`, `ebitda_sek` to chart data
   - Optionally add link to Allabolag using `company_id`

### Phase 3: Update Other Components
1. Update analytics service
2. Update server-side APIs
3. Test all dashboard links

## Testing Checklist

- [ ] Company search works with new schema
- [ ] Company detail modal shows financial charts
- [ ] Historical data (4 years) displays correctly
- [ ] All dashboard links work
- [ ] Financial overview uses correct fields
- [ ] Raw JSON can be accessed if needed (optional)
- [ ] Company ID links to Allabolag work

## Notes

- **Raw JSON**: Currently not needed for basic financial overview (we have extracted fields)
- **Raw JSON**: Available if you need additional account codes beyond the extracted ones
- **Company ID**: Now stored in `companies.company_id` for linking to Allabolag
- **Historical Data**: Available in `company_financials` table (66,614 records)

