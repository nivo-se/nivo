#!/usr/bin/env bash
# Run Postgres migrations against local Docker or DATABASE_URL
# Prerequisite: run bootstrap first: python scripts/bootstrap_postgres_schema.py
# Usage: ./scripts/run_postgres_migrations.sh
set -e
cd "$(dirname "$0")/.."

# Load .env if present
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

URL="${DATABASE_URL:-postgresql://nivo:nivo@localhost:5433/nivo}"

echo "Running migrations against Postgres"
echo "  URL: ${URL%%@*}@***"
echo ""

for f in database/migrations/013_add_coverage_view.sql \
         database/migrations/014_coverage_view_add_name_segments.sql \
         database/migrations/015_views_lists_labels.sql \
         database/migrations/016_extend_coverage_metrics_financial_cols.sql \
         database/migrations/017_coverage_metrics_add_is_stale.sql \
         database/migrations/018_create_analysis_tables.sql \
         database/migrations/019_coverage_metrics_add_municipality_contact_ai.sql; do
  if [ -f "$f" ]; then
    echo "Applying $(basename $f)..."
    psql "$URL" -f "$f" -v ON_ERROR_STOP=1
  fi
done

echo ""
echo "Migrations complete."
