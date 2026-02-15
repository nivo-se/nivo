# Allabolag.se Data Source Analysis

## Summary

**Yes, you can build a page similar to Allabolag's bokslut page using the same dataset.**

Allabolag.se uses a **single JSON endpoint** that contains all the data needed for the financial statement page.

## Single Data Source

### Endpoint
```
https://www.allabolag.se/_next/data/${buildId}/company/${companyId}.json
```

### Response Structure
```json
{
  "pageProps": {
    "company": {
      // Financial Data
      "companyAccounts": [
        {
          "year": 2024,
          "period": "2024-12",
          "periodStart": "2024-01-01",
          "periodEnd": "2024-12-31",
          "currency": "SEK",
          "accounts": [
            {
              "code": "SDI",
              "amount": "44212"
            },
            {
              "code": "EK",
              "amount": "5666"
            },
            // ... 50+ more account codes
          ]
        }
        // ... multiple years
      ],
      
      // Company Metadata
      "name": "ÜBB AB",
      "orgnr": "5590472980",
      "companyId": "2KGF8K4I5YCZW",
      "phone": "...",
      "email": "...",
      "homePage": "...",
      "employees": "...",
      "location": {...},
      "mainOffice": {...},
      "visitorAddress": {...},
      "industries": [...],
      "domicile": {...},
      "directors": [...],
      "signatory": [...],
      "foundationDate": "...",
      "businessUnitType": "...",
      // ... more metadata
    }
  }
}
```

## Data Available in Single Response

### 1. Financial Data (P&L + Balance Sheet)
- **P&L Items**: SDI (Revenue), DR (Net Profit), RG (EBIT), ORS (EBITDA), BE (Gross Profit), TR (Operating Costs)
- **Balance Sheet Items**: EK (Equity), FK (Debt), SV (Total Assets), SED (Total Equity & Liabilities), SEK (Cash)
- **53+ Account Codes**: All financial metrics in one response
- **Multiple Years**: 5+ years of financial data per company

### 2. Company Metadata
- Basic Info: Name, Orgnr, Company ID
- Contact: Phone, Email, Homepage
- Location: Main Office, Visitor Address, Domicile
- People: Directors, Signatory
- Business: Industries, Business Unit Type, Foundation Date
- Employees: Employee count

### 3. Calculated Ratios
- `avk_eget_kapital` (Return on Equity)
- `avk_totalt_kapital` (Return on Total Capital)
- Available in the accounts array

## What You Can Build

With this single endpoint, you can build a page that displays:

1. **Resultaträkning (P&L Statement)**
   - Nettoomsättning (Revenue)
   - Rörelsekostnader (Operating Costs)
   - Rörelseresultat (EBIT)
   - Finansiella intäkter/kostnader (Financial Income/Costs)
   - Resultat efter finansnetto (Profit After Financial Items)
   - Skatt (Tax)
   - Årets resultat (Net Profit)

2. **Balansräkning (Balance Sheet)**
   - Anläggningstillgångar (Fixed Assets)
   - Omsättningstillgångar (Current Assets)
   - Summa tillgångar (Total Assets)
   - Eget kapital (Equity)
   - Skulder (Liabilities)
   - Summa eget kapital och skulder (Total Equity & Liabilities)

3. **Company Information**
   - Contact details
   - Location
   - Directors
   - Industry classification

## Our Current Implementation

We already extract all this data:

1. **Financial Data**: Stored in `staging_financials` table
   - All account codes (SDI, DR, EK, FK, etc.)
   - Year-by-year data
   - Period information

2. **Company Metadata**: Stored in `raw_data` JSON field
   - Additional company data extracted
   - Available in `additionalCompanyData` field

3. **Data Structure**: Matches Allabolag's structure exactly

## Conclusion

✅ **Single Data Source**: All data comes from one JSON endpoint
✅ **Complete Data**: P&L + Balance Sheet + Company metadata in one response
✅ **Can Build Similar Page**: All necessary data is available
✅ **Our Implementation Matches**: We extract the same data structure

You can build an identical bokslut page using the same data structure we're already scraping and storing.

