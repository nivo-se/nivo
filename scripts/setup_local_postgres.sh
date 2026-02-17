#!/usr/bin/env bash
# One-command setup for local Postgres (Docker) + schema + migrations
# Usage: ./scripts/setup_local_postgres.sh
set -e
cd "$(dirname "$0")/.."

# Load .env if present
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

echo "=== Nivo Local Postgres Setup ==="
echo ""

# 1. Start Postgres (Docker)
echo "1. Starting Postgres container..."
if docker compose ps postgres 2>/dev/null | grep -q "Up"; then
  echo "   Postgres already running."
else
  docker compose up -d
  echo "   Waiting for Postgres to be ready..."
  sleep 3
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if docker compose exec -T postgres pg_isready -U nivo -d nivo 2>/dev/null; then
      break
    fi
    if [ $i -eq 10 ]; then
      echo "   ❌ Postgres failed to start. Check: docker logs nivo-pg"
      exit 1
    fi
    sleep 2
  done
  echo "   Postgres is ready."
fi
echo ""

# 2. Bootstrap schema + coverage_metrics view
echo "2. Bootstrapping schema..."
python3 scripts/bootstrap_postgres_schema.py
echo ""

# 3. Run any remaining migrations (in case bootstrap missed some)
echo "3. Running migrations..."
if [ -f scripts/run_postgres_migrations.sh ]; then
  ./scripts/run_postgres_migrations.sh
else
  echo "   (run_postgres_migrations.sh not found, bootstrap should have applied key migrations)"
fi
echo ""

# 4. Verify connection
echo "4. Verifying connection..."
python3 scripts/check_postgres_connection.py
echo ""

# 5. Check coverage_metrics exists (required for Universe page)
echo "5. Checking coverage_metrics view..."
URL="${DATABASE_URL:-postgresql://nivo:nivo@localhost:5433/nivo}"
if psql "$URL" -tAc "SELECT 1 FROM information_schema.views WHERE table_name='coverage_metrics'" 2>/dev/null | grep -q 1; then
  echo "   coverage_metrics view: OK"
else
  echo "   ⚠ coverage_metrics view missing (Universe page needs it)"
fi
echo ""

echo "✅ Setup complete."
echo ""
echo "Next steps:"
echo "  1. Start backend: cd backend && uvicorn api.main:app --host 0.0.0.0 --port 8000"
echo "  2. (Optional) Import data: python3 scripts/migrate_sqlite_to_postgres.py --truncate"
echo ""
