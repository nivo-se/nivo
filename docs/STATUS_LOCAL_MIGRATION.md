# Local Postgres Migration – Status Report

**Date:** 2025-02-15  
**Goal:** Establish a clean path to run Postgres locally (Docker) as the development default, replacing SQLite while keeping existing modes working.

---

## 1. Repo Architecture Overview

| Directory | Purpose |
|-----------|---------|
| `backend/` | FastAPI API, workers, agentic pipeline, database services |
| `frontend/` | React/Vite app, dev server with local-db adapter |
| `scraper/` | Allabolag scraper, staging databases |
| `database/` | Schema definitions, migrations, setup scripts |
| `data/` | Runtime data: SQLite DBs, ChromaDB, rag context |
| `api/` | Standalone API layer (alternative to backend) |
| `scripts/` | Utility scripts for DB creation, validation, env verification |

---

## 2. Current Databases

| Database | Path | Purpose |
|----------|------|---------|
| **nivo_optimized.db** | `data/nivo_optimized.db` | Main app data: companies, financials, company_kpis (and optionally ai_profiles). Created by `scripts/create_optimized_db.py` and `scripts/create_kpi_table.py`. |
| **chroma_db** | `data/chroma_db/` | ChromaDB persistent store (vector DB for RAG). Uses `chromadb.PersistentClient(path=str(CHROMA_DB_DIR))` in `backend/utils/rag_service.py`. Contains `chroma.sqlite3` internally. |
| **Staging DBs** | `scraper/.../staging/*.db` | Raw scrape data; not used by backend at runtime. |

---

## 3. Database Switching Mechanism

- **Env var:** `DATABASE_SOURCE`
- **Location:** `backend/services/db_factory.py`
- **Values:** `local` (default), `supabase`, and after this migration: `postgres`
- **Logic:** `get_database_service()` returns a cached singleton based on `DATABASE_SOURCE`.

```python
# db_factory.py (current)
DatabaseSource = Literal["local", "supabase"]
# local  -> LocalDBService (SQLite)
# supabase -> SupabaseDBService (stub; raises NotImplementedError)
```

---

## 4. Where SQLite Is Used

### Core DB Service

| File | Role |
|------|------|
| `backend/services/local_db_service.py` | `LocalDBService` – SQLite implementation. Reads from `LOCAL_DB_PATH` or default `data/nivo_optimized.db`. |
| `backend/services/db_factory.py` | Returns `LocalDBService` when `DATABASE_SOURCE=local`. |

### Consumers of `get_database_service()` (all use the abstract interface)

| File | Usage |
|------|-------|
| `backend/api/ai_filter.py` | `db = get_database_service()` for AI filter queries |
| `backend/api/companies.py` | Company list, batch fetch; also `sqlite_master` check for `ai_profiles` (SQLite-only) |
| `backend/api/enrichment.py` | Enrichment endpoint |
| `backend/api/export.py` | Export to Excel/CSV |
| `backend/api/ai_reports.py` | AI report generation |
| `backend/api/chat.py` | Chat context queries |
| `backend/api/analysis.py` | Analysis workflow queries |
| `backend/workers/enrichment_worker.py` | Enrichment job |
| `backend/workers/lightweight_enrichment.py` | Lightweight enrichment |
| `backend/analysis/stage1_filter.py` | `FinancialFilter` – uses `company_metrics` in SQL (see schema note below) |
| `backend/analysis/workflow.py` | Acquisition workflow |

### Other SQLite References (not via `get_database_service()`)

| File | Role |
|------|------|
| `backend/utils/rag_service.py` | ChromaDB at `data/chroma_db` (separate from main app DB) |
| `backend/agentic_pipeline/config.py` | `db_path = Path("data/nivo_optimized.db")` for pipeline config |
| `frontend/server/local-db.ts` | Direct SQLite: `../../data/nivo_optimized.db` for local dev server |
| `frontend/server/enhanced-server.ts` | Same path for analytics |

### Scripts (direct SQLite)

- `scripts/create_optimized_db.py`, `scripts/create_kpi_table.py`, `scripts/validate_optimized_db.py`, `scripts/verify_workflow.py`, etc.

---

## 5. Where Supabase Is Used

### DB Service

| File | Role |
|------|------|
| `backend/services/supabase_db_service.py` | `SupabaseDBService` – stub, raises `NotImplementedError` on init |
| `backend/services/db_factory.py` | Returns it when `DATABASE_SOURCE=supabase` |

### Direct Supabase Client (bypasses `DatabaseService`)

| File | Role |
|------|-------|
| `backend/api/dependencies.py` | `get_supabase_client()` – used by saved_lists, companies (ai_profiles), filters |
| `backend/api/saved_lists.py` | Saved company lists |
| `backend/api/companies.py` | `ai_profiles` fetch (with local SQLite fallback) |
| `backend/api/filters.py` | `company_metrics` / analytics when Supabase is configured |
| `backend/workers/enrichment_worker.py` | Optional write to `ai_profiles` in Supabase |
| `backend/workers/lightweight_enrichment.py` | Same |
| `backend/agentic_pipeline/ai_analysis.py` | `SupabaseAnalysisWriter` for screening results |

---

## 6. Canonical Schema Candidates

| File | Tables | Notes |
|------|--------|-------|
| `database/supabase_setup_from_scratch.sql` | `companies`, `financials`, `company_kpis`, `ai_profiles`, `ai_queries`, `saved_company_lists` | Best match for Postgres bootstrap – aligns with `nivo_optimized.db` table names and LocalDBService queries. |
| `database/new_schema.sql` | `companies`, `company_financials`, `company_metrics` | Different naming (`company_financials` vs `financials`, `company_metrics` vs `company_kpis`). |
| `database/sqlite_schema.sql` | `companies`, `company_metrics`, `acquisition_runs`, etc. | SQLite-specific (acquisition workflow). |
| `database/migrations/*.sql` | Various | Incremental migrations; `008_ai_sourcing_tables.sql` adds `ai_profiles`, `ai_queries`. |

**Recommendation for bootstrap:** Use `database/supabase_setup_from_scratch.sql`.  
**Compatibility note:** `stage1_filter.py` and `workflow.py` reference `company_metrics`, while the optimized DB and supabase setup use `company_kpis`. A view `company_metrics AS SELECT * FROM company_kpis` can provide compatibility.

---

## 7. Backend Runtime

- **Framework:** FastAPI
- **Entrypoint:** `backend/api/main.py` via `uvicorn api.main:app`
- **Procfile:** `web: uvicorn api.main:app --host 0.0.0.0 --port $PORT`
- **Start:** From `backend/` directory: `uvicorn api.main:app --host 0.0.0.0 --port 8000` (or `$PORT` for Railway)
- **Env loading:** `.env` from project root via `load_dotenv(Path(__file__).parent.parent.parent / '.env')`

---

## 8. DatabaseService Interface

From `backend/services/database_service.py`:

- `fetch_companies(where_clause, params, limit, offset)` → `List[Dict]`
- `fetch_company_financials(org_number, limit_years)` → `List[Dict]`
- `fetch_company_metrics(org_number)` → `Optional[Dict]`
- `run_raw_query(sql, params)` → `List[Dict]`
- `close()` (optional)

**Param style:** LocalDBService uses `?`; Postgres uses `%s`. Implementations must handle placeholder translation.

**Dialect notes:**

- SQLite: `LIMIT -1 OFFSET ?` for offset-only; `sqlite_master` for table checks.
- Postgres: `LIMIT ALL` or no LIMIT; `information_schema.tables` for table checks.

---

## 9. Postgres Migration Additions (Step 1 + Step 2)

| Component | Status |
|-----------|--------|
| `docker-compose.yml` | Postgres 16, `nivo-pg`, **host port 5433** (avoids 5432 conflict) |
| `backend/services/postgres_db_service.py` | PostgresDBService |
| `backend/services/db_factory.py` | `postgres` branch |
| `scripts/bootstrap_postgres_schema.py` | Schema bootstrap |
| `scripts/check_postgres_connection.py` | Connectivity check |
| `scripts/migrate_sqlite_to_postgres.py` | SQLite → Postgres data migration |
| `scripts/validate_postgres_migration.py` | Row-count + sample validation |
| `database/local_postgres_schema.sql` | Local schema (companies, financials, company_kpis, etc.) |
| `docs/LOCAL_POSTGRES_SETUP.md` | Setup + runbook |
| `docs/LOCAL_POSTGRES_BOOTSTRAP.md` | Bootstrap instructions |
| `docs/POSTGRES_MIGRATION_VALIDATION.md` | Validation report template + rollback |

---

## 10. Acceptance Checks (Post-Migration)

- `docker compose up -d` – Postgres starts on host port 5433 (no 5432 conflict)
- `python3 scripts/bootstrap_postgres_schema.py` – Tables created
- `python3 scripts/migrate_sqlite_to_postgres.py --truncate` – Data imported, counts printed
- `python3 scripts/validate_postgres_migration.py` – Writes validation doc
- `DATABASE_SOURCE=postgres` – Backend runs, company list endpoint returns data

---

## 11. Ambiguities / Open Points

1. **company_metrics vs company_kpis:** Some code (stage1_filter, workflow, chat) uses `company_metrics`; optimized DB and supabase setup use `company_kpis`. Bootstrap adds `company_metrics` view.
2. **companies.py sqlite_master:** Table-existence check is SQLite-specific. With Postgres, that query fails; the exception is caught and the ai_profiles fallback path is skipped. Acceptable.
3. **Supabase direct client:** `get_supabase_client()` remains unchanged; no Postgres wiring for auth/saved_lists/ai_profiles yet.
