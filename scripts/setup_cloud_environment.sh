#!/usr/bin/env bash
# Provision cloud dev environment for Nivo backend + migrations.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== Nivo Cloud Environment Setup ==="

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

install_postgres_tooling() {
  if command -v psql >/dev/null 2>&1 && command -v pg_ctlcluster >/dev/null 2>&1; then
    echo "PostgreSQL client/server tooling already installed."
    return
  fi
  echo "Installing PostgreSQL client/server tooling..."
  sudo apt-get update
  sudo apt-get install -y postgresql postgresql-client postgresql-contrib
}

install_python_dependencies() {
  echo "Installing backend Python dependencies..."
  python3 -m pip install --upgrade pip
  python3 -m pip install -r backend/requirements.txt
}

start_local_postgres() {
  if ! command -v pg_lsclusters >/dev/null 2>&1; then
    echo "pg_lsclusters not found; skipping local postgres cluster startup."
    return
  fi

  local cluster_info
  cluster_info="$(pg_lsclusters --no-header | awk 'NR==1 {print $1" "$2" "$4}')"
  if [ -z "$cluster_info" ]; then
    echo "No local PostgreSQL cluster found; skipping startup."
    return
  fi

  local version name status
  version="$(echo "$cluster_info" | awk '{print $1}')"
  name="$(echo "$cluster_info" | awk '{print $2}')"
  status="$(echo "$cluster_info" | awk '{print $3}')"

  if [ "$status" != "online" ]; then
    echo "Starting PostgreSQL cluster ${version}/${name}..."
    sudo pg_ctlcluster "$version" "$name" start || true
  else
    echo "PostgreSQL cluster ${version}/${name} already running."
  fi
}

ensure_local_db_and_user() {
  local host="${POSTGRES_HOST:-localhost}"
  local user="${POSTGRES_USER:-nivo}"
  local password="${POSTGRES_PASSWORD:-nivo}"
  local db="${POSTGRES_DB:-nivo}"

  # Only auto-create local DB/user when host is local.
  if [ "$host" != "localhost" ] && [ "$host" != "127.0.0.1" ]; then
    echo "POSTGRES_HOST is remote (${host}); skipping local role/database creation."
    return
  fi

  echo "Ensuring local role/database exist (${user}/${db})..."
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${user}') THEN EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', '${user}', '${password}'); END IF; END \$\$;"
  if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${db}'" | grep -q 1; then
    sudo -u postgres createdb -O "${user}" "${db}"
  fi
}

resolve_database_url() {
  if [ -n "${DATABASE_URL:-}" ]; then
    echo "$DATABASE_URL"
    return
  fi

  local host="${POSTGRES_HOST:-localhost}"
  local user="${POSTGRES_USER:-nivo}"
  local password="${POSTGRES_PASSWORD:-nivo}"
  local db="${POSTGRES_DB:-nivo}"
  local port="${POSTGRES_PORT:-}"

  if [ -n "$port" ]; then
    echo "postgresql://${user}:${password}@${host}:${port}/${db}"
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

  echo "postgresql://${user}:${password}@${host}:5432/${db}"
}

export_postgres_vars_from_url() {
  local url="$1"
  eval "$(python3 - "$url" <<'PY'
import sys
from urllib.parse import urlparse

u = urlparse(sys.argv[1])
print(f'export POSTGRES_HOST="{u.hostname or "localhost"}"')
print(f'export POSTGRES_PORT="{u.port or 5432}"')
print(f'export POSTGRES_USER="{u.username or "nivo"}"')
print(f'export POSTGRES_PASSWORD="{u.password or "nivo"}"')
print(f'export POSTGRES_DB="{(u.path or "/nivo").lstrip("/") or "nivo"}"')
print('export DATABASE_SOURCE="postgres"')
PY
)"
}

needs_bootstrap() {
  local db_url="$1"
  DATABASE_URL="$db_url" python3 - <<'PY'
import os
import psycopg2

conn = psycopg2.connect(os.environ["DATABASE_URL"], connect_timeout=10)
try:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT EXISTS (
              SELECT 1
              FROM information_schema.tables
              WHERE table_schema='public'
                AND table_name IN ('companies', 'financials', 'company_kpis')
            )
            """
        )
        exists = bool(cur.fetchone()[0])
        print("0" if exists else "1")
finally:
    conn.close()
PY
}

install_postgres_tooling
install_python_dependencies
start_local_postgres
ensure_local_db_and_user

DB_URL="$(resolve_database_url)"
echo "Using DB target: ${DB_URL%%@*}@***"
export_postgres_vars_from_url "$DB_URL"

if [ "$(needs_bootstrap "$DB_URL")" = "1" ]; then
  echo "Bootstrapping base Postgres schema..."
  python3 scripts/bootstrap_postgres_schema.py
else
  echo "Base schema already present; skipping bootstrap."
fi

echo "Running core migrations..."
DATABASE_URL="$DB_URL" ./scripts/run_postgres_migrations.sh

echo "Running Deep Research migration..."
DATABASE_URL="$DB_URL" ./scripts/run_deep_research_migrations.sh

echo "Cloud environment setup complete."

