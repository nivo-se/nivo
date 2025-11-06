#!/usr/bin/env bash
set -euo pipefail

# Backup key Supabase tables prior to the migration.
# Requires the Supabase CLI (https://supabase.com/docs/guides/cli)
# and a logged-in project (run `supabase login` once).

PROJECT_ID="clysgodrmowieximfaab" # update if project id changes
OUTPUT_DIR="backups/$(date +%Y%m%d_%H%M%S)"
TABLES=(
  "master_analytics"
  "company_accounts_by_id"
  "company_kpis"
  "companies_enriched"
  "saved_company_lists"
)

mkdir -p "$OUTPUT_DIR"

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "⚠️  SUPABASE_DB_URL not set. Using linked project (requires: supabase link --project-ref $PROJECT_ID)"
fi

echo "Backing up Supabase tables to $OUTPUT_DIR"
for table in "${TABLES[@]}"; do
  echo "  • $table"
  if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
    # Use direct connection string if provided
    supabase db dump \
      --project-ref "$PROJECT_ID" \
      --schema public \
      --data-only \
      --table "$table" \
      --db-url "$SUPABASE_DB_URL" \
      > "$OUTPUT_DIR/${table}.sql" 2>&1 || echo "  ⚠️  Failed to backup $table (table may not exist)"
  else
    # Use linked project (requires: supabase link --project-ref $PROJECT_ID)
    supabase db dump \
      --project-ref "$PROJECT_ID" \
      --schema public \
      --data-only \
      --table "$table" \
      > "$OUTPUT_DIR/${table}.sql" 2>&1 || echo "  ⚠️  Failed to backup $table (table may not exist)"
  fi
done

echo "Backup complete. Files saved under $OUTPUT_DIR"

