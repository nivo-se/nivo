# Allabolag.se JSON Endpoint Verification

## Current Implementation

Our scraper uses:
```
https://www.allabolag.se/_next/data/${buildId}/company/${companyId}.json?companyId=${companyId}&name=${companyName}&industry=${segmentName}&location=-
```

## Page URL Pattern

The bokslut (financial statement) page uses:
```
https://www.allabolag.se/bokslut/{slug}/{location}/{industry}/{companyId}
```

Example: `https://www.allabolag.se/bokslut/übb-ab/handen/bilar/2KGF8K4I5YCZW`

## JSON Data Structure

Both endpoints should return the same structure:
```json
{
  "pageProps": {
    "company": {
      "companyId": "2KGF8K4I5YCZW",
      "companyAccounts": [
        {
          "year": 2024,
          "period": "12",
          "periodStart": "2024-01-01",
          "periodEnd": "2024-12-31",
          "currency": "SEK",
          "accounts": [
            {
              "code": "EK",
              "name": "Eget kapital",
              "amount": "5666"
            },
            {
              "code": "SDI",
              "name": "Nettoomsättning",
              "amount": "44212"
            },
            // ... more accounts
          ]
        }
      ]
    }
  }
}
```

## Account Parsing Logic

### Current Implementation (allabolag.ts)

1. **Primary**: Extract by account code (`account.code`)
2. **Fallback for EK**: Check account name/label for "Eget kapital"

```typescript
for (const account of report.accounts) {
  // Primary: Use account code
  if (account.code && account.amount !== null) {
    accounts[account.code] = parseFloat(account.amount);
  }
  
  // Fallback: Check name/label for Eget kapital
  if (account.name || account.label) {
    const name = String(account.name || account.label || '').toLowerCase();
    if (name.includes('eget') && name.includes('kapital')) {
      accounts['EK'] = accounts['EK'] || parseFloat(account.amount);
    }
  }
}
```

## Verified Account Codes

Based on the mapping file (`database/allabolag_financial_codes.json`):

- **SDI**: Nettoomsättning (Revenue)
- **DR**: Årets resultat (Net Profit)
- **RG**: Rörelseresultat (EBIT)
- **ORS**: Årets resultat - Duplicated (EBITDA/Operating Result)
- **EK**: Eget kapital (Equity) ✅ **CONFIRMED IN MAPPING**
- **FK**: Finansiella kostnader (Financial Costs/Debt)

## Data Storage Format

Values are stored in **thousands of SEK (kSEK)**:
- Database value: `5666` = 5,666 thousands SEK = 5.666 million SEK
- Display format: `5 666 kkr`

## Next Steps

1. ✅ Verify our JSON endpoint matches the page structure
2. ✅ Confirm we're extracting EK by both code and name
3. ⚠️ Test with actual data to ensure EK values are populated

