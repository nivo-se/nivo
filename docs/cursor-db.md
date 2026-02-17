We are resetting Supabase Postgres tonight. The old DB is obsolete; local Postgres schema is the source of truth.

Goal: produce a repeatable, low-risk path to recreate the Supabase schema and connect Railway + Vercel to it.

Tasks:
1) Add docs/DB_RESET_SUPABASE.md with step-by-step commands to:
   - export schema-only from local Postgres (pg_dump flags)
   - apply to Supabase (psql command)
   - install required extensions
   - verify schema (list tables + quick counts)
2) Add a backend endpoint GET /api/admin/db-check (auth-protected) that returns:
   - tables_present: boolean for key tables (companies/universe, lists, list_items, analysis_runs)
   - companies_count
   - sample_fields_ok: revenue_latest, segment_names, employees_latest exist
   - db_host (redacted) and db_type
3) Extend frontend /new/admin “Run smoke tests” to call db-check first and display PASS/FAIL with details.
4) Ensure backend in production uses DATABASE_URL and does not fallback to SQLite.
   - Add a clear startup log: “DB=postgres” or “DB=sqlite” with host redacted.
Return:
- files changed
- exact commands to run locally for pg_dump and psql (using placeholders)
- exact Railway env vars needed
- exact Vercel env vars needed