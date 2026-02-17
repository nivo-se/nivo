# Raw Data Completeness Report

Based on SQL checks run against local Postgres (`localhost:5433/nivo`).  
**Principle:** Derived KPIs can be recomputed; missing raw scraped fields are expensive (require re-scraping).

---

## 1. Financial completeness (raw components)

### A) Multi-year coverage per company

```
median_years: 5
min_years:    1
max_years:    5
```

**Verdict:** ✅ Strong. Median 5 years of financial history per company.

### B) Latest-year raw field coverage

| Field | Companies with data | Coverage |
|-------|---------------------|----------|
| Revenue (si_sek or sdi_sek) | 13,635 | **100%** |
| EBITDA (ebitda_sek or ors_sek) | 13,635 | **100%** |
| Employees | 13,573 | **99.5%** |

**Verdict:** ✅ Raw financial components are sufficient to compute screening KPIs (revenue, margins, growth, employees).

---

## 2. Schema reference

### `financials` columns (raw statement components)

| Column | Type | Purpose |
|--------|------|---------|
| `orgnr`, `company_id` | text | Keys |
| `year`, `period` | int, text | Time |
| `si_sek` | numeric | Nettoomsättning (revenue, preferred) |
| `sdi_sek` | numeric | Revenue fallback |
| `dr_sek` | numeric | Profit |
| `resultat_e_avskrivningar_sek` | numeric | EBIT |
| `ebitda_sek` | numeric | EBITDA (preferred) |
| `ors_sek` | numeric | EBITDA fallback |
| `employees` | integer | Headcount |
| `account_codes` | jsonb | Raw account mappings |
| `currency`, `period_start`, `period_end` | — | Metadata |
| `scraped_at`, `created_at` | timestamptz | Audit |

**Computation mapping:**
- Revenue = `COALESCE(si_sek, sdi_sek)`
- EBITDA = `COALESCE(ebitda_sek, ors_sek)`
- EBIT = `resultat_e_avskrivningar_sek` (do not use RG from account_codes)

### `companies` columns (non-financial scrape)

| Column | Type | Coverage |
|--------|------|----------|
| `orgnr`, `company_id` | text | 100% |
| `company_name` | text | 100% |
| `company_type` | text | — |
| `homepage` | text | **0.01%** (2/13,610) ⚠️ |
| `email` | text | **0%** ⚠️ |
| `phone` | text | — |
| `address` | jsonb | 100% |
| `segment_names` | jsonb | 99.8% |
| `nace_codes`, `nace_categories` | jsonb | — |
| `foundation_year` | integer | 100% |
| `employees_latest` | integer | — |
| `accounts_last_year` | text | — |

---

## 3. Non-financial raw scrape gaps

| Field | Status | Impact |
|-------|--------|--------|
| **homepage** | 2 / 13,610 (0.01%) | High – needed for "has homepage" filter, digital presence, profile UX |
| **email** | 0 / 13,610 (0%) | Medium – contact, digital presence |
| **phone** | Unknown | Low–medium |
| **segment_names** | 99.8% | ✅ OK |
| **address** | 100% | ✅ OK |
| **foundation_year** | 100% | ✅ OK |

**Missing Allabolag-style fields (if desired later):**
- municipality / region (may be derivable from `address` JSONB)
- industry text / SNI label (may be in `segment_names` or `nace_categories`)
- group / parent / subsidiary
- description / about
- board / CEO names
- source URLs, scrape timestamps for companies (only `financials.scraped_at` exists)

---

## 4. Minimum viable company profile assessment

### A) Must-have raw (non-financial)

| Field | Have? | Action |
|-------|-------|--------|
| name, orgnr | ✅ | — |
| industry code/label | ✅ (segment_names, nace) | — |
| region/municipality | ❓ In address? | Inspect `address` structure |
| website/homepage | ❌ 0.01% | **Re-scrape or backfill** |
| description/about | ❌ | Add if needed |

### B) Must-have raw (financial)

| Field | Have? |
|-------|-------|
| revenue per year | ✅ 100% |
| EBITDA per year | ✅ 100% |
| employees | ✅ 99.5% |

### C) Derived (can compute)

All good: EBITDA margin, CAGR, quality score, staleness, segment membership.

---

## 5. Recommended actions

1. **Homepage backfill** – Top priority. Either:
   - Re-scrape Allabolag for `homepage` (and optionally `email`, `phone`), or
   - Add a backfill job that fetches homepage from another source (e.g. website lookup by company name/orgnr).

2. **Inspect `address`** – Sample a few rows to see if municipality/region is inside the JSONB. If yes, no schema change; if no, add `municipality` / `region` and backfill.

3. **Add `companies.scraped_at`** – For audit and staleness (optional). Financials have it; companies do not.

4. **Optional Allabolag fields** – If you need description, group/parent, board names, add columns or a `company_profile` JSONB and backfill via scraper.

---

## 6. Quick verification queries

```sql
-- Multi-year coverage
SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY c) AS median_years,
       min(c) AS min_years, max(c) AS max_years
FROM (SELECT orgnr, count(*) AS c FROM financials GROUP BY orgnr) t;

-- Latest-year completeness
WITH latest AS (SELECT orgnr, max(year) AS y FROM financials GROUP BY orgnr)
SELECT count(*) AS companies,
       sum(CASE WHEN COALESCE(f.si_sek, f.sdi_sek) IS NOT NULL THEN 1 ELSE 0 END) AS has_revenue,
       sum(CASE WHEN COALESCE(f.ebitda_sek, f.ors_sek) IS NOT NULL THEN 1 ELSE 0 END) AS has_ebitda,
       sum(CASE WHEN f.employees IS NOT NULL THEN 1 ELSE 0 END) AS has_employees
FROM latest l JOIN financials f ON f.orgnr = l.orgnr AND f.year = l.y;

-- Companies non-financial
SELECT count(*) AS total,
       sum(CASE WHEN homepage IS NOT NULL AND homepage != '' THEN 1 ELSE 0 END) AS has_homepage,
       sum(CASE WHEN segment_names IS NOT NULL THEN 1 ELSE 0 END) AS has_segment_names
FROM companies;
```
