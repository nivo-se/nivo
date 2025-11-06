# Revenue Unit Verification

## Objective
Confirm whether `revenue_sek` values stored in the staging database are expressed in SEK or in thousands of SEK.

## Evidence Collected

### 1. Scraper Parameter Conversion
The segmentation endpoint multiplies the user-provided revenue filter (in MSEK) by 1,000 before calling Allabolag.se:

```32:42:scraper/allabolag-scraper/src/app/api/segment/start/route.ts
    // Allabolag.se expects values in thousands of SEK
    const scraperParams = {
      ...params,
      revenueFrom: params.revenueFrom * 1000,
      revenueTo: params.revenueTo * 1000,
      profitFrom: params.profitFrom !== undefined ? params.profitFrom * 1000 : -500,
      profitTo: params.profitTo ? params.profitTo * 1000 : 100000000,
    };
```

This indicates that Allabolag expects values in **thousands of SEK**, so a 50 MSEK filter is transmitted as `50,000`.

### 2. Values Stored in Staging Database
Sample companies at the bottom of the range show `revenue_sek` slightly above 50,000, and top-end values are just below 200,000:

```sql
SELECT orgnr, company_name, revenue_sek
FROM staging_companies
WHERE job_id = 'de2cea99-ce04-4fce-bc15-695c672e4c22'
ORDER BY revenue_sek LIMIT 5;
```

| OrgNr      | Revenue SEK |
|------------|-------------|
| 5568511942 | 50,004      |
| 5569434896 | 50,008      |
| ...        | ...         |

Interpreted as thousands, these values equal 50.004–50.008 MSEK, matching the requested filter.

### 3. Raw JSON from Allabolag.se
The raw API response stores revenue as plain integers (e.g., `60694`). The normalization helper converts strings to numbers without further scaling:

```336:360:scraper/allabolag-scraper/src/lib/allabolag.ts
export function normalizeCompany(c: any) {
  return {
    ...
    revenueSek: toInt(c.revenue),
    profitSek: toInt(c.profit),
    ...
  };
}

function toInt(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(/\s+/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
}
```

Since `c.revenue` arrives from Allabolag.se already in thousands of SEK, the stored value remains in thousands.

## Conclusion

- `revenue_sek` values in staging are stored in **thousands of SEK**.
- The filter inputs (50–200 MSEK) correspond exactly to stored values of 50,000–200,000.
- Any downstream processing should convert `revenue_sek` to MSEK by dividing by 1,000 when reporting revenue in millions.

## Recommended Actions

1. Document this unit convention in data processing pipelines and dashboards.
2. Ensure the second batch (and all calculations) consistently divide by 1,000 when expressing revenue in MSEK.
3. Add unit annotations in the redesigned Supabase schema to avoid confusion.

