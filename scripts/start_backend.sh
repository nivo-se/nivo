#!/usr/bin/env bash
# Start the Nivo backend API (FastAPI). Run from project root.
# Use PORT=8001 to avoid conflict if 8000 is in use.
set -e
cd "$(dirname "$0")/.."
PORT="${PORT:-8000}"

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
echo "(Use PORT=8001 if 8000 is in use)"
echo ""
exec uvicorn backend.api.main:app --reload --host 0.0.0.0 --port "$PORT"
