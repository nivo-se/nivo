# Supabase Size Reduction Guide

## Current Situation
- Database size: **189 MB** (198,438,035 bytes)
- Expected after cleanup: 10-50 MB (only Auth tables)
- **Still 140-180 MB too large**

## Possible Causes

### 1. Database Bloat (Most Likely)
PostgreSQL doesn't immediately free space after deleting tables. The space is marked as "free" but the file doesn't shrink until you run `VACUUM FULL`.

**Solution**: Run `VACUUM FULL` (included in cleanup script)

### 2. Auth Tables with Lots of Data
Auth tables might contain:
- Many user accounts
- Old sessions (not cleaned up)
- Refresh tokens
- Audit logs

**Solution**: Clean up old Auth data if possible

### 3. Storage Schema (Supabase File Storage)
The `storage` schema might contain:
- Uploaded files
- Images
- Documents

**Solution**: Check and clean up storage if needed

### 4. Extensions
Extensions like `vector` (pgvector) might take space even if tables are deleted.

**Solution**: Drop unused extensions

## Steps to Reduce Size

### Step 1: Identify What's Taking Space
Run `supabase_quick_check.sql` to see:
- Which schemas are largest
- Which tables are largest
- Auth schema breakdown
- Storage schema size

### Step 2: Run VACUUM FULL
This is the most important step:

```sql
VACUUM FULL;
```

**Warning**: This locks tables and can take time. Run during low-traffic period.

### Step 3: Clean Up Auth Data (If Needed)
If Auth tables are large, you might have old sessions:

```sql
-- Check session count
SELECT COUNT(*) FROM auth.sessions;

-- Check user count
SELECT COUNT(*) FROM auth.users;

-- Clean up old sessions (older than 30 days)
DELETE FROM auth.sessions 
WHERE updated_at < NOW() - INTERVAL '30 days';
```

### Step 4: Check Storage Schema
If storage schema is large:

```sql
-- List all buckets
SELECT * FROM storage.buckets;

-- Check objects size
SELECT 
    bucket_id,
    COUNT(*) AS file_count,
    SUM(metadata->>'size')::bigint AS total_size_bytes
FROM storage.objects
GROUP BY bucket_id;
```

### Step 5: Drop Unused Extensions
If you're not using pgvector anymore:

```sql
-- Check if vector extension exists
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Drop if not needed
DROP EXTENSION IF EXISTS vector CASCADE;
```

## Expected Results

### After VACUUM FULL
- **Before**: 189 MB
- **After**: 10-50 MB (depending on Auth data)

### If Still Large After VACUUM
1. Check Auth tables - might have lots of users/sessions
2. Check Storage schema - might have uploaded files
3. Check for other schemas we didn't account for

## Quick Commands

```sql
-- 1. See what's taking space
-- Run supabase_quick_check.sql

-- 2. Reclaim space
VACUUM FULL;

-- 3. Check size after
SELECT pg_size_pretty(pg_database_size(current_database())) AS database_size;
```

