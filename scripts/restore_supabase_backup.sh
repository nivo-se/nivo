#!/usr/bin/env bash
set -euo pipefail

# Restore Supabase tables from the SQL files produced by backup_supabase_tables.sh
# Usage: ./scripts/restore_supabase_backup.sh backups/20241105_123000

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <backup-directory>" >&2
  exit 1
fi

BACKUP_DIR="$1"
if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "Backup directory not found: $BACKUP_DIR" >&2
  exit 1
fi

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "SUPABASE_DB_URL is not set. Export your database URL before running this script." >&2
  exit 1
fi

echo "Restoring Supabase tables from $BACKUP_DIR"
for file in "$BACKUP_DIR"/*.sql; do
  [[ -e "$file" ]] || continue
  table_name=$(basename "$file" .sql)
  echo "  • $table_name"
  psql "$SUPABASE_DB_URL" < "$file"
done

echo "Restore complete."

