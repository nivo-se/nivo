#!/usr/bin/env bash
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

  echo "postgresql://${user}:${password}@${host}:5433/${db}"
}

URL="${DATABASE_URL:-$(resolve_default_url)}"
echo "Applying Deep Research migration to: ${URL%%@*}@***"

if [ "${MIGRATION_USE_PYTHON:-0}" != "1" ] && command -v psql >/dev/null 2>&1; then
  psql "$URL" -f database/migrations/024_deep_research_persistence.sql -v ON_ERROR_STOP=1
else
  DATABASE_URL="$URL" python3 - <<'PY'
import os
from pathlib import Path
import psycopg2

sql = Path("database/migrations/024_deep_research_persistence.sql").read_text(encoding="utf-8")
conn = psycopg2.connect(os.environ["DATABASE_URL"], connect_timeout=10)
try:
    with conn:
        with conn.cursor() as cur:
            cur.execute(sql)
finally:
    conn.close()
PY
fi

echo "Deep Research migration applied."

