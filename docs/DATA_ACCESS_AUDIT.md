# Data Access Audit – Step 3

**Date:** 2025-02-15  
**Goal:** Ensure all runtime code uses `DatabaseService` (db_factory); gate Supabase to `DATABASE_SOURCE=supabase` only.

---

## 1. Supabase client usage (runtime – backend/api)

| File | Function/Endpoint | What it uses | Recommended change |
|------|-------------------|--------------|--------------------|
| `backend/api/dependencies.py` | `get_supabase_client()` | Creates Supabase client if SUPABASE_URL+key set | **Gate:** Return `None` unless `DATABASE_SOURCE=supabase`. Clear error when supabase-only endpoint hit in other modes. |
| `backend/api/status.py` | `get_status()` | Supabase table `companies` for health check | Use `get_database_service().run_raw_query("SELECT orgnr FROM companies LIMIT 1")` for DB check. Supabase check only when `DATABASE_SOURCE=supabase`. |
| `backend/api/companies.py` | `get_company_intel` | Supabase `company_intel`, `intel_artifacts` | **Step 4:** Uses DatabaseService (ai_profiles + company_enrichment) when postgres/local. Supabase when DATABASE_SOURCE=supabase. |
| `backend/api/companies.py` | `get_ai_report` | Supabase `ai_reports` | **Step 4:** Uses DatabaseService (ai_profiles + company_enrichment) when postgres/local. Supabase when DATABASE_SOURCE=supabase. |
| `backend/api/companies.py` | `batch_fetch` | Supabase `ai_profiles` + db `run_raw_query` for local ai_profiles | Use `get_database_service().fetch_ai_profiles(orgnrs)` when available. Supabase path only if `DATABASE_SOURCE=supabase`. |
| `backend/api/saved_lists.py` | `get_saved_lists`, `save_list`, `delete_list` | Supabase `stage1_shortlists` | Supabase-only. Return empty/success stub when `DATABASE_SOURCE != supabase` (already degrades gracefully; ensure `get_supabase_client()` returns None). |
| `backend/api/ai_filter.py` | Logging to `ai_queries` | Supabase `ai_queries`.insert | Optional logging. Skip when supabase not available. |
| `backend/api/ai_reports.py` | `get_ai_report_data`, generate flow | Supabase `ai_profiles`, `ai_reports` | Supabase-only for ai_reports. Use DB for ai_profiles when not supabase. |
| `backend/api/enrichment.py` | `enrich_single` | Supabase `ai_profiles` (fetch/upsert) | Use `get_database_service().fetch_ai_profiles` / `upsert_ai_profile` when not supabase. |
| `backend/api/filters.py` | `get_filter_analytics`, `apply_filters` | Supabase `company_metrics`, `stage1_shortlists` | Use `get_database_service().run_raw_query` for company_metrics/company_kpis. Supabase path only when supabase. |
| `backend/api/shortlists.py` | List shortlists | Supabase `stage1_shortlists` | Supabase-only. Return empty when not supabase. |
| `backend/workers/enrichment_worker.py` | `enrich_companies_batch` | Supabase `ai_profiles` (fetch/upsert) | Use `get_database_service().fetch_ai_profiles`, `upsert_ai_profile` when not supabase. |
| `backend/workers/lightweight_enrichment.py` | Same pattern | Supabase `ai_profiles` | Same as enrichment_worker. |

---

## 2. Direct sqlite3 usage (outside LocalDBService)

| File | Purpose | Audit |
|------|---------|-------|
| `backend/services/local_db_service.py` | LocalDBService implementation | ✅ Correct – this is the service. |
| `scripts/*.py` (migrate, bootstrap, validate, create_*, etc.) | One-off scripts | ✅ OK – scripts, not runtime. |
| `populate_metrics.py` | Root script | ✅ OK – utility script. |
| `api/*.py` | Standalone API layer (Vercel?) | ⚠️ Out of scope for backend; separate deployment. |

**No runtime backend/api code uses direct sqlite3.**

---

## 3. Direct psycopg2 usage (outside PostgresDBService)

| File | Purpose | Audit |
|------|---------|-------|
| `backend/services/postgres_db_service.py` | PostgresDBService implementation | ✅ Correct. |
| `scripts/*.py` (bootstrap, migrate, check_postgres, validate) | One-off scripts | ✅ OK – scripts. |
| `scripts/optimize_supabase_storage.py` | Supabase management | ✅ OK – admin script. |

**No runtime backend/api code uses direct psycopg2.**

---

## 4. DatabaseService interface gaps

| Method | Used by | Status |
|--------|---------|--------|
| `fetch_ai_profiles(orgnrs: List[str])` | companies.batch_fetch, enrichment, lightweight | **Add** – returns list of dicts keyed by orgnr or list. |
| `upsert_ai_profile(profile: dict)` | enrichment_worker, lightweight_enrichment | **Add** – inserts/updates ai_profiles row. |
| `table_exists(table_name: str)` | companies (sqlite_master check), enrichment | **Add** – dialect-agnostic. |

---

## 5. Supabase-only tables (no local/postgres equivalent yet)

- `company_intel`, `intel_artifacts` – company intelligence
- `ai_reports` – AI-generated reports
- `stage1_shortlists` – saved filter shortlists

**Action:** When `DATABASE_SOURCE != supabase`, endpoints that require these return 503 with message:  
`"Feature requires DATABASE_SOURCE=supabase"`.

---

## 6. Implementation order (Step 3 – done)

1. ✅ Gate `get_supabase_client()` in dependencies.py – returns None unless DATABASE_SOURCE=supabase
2. ✅ Add `fetch_ai_profiles`, `upsert_ai_profile`, `table_exists` to DatabaseService + LocalDBService + PostgresDBService
3. ✅ Update companies.batch_fetch to use db.fetch_ai_profiles
4. ✅ Update enrichment_worker and lightweight_enrichment to use db for ai_profiles when not supabase
5. ✅ Update status.py to use get_database_service for DB health; Supabase check only when supabase mode
6. ✅ Add 503 for supabase-only endpoints (company_intel, ai_report) when not supabase
