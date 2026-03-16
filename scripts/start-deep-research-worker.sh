#!/usr/bin/env bash
# Start the Deep Research RQ worker. Listens on the deep_research queue.
set -e
cd "$(dirname "$0")/.."

# Load .env so worker gets POSTGRES_HOST, DATABASE_URL, etc. (required when DB is on Mac Mini)
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

if [ -d .venv ]; then
  source .venv/bin/activate
elif [ -d backend/venv ]; then
  source backend/venv/bin/activate
elif [ -d venv ]; then
  source venv/bin/activate
fi

export PYTHONPATH="${PYTHONPATH:+$PYTHONPATH:}$(pwd)"
PROJECT_ROOT="$(pwd)"

echo "Starting Deep Research worker (queue: deep_research)"
# macOS: avoid fork crash when RQ spawns work horse (objc NSCharacterSet init)
export OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES
exec rq worker deep_research --url "${REDIS_URL:-redis://localhost:6379/0}" --path "$PROJECT_ROOT"
