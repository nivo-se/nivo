# Database Workflow Guide: Local Development → Supabase Production


## Recommended Approach: **Local-First Development**

The best workflow for building new features is to **design and iterate locally**, then sync to Supabase when ready. This gives you:

✅ **Fast iteration** - No network latency, instant schema changes  
✅ **Safe experimentation** - Break things locally without affecting production  
✅ **Easy rollback** - Just delete the local DB and recreate  
✅ **Cost efficiency** - No Supabase API calls during development  
✅ **Offline development** - Work without internet connection  

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT WORKFLOW                      │
└─────────────────────────────────────────────────────────────┘

1. DESIGN PHASE (Local SQLite)
   ┌──────────────────────┐
   │  new_schema_local.db │  ← Design schema here
   │  (SQLite)            │     - Fast iteration
   │                      │     - Easy to modify
   │                      │     - Test queries locally
   └──────────┬───────────┘
              │
              │ When schema is stable
              ▼
2. MIGRATION PHASE
   ┌──────────────────────┐
   │  Schema SQL files    │  ← Generate migration SQL
   │  (database/*.sql)    │     - Convert SQLite → PostgreSQL
   │                      │     - Handle type differences
   └──────────┬───────────┘
              │
              │ Apply to Supabase
              ▼
3. PRODUCTION PHASE (Supabase)
   ┌──────────────────────┐
   │  Supabase PostgreSQL │  ← Production database
   │                      │     - Used by deployed app
   │                      │     - User-facing features
   └──────────────────────┘
```

## Workflow Steps

### Step 1: Design Schema Locally

1. **Create/modify schema in SQLite:**
   ```bash
   sqlite3 data/new_schema_local.db
   ```
   
2. **Test your changes:**
   ```sql
   -- Add new table/column/index
   CREATE TABLE new_feature_table (...);
   
   -- Test queries
   SELECT * FROM new_feature_table;
   ```

3. **Update your application code** to use the new schema locally

4. **Test thoroughly** with local data

### Step 2: Generate Migration SQL

When your schema is stable, generate PostgreSQL-compatible SQL:

1. **Export schema from SQLite:**
   ```bash
   sqlite3 data/new_schema_local.db .schema > database/migrations/new_feature.sql
   ```

2. **Convert SQLite syntax to PostgreSQL:**
   - `TEXT` → `TEXT` (same)
   - `INTEGER` → `INTEGER` (same)
   - `REAL` → `NUMERIC` (for financial data)
   - `datetime('now')` → `now()` or `CURRENT_TIMESTAMP`
   - Remove SQLite-specific features (if any)

3. **Add PostgreSQL-specific features:**
   - `UUID` types with `uuid-ossp` extension
   - `JSONB` instead of `TEXT` for JSON
   - `TIMESTAMPTZ` for timestamps
   - Proper foreign key constraints

### Step 3: Apply to Supabase

1. **Backup Supabase first:**
   ```bash
   ./scripts/backup_supabase_tables.sh
   ```

2. **Apply schema changes:**
   ```bash
   # Option A: Via Supabase Dashboard SQL Editor
   # Copy-paste your migration SQL
   
   # Option B: Via psql
   psql "$SUPABASE_DB_URL" -f database/migrations/new_feature.sql
   ```

3. **Sync data** (if needed):
   ```bash
   # If you have new data in local DB
   python3 scripts/sync_local_to_supabase.py --tables new_feature_table
   ```

### Step 4: Verify Sync

```bash
# Compare row counts
python3 scripts/verify_db_sync.py
```

## When to Use Each Database

### Use **Local SQLite** (`data/new_schema_local.db`) for:
- ✅ Schema design and iteration
- ✅ Feature development
- ✅ Testing queries and performance
- ✅ Data analysis and exploration
- ✅ Development server (reads)

### Use **Supabase** for:
- ✅ Production deployment
- ✅ User-facing features
- ✅ Write operations (analysis results, saved lists)
- ✅ Multi-user access
- ✅ Real-time features

## Current Setup

Based on your codebase:

- **Reads**: Local SQLite (`frontend/server/local-db.ts`)
- **Writes**: Supabase (analysis results, saved lists, valuations)
- **Migration**: Scripts exist in `scripts/` directory

## Best Practices

### 1. Keep Schemas in Sync

After making changes locally, always update:
- `database/new_schema.sql` (PostgreSQL version)
- `scripts/migrate_staging_to_new_schema.py` (SQLite schema in Python)

### 2. Use Migration Scripts

Create numbered migration files:
```
database/migrations/
  ├── 001_initial_schema.sql
  ├── 002_add_financial_accounts.sql
  ├── 003_add_new_feature.sql
  └── ...
```

### 3. Test Locally First

Always test schema changes locally before applying to Supabase:
1. Modify local DB
2. Test application code
3. Verify queries work
4. Then migrate to Supabase

### 4. Document Changes

Update `DATABASE_SCHEMA_DIAGRAM.md` when adding new tables/columns.

## Quick Reference Commands

```bash
# Connect to local DB
sqlite3 data/new_schema_local.db

# Export schema
sqlite3 data/new_schema_local.db .schema > schema.sql

# Backup Supabase
./scripts/backup_supabase_tables.sh

# Apply migration to Supabase
psql "$SUPABASE_DB_URL" -f database/migrations/new_feature.sql

# Sync data from local to Supabase
python3 scripts/sync_local_to_supabase.py

# Verify sync
python3 scripts/verify_db_sync.py
```

## Answer to Your Question

**Q: Should I have both local and Supabase identical, or is one online enough?**

**A: Use both, but for different purposes:**

1. **Local SQLite** = Your development sandbox
   - Design schema here
   - Iterate quickly
   - Test features
   - **Don't need to keep 100% identical** during development

2. **Supabase** = Your production database
   - Deployed features
   - User data
   - **Keep schema in sync** when features are ready

**Workflow:**
- Develop locally → Test locally → Migrate to Supabase → Deploy

You don't need them identical during development, but you should sync when:
- Feature is complete and tested
- Ready for production
- Need to share with team

## Troubleshooting

### Schema Drift

If local and Supabase get out of sync:
```bash
# 1. Export current Supabase schema
pg_dump "$SUPABASE_DB_URL" --schema-only > supabase_schema.sql

# 2. Compare with local
diff supabase_schema.sql database/new_schema.sql

# 3. Create migration to sync
```

### Data Sync Issues

If data differs between local and Supabase:
```bash
# Regenerate local DB from staging
python3 scripts/migrate_staging_to_new_schema.py \
  --source staging.db \
  --local-sqlite data/new_schema_local.db

# Or sync specific tables
python3 scripts/sync_local_to_supabase.py --tables companies,company_metrics
```

