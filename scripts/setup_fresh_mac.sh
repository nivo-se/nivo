#!/usr/bin/env bash
# One-command setup for a fresh Mac. Run from repo root.
# Usage: ./scripts/setup_fresh_mac.sh
# Or: npm run setup:fresh
set -e
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

echo "=== Nivo Fresh Mac Setup ==="
echo "Running from: $REPO"
echo ""

# 1. Check prerequisites
MISSING=()
command -v node >/dev/null 2>&1 || MISSING+=(node)
command -v npm >/dev/null 2>&1 || MISSING+=(npm)
command -v python3 >/dev/null 2>&1 || MISSING+=(python3)
command -v docker >/dev/null 2>&1 || MISSING+=(docker)
command -v redis-cli >/dev/null 2>&1 || MISSING+=(redis)

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "Missing prerequisites: ${MISSING[*]}"
  echo "Install with Homebrew:"
  echo "  brew install node python@3.12 libpq"
  echo "  brew install --cask docker"
  echo "  brew install redis && brew services start redis"
  exit 1
fi

echo "1. Prerequisites OK (node, npm, python3, docker, redis)"
echo ""

# 2. Install npm deps (root + frontend)
echo "2. Installing npm dependencies..."
npm install
(cd frontend && npm install)
echo ""

# 3. Backend venv and deps
echo "3. Setting up backend Python..."
if [ ! -d backend/venv ]; then
  python3 -m venv backend/venv
fi
. backend/venv/bin/activate
pip install -q -r backend/requirements.txt
deactivate 2>/dev/null || true
echo "   Backend venv ready"
echo ""

# 4. .env from .env.example if missing
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "4. Created .env from .env.example"
    echo "   Edit .env with your keys: POSTGRES_PASSWORD, OPENAI_API_KEY, SUPABASE_*, REDIS_URL"
  else
    echo "4. No .env.example found; create .env manually"
  fi
else
  echo "4. .env exists"
fi
echo ""

# 5. Start Postgres and run schema
echo "5. Starting Postgres and applying schema..."
docker compose -f docker-compose.postgres.yml up -d
echo "   Waiting for Postgres..."
sleep 4
for i in 1 2 3 4 5 6 7 8 9 10; do
  if docker compose -f docker-compose.postgres.yml exec -T postgres pg_isready -U nivo -d nivo 2>/dev/null; then
    break
  fi
  [ $i -eq 10 ] && { echo "   Postgres failed to start"; exit 1; }
  sleep 2
done

. backend/venv/bin/activate
python3 scripts/bootstrap_postgres_schema.py
./scripts/run_postgres_migrations.sh
python3 scripts/check_postgres_connection.py
deactivate 2>/dev/null || true
echo ""

echo "Setup complete."
echo ""
echo "Next steps:"
echo "  1. Edit .env with your API keys"
echo "  2. Start backend: npm run dev:backend"
echo "  3. Start frontend: npm run dev"
echo "  4. (Optional) Import data: python3 scripts/migrate_sqlite_to_postgres.py --truncate"
echo ""
