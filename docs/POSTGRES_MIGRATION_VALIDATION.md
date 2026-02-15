# Postgres Migration Validation

## Row counts

| Table | SQLite | Postgres | Match |
|-------|--------|----------|-------|
| companies | 13610 | 13610 | ✅ |
| financials | 66130 | 66130 | ✅ |
| company_kpis | 13610 | 13610 | ✅ |
| ai_profiles | 78 | 78 | ✅ |

## Sample validation (20 random orgnrs)

| orgnr | sq_company | pg_company | sq_fin | pg_fin | sq_kpi | pg_kpi | Match |
|-------|------------|------------|--------|--------|--------|--------|-------|
| 5565877759 | 1 | 1 | 5 | 5 | 1 | 1 | ✅ |
| 5563082097 | 1 | 1 | 5 | 5 | 1 | 1 | ✅ |
| 5566916218 | 1 | 1 | 5 | 5 | 1 | 1 | ✅ |
| 5569645764 | 1 | 1 | 5 | 5 | 1 | 1 | ✅ |
| 5568447741 | 1 | 1 | 5 | 5 | 1 | 1 | ✅ |
| 5591825756 | 1 | 1 | 5 | 5 | 1 | 1 | ✅ |
| 5568189541 | 1 | 1 | 5 | 5 | 1 | 1 | ✅ |
| 5560728528 | 1 | 1 | 5 | 5 | 1 | 1 | ✅ |
| 5563972842 | 1 | 1 | 5 | 5 | 1 | 1 | ✅ |
| 5567682488 | 1 | 1 | 5 | 5 | 1 | 1 | ✅ |
| 5567747620 | 1 | 1 | 5 | 5 | 1 | 1 | ✅ |
| 5562820307 | 1 | 1 | 5 | 5 | 1 | 1 | ✅ |
| 5566422076 | 1 | 1 | 5 | 5 | 1 | 1 | ✅ |
| 5566816061 | 1 | 1 | 5 | 5 | 1 | 1 | ✅ |
| 5567064331 | 1 | 1 | 5 | 5 | 1 | 1 | ✅ |
| 5566378617 | 1 | 1 | 5 | 5 | 1 | 1 | ✅ |
| 5593733073 | 1 | 1 | 2 | 2 | 1 | 1 | ✅ |
| 5561357020 | 1 | 1 | 5 | 5 | 1 | 1 | ✅ |
| 5564806239 | 1 | 1 | 5 | 5 | 1 | 1 | ✅ |
| 5567807119 | 1 | 1 | 5 | 5 | 1 | 1 | ✅ |

## Missing tables (not in SQLite source)

- ai_queries: not present in nivo_optimized.db
- saved_company_lists: not present in nivo_optimized.db

## Rollback

To reset Postgres and re-migrate:
```bash
docker compose down -v
docker compose up -d
python3 scripts/bootstrap_postgres_schema.py
python3 scripts/migrate_sqlite_to_postgres.py --truncate
```