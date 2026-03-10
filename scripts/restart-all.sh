#!/usr/bin/env bash
# Restart backend, worker, and optionally frontend. Use when ports are in use or services are stuck.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

echo "🛑 Stopping backend and RQ worker..."
pkill -f "uvicorn backend.api.main" 2>/dev/null || true
pkill -f "rq worker" 2>/dev/null || true
sleep 2

# Ensure port 8000 is free
if lsof -i :8000 &>/dev/null; then
  echo "⚠️  Port 8000 still in use. Force-killing..."
  lsof -ti :8000 | xargs kill -9 2>/dev/null || true
  sleep 1
fi

echo "🚀 Starting backend and worker..."
"$SCRIPT_DIR/start-backend.sh" &

sleep 4
if curl -s http://localhost:8000/health &>/dev/null; then
  echo "✅ Backend running at http://localhost:8000"
else
  echo "⚠️  Backend may still be starting. Check: curl http://localhost:8000/health"
fi

if pgrep -f "rq worker" &>/dev/null; then
  echo "✅ RQ worker running (logs: /tmp/nivo-worker.log)"
else
  echo "⚠️  RQ worker not detected. Start manually: ./scripts/start-worker.sh"
fi

echo ""
echo "Done. Frontend: npm run dev (in frontend/) if needed."
