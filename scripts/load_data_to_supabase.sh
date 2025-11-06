#!/usr/bin/env bash
set -euo pipefail

# Load CSV data into Supabase tables
# Requires SUPABASE_DB_URL environment variable

# Construct connection string if password is provided
if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  if [[ -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
    # Use Direct connection via pooler (IPv4 compatible) - port 5432
    # Format from Supabase Dashboard: postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-1-[REGION].pooler.supabase.com:5432/postgres
    SUPABASE_DB_URL="postgresql://postgres.clysgodrmowieximfaab:${SUPABASE_DB_PASSWORD}@aws-1-eu-north-1.pooler.supabase.com:5432/postgres"
    echo "Using Direct connection via pooler (IPv4 compatible) with password from SUPABASE_DB_PASSWORD"
  else
    echo "ERROR: SUPABASE_DB_URL or SUPABASE_DB_PASSWORD is not set." >&2
    echo "" >&2
    echo "Option 1: Set SUPABASE_DB_URL (full connection string):" >&2
    echo "  export SUPABASE_DB_URL=\"postgresql://postgres:[password]@db.clysgodrmowieximfaab.supabase.co:5432/postgres\"" >&2
    echo "" >&2
    echo "Option 2: Set SUPABASE_DB_PASSWORD (script will construct URL):" >&2
    echo "  export SUPABASE_DB_PASSWORD=\"your-password\"" >&2
    echo "  ./scripts/load_data_to_supabase.sh" >&2
    echo "" >&2
    echo "Get your password from:" >&2
    echo "  Supabase Dashboard → Project Settings → Database → Database password" >&2
    exit 1
  fi
fi

CSV_DIR="data/csv_export"

if [[ ! -d "$CSV_DIR" ]]; then
  echo "ERROR: CSV directory not found: $CSV_DIR" >&2
  echo "Run the ETL script first: python3 scripts/migrate_staging_to_new_schema.py ..." >&2
  exit 1
fi

echo "Loading data into Supabase..."
echo ""

# Use connection string directly
PSQL_OPTS="$SUPABASE_DB_URL"

# Load companies first (required for foreign keys)
echo "1/3 Loading companies..."
psql $PSQL_OPTS -c "\copy companies FROM '$CSV_DIR/companies.csv' WITH CSV HEADER" || {
  echo "ERROR: Failed to load companies.csv" >&2
  exit 1
}
echo "  ✓ Companies loaded"

# Load financials (depends on companies)
# Note: id column is excluded - PostgreSQL will generate UUIDs automatically
echo "2/3 Loading company_financials (this may take a few minutes for 959MB file)..."
psql $PSQL_OPTS -c "\copy company_financials(orgnr,company_id,year,period,period_start,period_end,currency,revenue_sek,profit_sek,ebitda_sek,equity_sek,debt_sek,employees,account_codes,raw_json,scraped_at,source_job_id) FROM '$CSV_DIR/company_financials.csv' WITH CSV HEADER" || {
  echo "ERROR: Failed to load company_financials.csv" >&2
  exit 1
}
echo "  ✓ Company financials loaded"

# Load metrics (depends on companies)
echo "3/3 Loading company_metrics..."
psql $PSQL_OPTS -c "\copy company_metrics FROM '$CSV_DIR/company_metrics.csv' WITH CSV HEADER" || {
  echo "ERROR: Failed to load company_metrics.csv" >&2
  exit 1
}
echo "  ✓ Company metrics loaded"

echo ""
echo "✅ All data loaded successfully!"
echo ""
echo "Next step: Run validation (Step 6)"

