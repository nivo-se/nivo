# Nivo Data Mapping Guide

## Overview
This document defines the unified data structure and field mappings for all financial data in the Nivo system. All APIs and services must use this consistent mapping.

## Primary Data Source: `master_analytics` Table

The `master_analytics` table is the single source of truth for all company financial data.

### Core Company Fields
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `OrgNr` | TEXT | Organization number (primary key) | "5562642362" |
| `name` | TEXT | Company name | "Segers Fabriker Aktiebolag" |
| `segment_name` | TEXT | Industry segment | "Kläder" |
| `city` | TEXT | Company city | "Borås" |
| `employees` | INTEGER | Number of employees | 23 |

### Financial Data Fields
| Field | Type | Description | Example | Notes |
|-------|------|-------------|---------|-------|
| `revenue` | INTEGER | Revenue in SEK | 112342 | Primary revenue field |
| `SDI` | INTEGER | Revenue (alternative field) | 112342 | Same as revenue |
| `profit` | INTEGER | Net profit in SEK | 6657 | Primary profit field |
| `DR` | INTEGER | Net profit (alternative field) | 6657 | Same as profit |
| `ORS` | INTEGER | Operating result | 8518 | Operating income |
| `Revenue_growth` | DECIMAL | Revenue growth rate | -0.0049688670805913 | -0.5% |
| `EBIT_margin` | DECIMAL | EBIT margin | 0.0592565558740275 | 5.9% |
| `NetProfit_margin` | DECIMAL | Net profit margin | 0.0758220434031796 | 7.6% |

### Additional Fields
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `digital_presence` | BOOLEAN | Has website/digital presence | true |
| `incorporation_date` | TIMESTAMP | Company incorporation date | "1985-10-04T00:00:00" |
| `email` | TEXT | Company email | "info@segers.se" |
| `homepage` | TEXT | Company website | "https://www.segers.se" |
| `address` | TEXT | Company address | "Företagsgatan 30" |

## API Data Mapping

### `/api/companies` Endpoint
Returns complete company data from `master_analytics`:
```json
{
  "OrgNr": "5562642362",
  "name": "Segers Fabriker Aktiebolag",
  "revenue": 112342,
  "employees": 23,
  "EBIT_margin": 0.0592565558740275,
  "Revenue_growth": -0.0049688670805913
}
```

### `/api/ai-analysis` Endpoint
Uses `master_analytics` data for analysis:
- Revenue: `SDI` or `revenue` field
- Profit: `DR` or `profit` field
- Employees: `employees` field
- Growth: `Revenue_growth` field
- Margin: `EBIT_margin` field

### AI Analysis Output Format
```json
{
  "orgnr": "5562642362",
  "companyName": "Segers Fabriker Aktiebolag",
  "screeningScore": 80,
  "riskFlag": "Low",
  "briefSummary": "Segers Fabriker Aktiebolag (5562642362) - Kläder. Omsättning: 112 342 TSEK, Anställda: 23, Tillväxt: -0.5 %, EBIT-marginal: 5.9 %. Screening-poäng: 80/100."
}
```

## Data Consistency Rules

### 1. Single Source of Truth
- **Primary Table**: `master_analytics`
- **No Mock Data**: All APIs must use real database data
- **No Fallbacks**: If data doesn't exist in `master_analytics`, return error

### 2. Field Mapping Priority
For revenue data:
1. `SDI` (primary)
2. `revenue` (fallback)

For profit data:
1. `DR` (primary)
2. `profit` (fallback)

### 3. Data Validation
- All financial fields must be validated using `safeNumber()` function
- Null/undefined values should be handled gracefully
- Currency formatting: Use `formatCurrency()` for display

### 4. API Response Format
All APIs must return data in this consistent format:
```typescript
interface CompanyData {
  OrgNr: string
  name: string
  revenue: number
  profit: number
  employees: number
  EBIT_margin: number
  Revenue_growth: number
  segment_name: string
  city: string
}
```

## Implementation Guidelines

### Enhanced Server (`frontend/server/enhanced-server.ts`)
- Use `master_analytics` table for all company data
- No fallback to `company_accounts_by_id` or other tables
- Consistent field mapping in `generateCompanyProfile()`

### Frontend Services
- `supabaseDataService.ts`: Use `master_analytics` table
- `savedListsService.ts`: No mock data, use real database data
- All components: Use consistent field names

### Database Schema
- Keep `master_analytics` as the primary table
- Archive or remove unused tables like `company_accounts_by_id`
- Ensure all financial data is in `master_analytics`

## Testing Checklist

- [ ] `/api/companies` returns data from `master_analytics`
- [ ] `/api/ai-analysis` uses same data source
- [ ] No mock data in any service
- [ ] Consistent field names across all APIs
- [ ] Proper error handling for missing data
- [ ] Currency formatting works correctly
- [ ] All financial calculations use real data

## Migration Notes

### Completed
- ✅ Enhanced server uses `master_analytics` table
- ✅ Removed mock data from `savedListsService.ts`
- ✅ Fixed field mapping inconsistencies
- ✅ Verified data consistency across APIs

### Future Improvements
- [ ] Archive unused tables
- [ ] Add data validation rules
- [ ] Implement data quality checks
- [ ] Add comprehensive error handling
