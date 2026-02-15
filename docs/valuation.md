# Valuation Experience

## Overview
The valuation module delivers structured multi-company valuation coverage combining Supabase financial data, deterministic multiples, and OpenAI generated commentary. The experience is composed of:

- A backend route (`POST /api/valuation`) that loads historical financials, computes valuation metrics and orchestrates AI insights.
- A reusable TypeScript toolkit (`frontend/src/lib/valuation.ts`) for normalising annual accounts, calculating valuation ratios and preparing export datasets.
- A protected frontend page (`/valuation`) that lets analysts search and select companies, compare KPI tables, explore interactive charts and download exports in CSV, Excel and PDF formats.

## Data Flow
1. **Selection:** The client sends a POST request with an array of organisation numbers (`companyIds`) and an optional `mode` (`default` or `deep`).
2. **Supabase aggregation:** The server pulls master rows from `master_analytics` and the latest four annual statements from `company_accounts_by_id` for each organisation number.
3. **Normalisation & metrics:** `computeValuationMetrics` transforms the raw account rows into deterministic metrics:
   - Enterprise Value (EV) with fallbacks for market capitalisation.
   - EV/EBIT, EV/EBITDA, P/E, P/B, P/S and equity ratio.
   - Three-year revenue CAGR and latest revenue / EBIT / EBITDA snapshots.
4. **AI commentary:** A batch prompt is sent to `gpt-4.1-mini` to generate peer comparison commentary. When `mode=deep`, the top targets receive an additional `gpt-4o` refinement.
5. **Persistence:** Results are saved to `valuation_sessions` so that each run is stored for later retrieval.
6. **Response:** The API returns structured metrics, AI commentary, pre-computed chart series and an export dataset consumed by the frontend.

## API Contract
### Request
```http
POST /api/valuation
Content-Type: application/json
{
  "companyIds": ["5560001234", "5598765432"],
  "mode": "deep"
}
```

### Response
```json
{
  "success": true,
  "data": {
    "valuationSessionId": "f8ad7f1c-...",
    "mode": "deep",
    "generatedAt": "2025-10-20T22:15:03.234Z",
    "overallSummary": "...",
    "companies": [
      {
        "orgnr": "5560001234",
        "name": "Bolag AB",
        "industry": "Tillverkning",
        "employees": 120,
        "metrics": {
          "enterpriseValue": 124000000,
          "evToEbit": 8.4,
          "evToEbitda": 6.7,
          "peRatio": 13.1,
          "pbRatio": 2.1,
          "psRatio": 1.4,
          "equityRatio": 0.42,
          "revenueCagr3Y": 0.07,
          "revenueLatest": 87000000,
          "ebitLatest": 14800000,
          "ebitdaLatest": 18500000,
          "netIncomeLatest": 9500000
        },
        "chartSeries": [
          { "year": 2021, "revenue": 72000000, "ebit": 11200000, "ebitda": 13500000, "evToEbitda": 6.3 },
          { "year": 2022, "revenue": 80000000, "ebit": 13000000, "ebitda": 16000000, "evToEbitda": 6.5 },
          { "year": 2023, "revenue": 87000000, "ebit": 14800000, "ebitda": 18500000, "evToEbitda": 6.7 }
        ],
        "aiInsights": {
          "summary": "Stark tillväxt och stabil marginalprofil...",
          "valuationView": "Indicativt företagsvärde omkring 124.0 MSEK",
          "valuationRange": "105000000–143000000 SEK",
          "riskFlags": ["Låg soliditet"],
          "opportunities": ["Skalbar exportaffär"],
          "mode": "deep"
        }
      }
    ],
    "exportDataset": {
      "generatedAt": "2025-10-20T22:15:03+00:00",
      "rows": [
        {
          "orgnr": "5560001234",
          "company": "Bolag AB",
          "industry": "Tillverkning",
          "year": 2023,
          "enterpriseValue": 124000000,
          "evToEbit": 8.4,
          "evToEbitda": 6.7,
          "peRatio": 13.1,
          "pbRatio": 2.1,
          "psRatio": 1.4,
          "equityRatio": 0.42,
          "revenue": 87000000,
          "ebit": 14800000,
          "ebitda": 18500000,
          "netIncome": 9500000
        }
      ]
    }
  }
}
```

### Persistence Schema
Create the `valuation_sessions` table in Supabase to store run metadata and payloads.

```sql
create table if not exists public.valuation_sessions (
  id uuid primary key default gen_random_uuid(),
  company_ids text[] not null,
  mode text not null check (mode in ('default', 'deep')),
  valuation_payload jsonb not null,
  overall_summary text,
  export_dataset jsonb not null,
  generated_at timestamptz default now()
);

create index if not exists valuation_sessions_generated_idx
  on public.valuation_sessions (generated_at desc);
```

## Frontend Experience
- The `/valuation` page is protected (requires authentication).
- Analysts can search companies via `/api/companies?search=<query>` and add them to the comparison list.
- Minimum selection enforced: **3 companies**.
- Valuation results include:
  - **Summary card** with AI commentary and export actions.
  - **Metrics table** sorted by enterprise value.
  - **Charts** (line for revenue/EBIT/EBITDA and bar chart for EV/EBITDA).
  - **AI insight cards** with risks, opportunities and valuation ranges.
- Exports:
  - **CSV** generated from `buildValuationExportDataset`.
  - **Excel**: HTML Spreadsheet (XLS) for compatibility without external libraries.
  - **PDF**: lightweight PDF stream containing key metrics and AI summary.

## Environment Variables
Ensure the following keys are configured:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for database access.
- `OPENAI_API_KEY` for GPT-4.1-mini and GPT-4o calls.

## Error Handling & Fallbacks
- Missing financial data results in null-safe outputs (`–` in UI).
- If OpenAI is not configured or fails, deterministic fallback commentary is generated.
- Export helpers escape text and produce deterministic output even when metrics are missing.

## Extensibility
- `frontend/src/lib/valuation.ts` centralises metric calculations and export helpers so other services (e.g. bulk reporting, deal pipeline) can reuse the same logic.
- AI prompts are encapsulated in `generateValuationInsights`, making it easy to adjust models or prompt templates.
- `valuation_sessions` stores full payloads, enabling future retrieval endpoints or audit tooling.
