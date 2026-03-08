#!/usr/bin/env bash
# Full pull, migrations, and backend restart. Postgres must be in Docker.
# Usage: ./scripts/pull_and_restart_backend.sh
# Run from repo root or scripts/.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

PORT="${PORT:-8000}"
export PORT
export DATABASE_SOURCE=postgres

echo "=== 1. Postgres (Docker) ==="
docker compose -f docker-compose.postgres.yml up -d
echo "Waiting for Postgres..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  if docker compose -f docker-compose.postgres.yml exec -T postgres pg_isready -U nivo -d nivo 2>/dev/null; then
    break
  fi
  sleep 1
done
docker compose -f docker-compose.postgres.yml exec -T postgres pg_isready -U nivo -d nivo

echo ""
echo "=== 2. Git pull ==="
git pull

echo ""
echo "=== 3. Migrations ==="
./scripts/run_postgres_migrations.sh

echo ""
echo "=== 4. Restart backend ==="
pid=$(lsof -ti ":$PORT" 2>/dev/null || true)
if [ -n "$pid" ]; then
  echo "Stopping process on port $PORT (PID $pid)..."
  kill "$pid" 2>/dev/null || true
  sleep 2
  if lsof -ti ":$PORT" >/dev/null 2>&1; then
    kill -9 $(lsof -ti ":$PORT") 2>/dev/null || true
    sleep 1
  fi
fi

if [ -d .venv ]; then
  source .venv/bin/activate
elif [ -d backend/venv ]; then
  source backend/venv/bin/activate
elif [ -d venv ]; then
  source venv/bin/activate
fi
export PYTHONPATH="${PYTHONPATH:+$PYTHONPATH:}$(pwd)"

echo "Starting backend at http://localhost:$PORT"
exec uvicorn backend.api.main:app --reload --host 0.0.0.0 --port "$PORT"
