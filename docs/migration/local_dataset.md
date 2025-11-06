# Local Dataset Guide

The migration tooling generates a SQLite database and CSV exports for local analytics and dashboard development.

## Outputs
- **SQLite:** `data/new_schema_local.db`
  - Contains the new schema tables (`companies`, `company_financials`, `company_metrics`).
  - Ideal for notebooks, dbt seeds, or direct inspection with `sqlitebrowser`.

- **CSVs:** `data/csv_export/`
  - `companies.csv`
  - `company_financials.csv`
  - `company_metrics.csv`
  - These mirror the tables and can be loaded into Supabase via `psql \copy`.

## Regenerating
```bash
python3 scripts/create_staging_snapshot.py \
  --output scraper/allabolag-scraper/staging/staging_50_200_combined.db \
  scraper/allabolag-scraper/staging/staging_151e5a04-14f6-48db-843e-9dad22f371d0.db \
  scraper/allabolag-scraper/staging/staging_af674a42-4859-4e15-a641-9da834ddbb09.db

python3 scripts/migrate_staging_to_new_schema.py \
  --source scraper/allabolag-scraper/staging/staging_50_200_combined.db \
  --local-sqlite data/new_schema_local.db \
  --csv-dir data/csv_export
```

## Usage Tips
- Point Supabase client code to the SQLite file during development to avoid live DB latency:
  ```python
  import sqlite3
  conn = sqlite3.connect("data/new_schema_local.db")
  ```
- Keep CSV exports under version control if you need deterministic fixtures, otherwise regenerate as needed.
- When adding new derived metrics, update `scripts/migrate_staging_to_new_schema.py` so both local and Supabase datasets stay in sync.

