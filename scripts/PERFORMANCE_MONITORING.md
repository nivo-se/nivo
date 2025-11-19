# Query Performance Monitoring

## Overview

The `compare_query_performance.py` script compares query performance between JSONB (`company_financials.account_codes`) and normalized (`financial_accounts`) approaches.

## Usage

### Basic Usage

```bash
# Using connection URL
python3 scripts/compare_query_performance.py --db-url $SUPABASE_DB_URL

# Using individual connection parameters
python3 scripts/compare_query_performance.py \
  --db-host your-host.supabase.co \
  --db-port 5432 \
  --db-name postgres \
  --db-user postgres \
  --db-password your-password
```

### Options

- `--db-url`: Full PostgreSQL connection URL
- `--db-host`, `--db-port`, `--db-name`, `--db-user`, `--db-password`: Individual connection parameters
- `--no-warmup`: Skip database warmup queries
- `--verbose` / `-v`: Show EXPLAIN ANALYZE plans for each query

### Environment Variables

The script will automatically use `SUPABASE_DB_URL` or `DATABASE_URL` if set:

```bash
export SUPABASE_DB_URL="postgresql://postgres:password@host:5432/postgres"
python3 scripts/compare_query_performance.py
```

## Queries Tested

1. **Get EBIT for all companies in 2024**
   - Simple extraction query
   - Tests basic JSONB vs indexed column access

2. **Get multiple metrics for a company (pivot)**
   - Multi-field extraction
   - Tests JSONB multiple extractions vs normalized pivot

3. **Calculate average EBIT margin by industry**
   - Aggregation with joins
   - Tests complex analytical queries

4. **Find companies with high EBIT margins**
   - Filtering and calculations
   - Tests WHERE clause performance

5. **Year-over-year revenue growth**
   - Window functions and self-joins
   - Tests trend analysis queries

## Output

The script outputs:

- **Execution time** for each query (both approaches)
- **Rows returned** for verification
- **Speedup factor** (how much faster normalized is)
- **Time saved** per query
- **Summary table** with all results
- **Overall performance** summary

### Example Output

```
Query 1: Get EBIT for all companies in 2024
--------------------------------------------------------------------------------
JSONB Approach:
  Execution time: 245.32 ms
  Rows returned: 1000

Normalized Approach:
  Execution time: 18.45 ms
  Rows returned: 1000

Performance:
  ✅ Normalized is 13.30x FASTER

Time saved: 226.87 ms

================================================================================
SUMMARY
================================================================================
Query                                          JSONB          Normalized      Speedup        
--------------------------------------------------------------------------------
Get EBIT for all companies in 2024            245.32 ms      18.45 ms        13.30x         
...
--------------------------------------------------------------------------------
TOTAL                                          1.234 s        0.156 s         7.91x          

✅ Overall: Normalized table is 7.91x faster
   Time saved: 1.078 s
```

## Expected Results

Based on the normalization analysis:

- **Simple queries**: 10-20x faster
- **Complex analytical queries**: 20-100x faster
- **Aggregations**: 50-100x faster

## Troubleshooting

### Connection Issues

If you get connection errors:

1. Verify your connection string format:
   ```
   postgresql://user:password@host:port/database
   ```

2. Check firewall/network access to Supabase

3. Verify credentials are correct

### Query Errors

If queries fail:

1. Ensure `financial_accounts` table exists and has data
2. Check that `company_financials` has `account_codes` JSONB populated
3. Verify indexes are created (see `financial_accounts_schema.sql`)

### Performance Anomalies

If normalized queries are slower:

1. Check if indexes exist: `\d financial_accounts` in psql
2. Run `ANALYZE financial_accounts;` to update statistics
3. Check if table has sufficient data (needs >1000 rows for meaningful comparison)

## Integration with CI/CD

You can integrate this into your monitoring pipeline:

```bash
# Run performance test and save results
python3 scripts/compare_query_performance.py --db-url $SUPABASE_DB_URL > performance_results.txt

# Check if normalized is at least 5x faster
if grep -q "Overall: Normalized table is" performance_results.txt; then
  echo "✅ Performance check passed"
else
  echo "⚠️ Performance check failed"
  exit 1
fi
```

## Next Steps

After running the performance comparison:

1. **Document results** - Save output for future reference
2. **Identify bottlenecks** - Use `--verbose` to see EXPLAIN plans
3. **Optimize indexes** - Add indexes if needed based on query patterns
4. **Monitor over time** - Run periodically to track performance changes

