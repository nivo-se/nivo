#!/usr/bin/env bash
# Run Postgres migrations. Uses DATABASE_URL from env, or default local Docker URL.
# Prerequisite: run bootstrap first: python3 scripts/bootstrap_postgres_schema.py
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

resolve_default_url() {
  local host="${POSTGRES_HOST:-localhost}"
  local user="${POSTGRES_USER:-nivo}"
  local password="${POSTGRES_PASSWORD:-nivo}"
  local db="${POSTGRES_DB:-nivo}"
  local preferred_port="${POSTGRES_PORT:-}"

  if [ -n "$preferred_port" ]; then
    echo "postgresql://${user}:${password}@${host}:${preferred_port}/${db}"
    return
  fi

  # Try common local ports: Docker compose (5433) then native postgres (5432).
  if command -v pg_isready >/dev/null 2>&1; then
    if pg_isready -h "$host" -p 5433 -d "$db" -U "$user" >/dev/null 2>&1; then
      echo "postgresql://${user}:${password}@${host}:5433/${db}"
      return
    fi
    if pg_isready -h "$host" -p 5432 -d "$db" -U "$user" >/dev/null 2>&1; then
      echo "postgresql://${user}:${password}@${host}:5432/${db}"
      return
    fi
  fi

  # Fallback to Docker compose default.
  echo "postgresql://${user}:${password}@${host}:5433/${db}"
}

apply_sql_file() {
  local file="$1"
  if [ "${MIGRATION_USE_PYTHON:-0}" != "1" ] && command -v psql >/dev/null 2>&1; then
    psql "$URL" -f "$file" -v ON_ERROR_STOP=1
  else
    DATABASE_URL="$URL" SQL_FILE="$file" python3 - <<'PY'
import os
from pathlib import Path
import psycopg2

sql = Path(os.environ["SQL_FILE"]).read_text(encoding="utf-8")
conn = psycopg2.connect(os.environ["DATABASE_URL"], connect_timeout=10)
try:
    with conn:
        with conn.cursor() as cur:
            cur.execute(sql)
finally:
    conn.close()
PY
  fi
}

URL="${DATABASE_URL:-$(resolve_default_url)}"
# Show target without password: protocol and host (or "default")
if [ -n "${DATABASE_URL:-}" ]; then
  echo "Using DATABASE_URL from environment"
else
  echo "Using resolved default URL (DATABASE_URL not set)"
fi
echo "Target: ${URL%%@*}@*** (run against this DB)"
echo ""

# Note: 043_screening_features_v1.sql is superseded by 045 (full view + geo/registry columns).
# Do not list 043 here: applying it after 045 fails with "cannot drop columns from view".

for f in database/migrations/013_add_coverage_view.sql \
         database/migrations/014_coverage_view_add_name_segments.sql \
         database/migrations/015_views_lists_labels.sql \
         database/migrations/016_extend_coverage_metrics_financial_cols.sql \
         database/migrations/017_coverage_metrics_add_is_stale.sql \
         database/migrations/018_create_analysis_tables.sql \
         database/migrations/019_coverage_metrics_add_municipality_contact_ai.sql \
         database/migrations/020_user_roles_allowed_users.sql \
         database/migrations/023_user_ids_text_for_auth0.sql \
         database/migrations/024_user_profiles.sql \
         database/migrations/024_deep_research_persistence.sql \
         database/migrations/025_deep_research_run_node_states.sql \
         database/migrations/025_claim_verifications.sql \
         database/migrations/026_crm_foundation.sql \
         database/migrations/026_web_intelligence.sql \
         database/migrations/027_crm_tracking_page_section.sql \
         database/migrations/027_competitor_market_synthesis.sql \
         database/migrations/028_fix_timestamp_columns.sql \
         database/migrations/029_report_retrieval_config.sql \
         database/migrations/030_sector_multiple_reference.sql \
         database/migrations/031_deep_research_v2_schemas.sql \
         database/migrations/032_company_identity_and_prospects_crm_link.sql \
         database/migrations/033_screening_profiles.sql \
         database/migrations/036_saved_views_profile_link.sql \
         database/migrations/037_fix_company_metrics_view_score_columns.sql \
         database/migrations/038_screening_campaigns.sql \
         database/migrations/039_seed_preset_screening_profiles.sql \
         database/migrations/040_companies_nace_codes.sql \
         database/migrations/041_screening_candidates_exclusion.sql \
         database/migrations/042_exemplar_report_chunks.sql \
         database/migrations/044_screening_runs.sql \
         database/migrations/045_screening_features_v1_registry_geo.sql \
         database/migrations/046_screening_website_research_companies.sql \
         database/migrations/047_crm_email_threads_inbound.sql \
         database/migrations/049_rename_crm_email_provider_columns.sql; do
  if [ -f "$f" ]; then
    echo "Applying $(basename $f)..."
    apply_sql_file "$f"
  fi
done

echo ""
echo "Migrations complete. First admin: insert manually after login (see docs/BOOTSTRAP_ROLES.md)."
