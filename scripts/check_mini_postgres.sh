#!/usr/bin/env bash
# Run ON the Mac mini (or any host using docker-compose.yml) from the repo root.
# Checks: Docker services, Postgres inside container, host port 5433, API db ping.
#
# Usage: ./scripts/check_mini_postgres.sh
#        bash scripts/check_mini_postgres.sh
# Do not `source` this file — use bash so paths resolve (otherwise you may see "cd: too many arguments").
set -euo pipefail
SCRIPT_FILE="${BASH_SOURCE[0]:-$0}"
REPO_ROOT="$(cd "$(dirname "$SCRIPT_FILE")/.." && pwd)"
cd "$REPO_ROOT" || {
  echo "✗ cannot cd to repo root from ${SCRIPT_FILE}"
  exit 1
}

echo "=== Nivo — local Postgres check (Mac mini / docker-compose) ==="
echo ""

if ! command -v docker >/dev/null 2>&1; then
  echo "✗ docker not found"
  exit 1
fi

echo "1) Containers"
if docker ps --format '{{.Names}}\t{{.Status}}' 2>/dev/null | grep -E '^nivo-'; then
  :
else
  echo "✗ No nivo-* containers running. Start: docker compose up -d"
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q '^nivo-pg$'; then
  echo "✗ nivo-pg not running"
  exit 1
fi
echo "✓ nivo-pg is up"
echo ""

echo "2) Postgres inside container (ignores host .env password mismatches)"
if docker exec nivo-pg psql -U "${POSTGRES_USER:-nivo}" -d "${POSTGRES_DB:-nivo}" -c "SELECT 1 AS ok;" >/dev/null 2>&1; then
  echo "✓ psql inside container OK"
else
  echo "✗ psql inside container failed — check: docker logs nivo-pg"
  exit 1
fi
echo ""

echo "3) Host → Postgres on 127.0.0.1:5433 (migrations / scripts use this)"
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi
PGPASS="${POSTGRES_PASSWORD:-nivo}"
PGUSER="${POSTGRES_USER:-nivo}"
PGDB="${POSTGRES_DB:-nivo}"
export PGPASSWORD="$PGPASS"
if command -v psql >/dev/null 2>&1; then
  if psql -h 127.0.0.1 -p 5433 -U "$PGUSER" -d "$PGDB" -c "SELECT 1 AS host_ok;" >/dev/null 2>&1; then
    echo "✓ psql from host (127.0.0.1:5433) OK — password matches .env"
  else
    echo "✗ psql from host FAILED"
    echo "  Common cause: POSTGRES_PASSWORD in .env does not match the password Postgres was initialized with."
    echo "  Postgres only reads POSTGRES_PASSWORD on first volume create. If you changed .env later, either:"
    echo "    A) docker exec -it nivo-pg psql -U $PGUSER -d postgres -c \"ALTER USER $PGUSER PASSWORD 'YOUR_NEW_PASSWORD';\""
    echo "    B) Or reset data (destructive): docker compose down -v && docker compose up -d"
    exit 1
  fi
else
  echo "⚠ psql not installed — skip host check; install postgres client or use:"
  echo "  docker exec -it nivo-pg psql -U $PGUSER -d $PGDB -c 'SELECT 1;'"
fi
unset PGPASSWORD
echo ""

echo "4) HTTP db ping from host (FastAPI in Docker must reach Postgres)"
API="${API_URL:-http://127.0.0.1:8000}"
if docker ps --format '{{.Names}}' | grep -q '^nivo-api$'; then
  if command -v curl >/dev/null 2>&1; then
    code=$(curl -s -o /tmp/nivo_db_ping.json -w "%{http_code}" "$API/api/db/ping" || true)
    if [ "$code" = "200" ]; then
      echo "✓ GET $API/api/db/ping → 200 $(cat /tmp/nivo_db_ping.json)"
    else
      echo "✗ GET $API/api/db/ping → HTTP $code $(cat /tmp/nivo_db_ping.json 2>/dev/null || echo '')"
      echo "  Try: docker logs nivo-api --tail 80"
    fi
  else
    echo "⚠ curl missing — open $API/api/db/ping in a browser"
  fi
else
  echo "⚠ nivo-api not running — start stack: docker compose up -d"
fi

echo ""
echo "Done."
