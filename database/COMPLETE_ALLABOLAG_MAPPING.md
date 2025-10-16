# Complete Allabolag.se Financial Data Mapping

## Overview
This document provides a comprehensive mapping of all financial data available from allabolag.se, including both P&L and Balance Sheet items.

## Source Files
- `database/allabolag_financial_codes.json` - Complete financial codes mapping
- `database/allabolag_kpi_definitions.json` - KPI calculations and definitions
- `database/test_companyid_financials.json` - Real data example from allabolag.se

## Complete Financial Codes Mapping

### P&L (Profit & Loss) Items
| Code | Swedish | English | Type |
|------|---------|---------|------|
| **SDI** | Nettoomsättning | Revenue (Net Sales) | Income |
| **RG** | Rörelseresultat (EBIT) | EBIT (Earnings Before Interest and Taxes) | Profit |
| **DR** | Årets resultat | Net Profit (Profit for the Year) | Profit |
| **ORS** | Årets resultat (Duplicated) | Net Profit (Result for the Year) (Duplicated) | Profit |
| **RPE** | Resultat efter finansiella poster | Profit after Financial Items | Profit |
| **resultat_e_finansnetto** | Resultat efter finansnetto (PBT) | PBT (Profit Before Tax) | Profit |
| **resultat_e_avskrivningar** | Resultat efter avskrivningar | Profit after Depreciation | Profit |
| **BE** | Bruttoresultat | Gross Profit | Profit |
| **TR** | Totala rörelsekostnader | Total Operating Costs | Cost |
| **FSD** | Försäljnings- och distributionskostnader | Sales & Distribution Costs | Cost |
| **FI** | Finansiella intäkter | Financial Income | Income |
| **FK** | Finansiella kostnader | Financial Costs | Cost |
| **SKG** | Skatt på årets resultat | Tax on Profit for the Year | Tax |
| **SGE** | Skatt på årets resultat | Tax on Profit for the Year | Tax |
| **AWA** | Avskrivningar och nedskrivningar | Depreciation and Write-downs | Cost |

### Balance Sheet Items

#### Assets
| Code | Swedish | English | Type |
|------|---------|---------|------|
| **SV** | Summa tillgångar | Total Assets | Asset |
| **SOM** | Summa omsättningstillgångar | Total Current Assets | Asset |
| **SFA** | Summa finansiella anläggningstillgångar | Total Financial Fixed Assets | Asset |
| **SEK** | Likvida medel | Cash and Cash Equivalents | Asset |
| **GG** | Goodwill | Goodwill | Asset |
| **IAC** | Immateriella anläggningstillgångar | Intangible Assets | Asset |

#### Liabilities & Equity
| Code | Swedish | English | Type |
|------|---------|---------|------|
| **EK** | Eget kapital | Equity | Equity |
| **EKA** | Eget kapitalandel | Equity Ratio | Ratio |
| **SED** | Summa eget kapital och skulder | Total Equity and Liabilities | Liability |
| **KB** | Kortfristiga belopp | Short-term Liabilities | Liability |
| **KBP** | Kortfristiga belopp, personal | Short-term Liabilities, Staff | Liability |
| **LG** | Långfristiga skulder | Long-term Liabilities | Liability |

### Performance Ratios
| Code | Swedish | English | Type |
|------|---------|---------|------|
| **avk_eget_kapital** | Avkastning på eget kapital | Return on Equity | Ratio |
| **avk_totalt_kapital** | Avkastning på totalt kapital | Return on Total Capital | Ratio |

### Additional Items
| Code | Swedish | English | Type |
|------|---------|---------|------|
| **ANT** | Antal anställda | Number of Employees | Metric |
| **year** | År | Year | Metadata |
| **OrgNr** | Organisationsnummer | Company Registration Number | Metadata |

## Real Data Example (ÜBB AB - 5590472980)

### 2023 Financial Data
```json
{
  "SDI": "32348",     // Nettoomsättning: 32,348 SEK
  "DR": "1702",       // Årets resultat: 1,702 SEK
  "EK": "-50",        // Eget kapital: -50 SEK (negative equity)
  "EKA": "26.8",      // Eget kapitalandel: 26.8%
  "SV": "3223",       // Summa tillgångar: 3,223 SEK
  "SED": "9593",      // Summa eget kapital och skulder: 9,593 SEK
  "employees": "8"    // Antal anställda: 8
}
```

### 2022 Financial Data
```json
{
  "SDI": "20694",     // Nettoomsättning: 20,694 SEK
  "DR": "259",        // Årets resultat: 259 SEK
  "EK": "-24",        // Eget kapital: -24 SEK
  "EKA": "12.7",      // Eget kapitalandel: 12.7%
  "SV": "2631",       // Summa tillgångar: 2,631 SEK
  "SED": "6835"       // Summa eget kapital och skulder: 6,835 SEK
}
```

## Key Financial Metrics Available

### Revenue & Profitability
- **SDI**: Nettoomsättning (Revenue)
- **DR**: Årets resultat (Net Profit)
- **RG**: Rörelseresultat (EBIT)
- **BE**: Bruttoresultat (Gross Profit)

### Balance Sheet Strength
- **EK**: Eget kapital (Equity)
- **EKA**: Eget kapitalandel (Equity Ratio)
- **SV**: Summa tillgångar (Total Assets)
- **SED**: Summa eget kapital och skulder (Total Equity and Liabilities)

### Liquidity & Solvency
- **SEK**: Likvida medel (Cash and Cash Equivalents)
- **KB**: Kortfristiga belopp (Short-term Liabilities)
- **LG**: Långfristiga skulder (Long-term Liabilities)

### Performance Ratios
- **avk_eget_kapital**: Avkastning på eget kapital (Return on Equity)
- **avk_totalt_kapital**: Avkastning på totalt kapital (Return on Total Capital)

## Usage in AI Analysis

### Current Implementation
The AI analysis currently uses:
- SDI (Nettoomsättning) for revenue
- DR (Årets resultat) for profit
- ORS (Årets resultat - Duplicated) for alternative profit calculation
- EBIT_margin and NetProfit_margin (calculated ratios)

### Recommended Enhancements
To provide more comprehensive analysis, the AI should also consider:

1. **Balance Sheet Health**:
   - EK (Eget kapital) - Equity position
   - EKA (Eget kapitalandel) - Equity ratio
   - SV (Summa tillgångar) - Asset base
   - SEK (Likvida medel) - Cash position

2. **Leverage & Risk**:
   - KB (Kortfristiga belopp) - Short-term debt
   - LG (Långfristiga skulder) - Long-term debt
   - SED (Summa eget kapital och skulder) - Total liabilities

3. **Performance Metrics**:
   - avk_eget_kapital (Return on Equity)
   - avk_totalt_kapital (Return on Total Capital)

4. **Asset Quality**:
   - SOM (Summa omsättningstillgångar) - Current assets
   - SFA (Summa finansiella anläggningstillgångar) - Fixed assets
   - GG (Goodwill) - Intangible assets
   - IAC (Immateriella anläggningstillgångar) - Intangible assets

## Database Tables

### master_analytics
Contains aggregated/calculated metrics:
- SDI, DR, ORS (latest year)
- EBIT_margin, NetProfit_margin (calculated)
- Revenue_growth (calculated)
- employees, digital_presence

### company_accounts_by_id
Contains detailed annual financial data:
- All financial codes (SDI, DR, EK, SV, etc.)
- Year-by-year data
- Complete balance sheet and P&L items

## Next Steps

1. **Enhance AI Analysis**: Include balance sheet items in AI prompts
2. **Add Financial Ratios**: Calculate and use additional ratios
3. **Historical Analysis**: Use year-over-year data for trend analysis
4. **Risk Assessment**: Include leverage and liquidity metrics
5. **Industry Benchmarking**: Compare against industry averages
