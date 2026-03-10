#!/usr/bin/env bash
# Start the Nivo backend API (FastAPI). Run from project root.
# Default 8000; cloud platforms inject PORT automatically.
# Also starts the RQ worker in background (enrichment, ai_analysis, deep_research).
set -e
cd "$(dirname "$0")/.."
PORT="${PORT:-8000}"
export PORT

# Activate venv if it exists (prefer .venv at project root; backend/venv may be stale if project moved)
if [ -d .venv ] && [ -x .venv/bin/python ]; then
  source .venv/bin/activate
elif [ -d backend/venv ] && [ -x backend/venv/bin/python ]; then
  source backend/venv/bin/activate
elif [ -d backend/.venv ]; then
  source backend/.venv/bin/activate
elif [ -d venv ]; then
  source venv/bin/activate
fi

export PYTHONPATH="${PYTHONPATH:+$PYTHONPATH:}$(pwd)"

# Start RQ worker in background if Redis is up and worker not already running
if redis-cli ping &> /dev/null && ! pgrep -f "rq worker.*deep_research" &> /dev/null; then
  echo "Starting RQ worker (enrichment, ai_analysis, deep_research)..."
  ./scripts/start-worker.sh &>/tmp/nivo-worker.log &
  sleep 1
  echo "Worker started (logs: /tmp/nivo-worker.log)"
fi

echo "Starting backend at http://localhost:$PORT"
echo "Health: curl http://localhost:$PORT/health"
echo "Status: curl http://localhost:$PORT/api/status"
echo "(Cloud: platform sets PORT; local: 8000)"
echo ""
exec uvicorn backend.api.main:app --reload --host 0.0.0.0 --port "$PORT"
