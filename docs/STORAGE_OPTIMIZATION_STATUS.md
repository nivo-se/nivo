# Storage Optimization Status

## Critical Situation
- **Supabase Free Plan Limit**: 500 MB
- **Current Database Size**: ~1,459 MB (291% over limit!)
- **Status**: Database is likely READ-ONLY due to exceeding limit

## Optimization Plan

### What We're Doing
1. **Delete Non-Essential Account Codes** (Step 1)
   - Keep only 9 essential codes: SDI, RG, DR, EBITDA, EK, FK, SV, ANT, EKA
   - Expected reduction: ~70-80% of financial_accounts (from 1,076 MB to ~200-300 MB)

2. **Archive Old Data** (Step 2)
   - Keep only last 5 years of financial data
   - Delete data older than 2019
   - Additional reduction: ~100-150 MB

3. **Vacuum** (Step 3)
   - Reclaim disk space from deleted rows
   - Final cleanup

### Expected Results
- **Before**: 1,459 MB
- **After Step 1**: ~700-800 MB
- **After Step 2**: ~500-600 MB
- **Target**: Under 500 MB ✅

## Script Running
- **Script**: `scripts/optimize_storage_aggressive.py`
- **Status**: Running (deleting in batches to avoid timeouts)
- **Log**: `optimization.log`

## Monitoring Progress

Check if optimization completed:
```bash
# Check if process is still running
ps aux | grep optimize_storage

# Check final database size
python3 -c "
import os
from dotenv import load_dotenv
import psycopg2
from urllib.parse import quote

load_dotenv()
password = os.getenv('SUPABASE_DB_PASSWORD')
encoded_user = quote('postgres.clysgodrmowieximfaab', safe='')
encoded_password = quote(password, safe='')
db_url = f'postgresql://{encoded_user}:{encoded_password}@aws-1-eu-north-1.pooler.supabase.com:5432/postgres'

conn = psycopg2.connect(db_url, connect_timeout=10)
cur = conn.cursor()
cur.execute('SELECT pg_size_pretty(pg_database_size(current_database())), pg_database_size(current_database())')
size_str, size_bytes = cur.fetchone()
print(f'Database size: {size_str} ({size_bytes/1024/1024:.0f} MB)')
conn.close()
"
```

## If Still Over Limit

If after optimization we're still over 500 MB, additional options:

1. **Reduce to 3 years** instead of 5
2. **Keep fewer account codes** (only SDI, RG, DR, EBITDA)
3. **Remove old backup tables** (master_analytics_backup_20251007, company_kpis)
4. **Consider upgrading** to Supabase Pro ($25/month for 8 GB)

## Important Notes

- ⚠️ **Data Loss**: Non-essential account codes and old data will be permanently deleted
- ✅ **Essential Data Preserved**: All UI metrics (Revenue, EBIT, Profit, etc.) will remain
- 📊 **Local Backup**: Full data still exists in `data/new_schema_local.db` (2.1 GB)
- 🔄 **Reversible**: Can re-import from local DB if needed (but will exceed limit again)

## Next Steps After Optimization

1. Verify database is under 500 MB
2. Test frontend to ensure all queries work
3. Monitor storage usage going forward
4. Consider data retention policy (auto-archive old data)

