#!/usr/bin/env bash
# Run Postgres migrations. Uses DATABASE_URL from env, or default local Docker URL.
# Prerequisite: run bootstrap first: python scripts/bootstrap_postgres_schema.py
# Usage: ./scripts/run_postgres_migrations.sh
# WARNING: Confirm you are targeting the intended DB (dev vs prod) before running.
set -euo pipefail
cd "$(dirname "$0")/.."

# Load .env if present
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

URL="${DATABASE_URL:-postgresql://nivo:nivo@localhost:5433/nivo}"
# Show target without password: protocol and host (or "default")
if [ -n "${DATABASE_URL:-}" ]; then
  echo "Using DATABASE_URL from environment"
else
  echo "Using default URL (DATABASE_URL not set)"
fi
echo "Target: ${URL%%@*}@*** (run against this DB)"
echo ""

for f in database/migrations/013_add_coverage_view.sql \
         database/migrations/014_coverage_view_add_name_segments.sql \
         database/migrations/015_views_lists_labels.sql \
         database/migrations/016_extend_coverage_metrics_financial_cols.sql \
         database/migrations/017_coverage_metrics_add_is_stale.sql \
         database/migrations/018_create_analysis_tables.sql \
         database/migrations/019_coverage_metrics_add_municipality_contact_ai.sql \
         database/migrations/020_user_roles_allowed_users.sql; do
  if [ -f "$f" ]; then
    echo "Applying $(basename $f)..."
    psql "$URL" -f "$f" -v ON_ERROR_STOP=1
  fi
done

echo ""
echo "Migrations complete. First admin: insert manually after login (see docs/BOOTSTRAP_ROLES.md)."
