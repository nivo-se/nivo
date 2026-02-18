# Financials Source of Truth

This document defines where historical P&L and Balance Sheet data lives and how the API exposes it. Use it to avoid mixing legacy tables with the canonical source.

## Source of truth

**Historical company financials:** the `financials` table in Postgres.

- **Schema:** `database/local_postgres_schema.sql`, `database/supabase_setup_from_scratch.sql`
- **Backend:** `GET /api/companies/{orgnr}/financials` in `backend/api/companies.py` reads only from `financials`
- **One row per (orgnr, year, period)** with core columns and optional `account_codes` JSONB

Any other table or view used for “company financial history” in the app should be considered legacy or staging unless explicitly documented here.

## Legacy / obsolete

- **`company_financials`** — If it exists in your DB, it is **legacy**. Do not use it for new features. Older migrations (e.g. 001–003) and some views reference it; the main financials API does **not**. Prefer `financials` only.
- **Staging tables** (e.g. `staging_financials`, scraper outputs) — Used only for ETL into `financials`. Not a source for the API.

## Period usage

- **Preferred period:** annual, represented as `12` or `%-12` (e.g. full year).
- **Broken fiscal year:** Companies with `period != 12` (e.g. 6, 9, or non‑standard) are still stored; the API ranks by period so annual is preferred when present, and returns one row per year (up to 7 years, year >= 2018).

## Core columns vs account_codes

### Core columns (always used)

These columns on `financials` are the basis for “basic” P&L history. The API always returns summary history from them when rows exist:

| Column | Meaning |
|--------|--------|
| `si_sek` | Net revenue (preferred) |
| `sdi_sek` | Total revenue (fallback) |
| `dr_sek` | Net profit (Årets resultat) |
| `resultat_e_avskrivningar_sek` | EBIT |
| `ebitda_sek` | EBITDA (preferred) |
| `ors_sek` | Operating result (EBITDA fallback) |

Revenue in the API is `COALESCE(si_sek, sdi_sek)`; EBITDA is `COALESCE(ebitda_sek, ors_sek)`.

### account_codes (optional enrichment)

- **Column:** `account_codes` JSONB on `financials`
- **Purpose:** Line‑level P&L and Balance Sheet (e.g. SDI, DR, EK, FK, SV, BE, ORS).
- **When present:** The API returns `full: { pnl: [...], balance: [...] }` with detailed line items.
- **When null/empty:** The API still returns `financials` (summary by year) and `count`; `full` may be partial or empty. Basic P&L history is still available from core columns.

Treat `account_codes` as optional enrichment. “Financial history” does not depend on it; full statement lines do.

## API response shape

- **Always:** `financials` (array of yearly summary records), `count` (length).
- **When `account_codes` is populated:** `full.pnl` and `full.balance` with line items and `years` per row.
- **When no rows in `financials`:** Fallback from `company_kpis` may produce one synthetic year; otherwise `financials: []`, `count: 0`, `full: null`.

The UI can show “Full statement available” when `full` is present and “partial” or summary‑only when it is not.

## Verification

- **Smoke test:** `./scripts/smoke_financials_endpoint.sh`
- **Coverage audit:** `python scripts/audit_financial_coverage.py`
- **Account code mapping:** `database/ACCOUNT_CODE_MAPPING_GUIDE.md`, `database/allabolag_account_code_mapping.json`
