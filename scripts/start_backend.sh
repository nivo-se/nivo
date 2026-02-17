#!/usr/bin/env bash
# Start the Nivo backend API (FastAPI). Run from project root.
# Default 8000; cloud platforms inject PORT automatically.
set -e
cd "$(dirname "$0")/.."
PORT="${PORT:-8000}"
export PORT

# Activate venv if it exists
if [ -d backend/venv ]; then
  source backend/venv/bin/activate
elif [ -d venv ]; then
  source venv/bin/activate
fi

export PYTHONPATH="${PYTHONPATH:+$PYTHONPATH:}$(pwd)"

echo "Starting backend at http://localhost:$PORT"
echo "Health: curl http://localhost:$PORT/health"
echo "Status: curl http://localhost:$PORT/api/status"
echo "(Cloud: platform sets PORT; local: 8000)"
echo ""
exec uvicorn backend.api.main:app --reload --host 0.0.0.0 --port "$PORT"
