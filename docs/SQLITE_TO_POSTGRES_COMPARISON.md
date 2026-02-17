# SQLite vs Postgres Schema Comparison

SQLite (`database/sqlite_schema.sql`) was the original source of truth. This doc compares it to the Postgres stack (bootstrap + migrations) to ensure parity and identify gaps.

---

## 1. Table-level comparison

| SQLite Table | Postgres equivalent | Status |
|--------------|---------------------|--------|
| `companies` | `public.companies` | ✅ Parity (Postgres adds JSONB, `nace_categories`) |
| `company_metrics` | `public.company_kpis` + view `company_metrics` | ⚠️ See column diff below |
| `acquisition_runs` | `public.acquisition_runs` (migration 018) | ✅ Parity |
| `company_research` | `public.company_research` (migration 018) | ✅ Parity |
| `company_analysis` | `public.company_analysis` (migration 018) | ✅ Parity |

---

## 2. Tables in Postgres but NOT in SQLite

| Postgres Table | Purpose | Source |
|----------------|---------|--------|
| `financials` | Raw annual financials (SI, SDI, EBITDA, etc.) | `local_postgres_schema.sql` |
| `company_kpis` | Aggregated metrics from financials | `local_postgres_schema.sql` |
| `ai_profiles` | AI-enriched company profiles | `local_postgres_schema.sql` |
| `ai_queries` | AI query history | `local_postgres_schema.sql` |
| `saved_company_lists` | Legacy saved lists (JSONB) | `local_postgres_schema.sql` |
| `enrichment_runs` | AI enrichment run metadata | `local_postgres_schema.sql`, 012 |
| `company_enrichment` | Per-company enrichment results | `local_postgres_schema.sql`, 012 |
| `saved_views` | Dynamic filter configs (Universe) | migration 015 |
| `saved_lists` | Static lists (Pipeline) | migration 015 |
| `saved_list_items` | List membership | migration 015 |
| `company_labels` | Human labels per company | migration 015 |
| `coverage_metrics` | VIEW: coverage + financial cols | migrations 013–017 |

---

## 3. Column-level differences

### 3.1 `companies`

| SQLite | Postgres | Notes |
|--------|----------|-------|
| `address TEXT` (JSON) | `address JSONB` | ✅ Better type |
| `segment_names TEXT` (JSON) | `segment_names JSONB` | ✅ Better type |
| `nace_codes TEXT` (JSON) | `nace_codes JSONB` | ✅ Better type |
| — | `nace_categories JSONB` | Postgres-only (derived from nace_codes) |
| `created_at TEXT` | `created_at TIMESTAMPTZ` | ✅ Better type |

### 3.2 `company_metrics` (SQLite) vs `company_kpis` (Postgres)

| SQLite `company_metrics` | Postgres `company_kpis` | Notes |
|--------------------------|------------------------|-------|
| `latest_revenue_sek` | `latest_revenue_sek` | ✅ |
| `latest_profit_sek` | `latest_profit_sek` | ✅ |
| `latest_ebitda_sek` | `latest_ebitda_sek` | ✅ |
| `revenue_cagr_3y` | `revenue_cagr_3y` | ✅ |
| `revenue_cagr_5y` | `revenue_cagr_5y` | ✅ |
| `avg_ebitda_margin` | `avg_ebitda_margin` | ✅ |
| `avg_net_margin` | `avg_net_margin` | ✅ |
| `equity_ratio_latest` | `equity_ratio_latest` | ✅ |
| `debt_to_equity_latest` | `debt_to_equity_latest` | ✅ |
| `revenue_per_employee` | `revenue_per_employee` | ✅ |
| `ebitda_per_employee` | `ebitda_per_employee` | ✅ |
| `digital_presence BOOLEAN` | — | ⚠️ **Missing in Postgres** |
| `company_size_bucket` | `company_size_bucket` | ✅ |
| `growth_bucket` | `growth_bucket` | ✅ |
| `profitability_bucket` | `profitability_bucket` | ✅ |
| `source_job_id TEXT` | — | ⚠️ **Missing in Postgres** |
| — | `latest_ebit_sek` | Postgres-only |
| — | `revenue_growth_yoy` | Postgres-only |
| — | `avg_ebit_margin` | Postgres-only |
| — | `updated_at` | Postgres-only |

### 3.3 Acquisition tables (`acquisition_runs`, `company_research`, `company_analysis`)

| SQLite | Postgres (018) | Notes |
|--------|----------------|-------|
| `id TEXT` (UUID string) | `id UUID` | ✅ Native UUID |
| `criteria TEXT` (JSON) | `criteria JSONB` | ✅ |
| `search_results TEXT` (JSON) | `search_results JSONB` | ✅ |
| `extracted_products TEXT` (JSON) | `extracted_products JSONB` | ✅ |
| `extracted_markets TEXT` (JSON) | `extracted_markets JSONB` | ✅ |
| `sales_channels TEXT` (JSON array) | `sales_channels TEXT[]` or JSONB | ✅ |
| `swot_* TEXT` (JSON array) | `swot_* JSONB` | ✅ Backend `_list()` handles both |
| `raw_analysis TEXT` (JSON) | `raw_analysis JSONB` | ✅ |
| `valid_digital_score` | Relaxed: `digital_score IS NULL OR 0–100` | ✅ Safer |

---

## 4. Gaps to address

### 4.1 SQLite → Postgres gaps (missing in Postgres)

1. **`company_kpis.digital_presence`** – SQLite had it; Postgres does not. Add if any code uses it.
2. **`company_kpis.source_job_id`** – SQLite had it for job tracking; Postgres does not. Add if needed.

### 4.2 Migration order (Postgres bootstrap + migrations)

```
1. bootstrap: local_postgres_schema.sql (companies, financials, company_kpis, ai_profiles, etc.)
2. bootstrap: 012_add_ai_enrichment_tables.sql (if not in schema)
3. run_postgres_migrations.sh:
   - 013_add_coverage_view.sql
   - 014_coverage_view_add_name_segments.sql
   - 015_views_lists_labels.sql
   - 016_extend_coverage_metrics_financial_cols.sql
   - 017_coverage_metrics_add_is_stale.sql
   - 018_create_analysis_tables.sql
```

### 4.3 Not in run_postgres_migrations.sh

These migrations exist but are **not** in the migration script (may target Supabase or older setup):

- `001_create_segmentation_system.sql`
- `002_deprecate_wrong_columns.sql`
- `003_update_company_metrics_from_account_codes.sql`
- `004_fix_tier_assignment.sql`
- `005_add_intelligence_tables.sql` (ai_ops schema)
- `006_add_vector_search_function.sql`
- `007_create_shortlist_tables.sql`
- `008_ai_sourcing_tables.sql`
- `009`–`011` (ai_profiles enhancements)
- `013_add_performance_indexes.sql`

If any of these are required for features you use, add them to the migration script or fold them into the bootstrap.

---

## 5. Summary

| Area | SQLite | Postgres | Parity |
|------|--------|----------|--------|
| Core companies | ✅ | ✅ | ✅ |
| Metrics/KPIs | `company_metrics` | `company_kpis` + view | ⚠️ 2 cols missing |
| Acquisition workflow | ✅ | ✅ (018) | ✅ |
| Financials (raw) | ❌ | `financials` | Postgres extends |
| AI profiles | ❌ | `ai_profiles` | Postgres extends |
| Universe (views, lists, labels) | ❌ | 015 | Postgres extends |

**Recommended next steps**

1. **Add `digital_presence` to `company_kpis`** – Used by `supabaseCompanyService`, `analyticsService`, `AIAnalytics`, `enhanced-server`. Create migration `019_add_digital_presence_to_company_kpis.sql`.
2. **Add `source_job_id`** (optional) – Only used by staging/migration scripts. Add if you run those against Postgres.
2. Run `./scripts/run_postgres_migrations.sh` to apply 018 and any other pending migrations.
3. Verify `GET /api/analysis/status` returns `analysis_schema_ready: true` after migrations.
