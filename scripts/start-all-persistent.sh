#!/usr/bin/env bash
# Start all Nivo services so they KEEP RUNNING when you close Cursor.
# Run from project root: ./scripts/start-all-persistent.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="${LOG_DIR:-/tmp}"
FRONTEND_LOG="$LOG_DIR/nivo-frontend.log"
FRONTEND_PID="$LOG_DIR/nivo-frontend.pid"

cd "$PROJECT_ROOT"

echo "🚀 Starting All Nivo Services (persistent — survives Cursor close)"
echo "================================================================"
echo ""

# 1. Docker: Postgres + API (detached, always survives)
echo "📦 Starting Docker (Postgres + API)..."
docker compose up -d --build 2>/dev/null || docker-compose up -d --build 2>/dev/null || {
    echo "❌ docker compose failed. Is Docker running?"
    exit 1
}
echo "   Postgres: localhost:5433 | API: http://localhost:8000"
echo ""

# Wait for API to be ready
echo "⏳ Waiting for API to be ready..."
for i in {1..30}; do
    if curl -sf http://localhost:8000/health >/dev/null 2>&1; then
        echo "   ✅ API healthy"
        break
    fi
    sleep 1
    if [[ $i -eq 30 ]]; then
        echo "   ⚠️  API not responding after 30s (check: docker compose logs api)"
    fi
done
echo ""

# 2. Frontend: run with nohup so it survives terminal/Cursor close
if [[ -f "$FRONTEND_PID" ]]; then
    OLD_PID=$(cat "$FRONTEND_PID")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo "✅ Frontend already running (PID $OLD_PID)"
        echo "   Log: $FRONTEND_LOG"
    else
        rm -f "$FRONTEND_PID"
    fi
fi

if [[ ! -f "$FRONTEND_PID" ]] || ! kill -0 "$(cat "$FRONTEND_PID")" 2>/dev/null; then
    echo "🌐 Starting Frontend (detached, survives Cursor close)..."
    nohup npm run dev >> "$FRONTEND_LOG" 2>&1 &
    echo $! > "$FRONTEND_PID"
    disown 2>/dev/null || true
    sleep 2
    echo "   ✅ Frontend started (PID $(cat "$FRONTEND_PID"))"
    echo "   Log: $FRONTEND_LOG"
fi
echo ""

echo "================================================================"
echo "✅ All services running. Close Cursor — they stay up."
echo ""
echo "URLs:"
echo "  Frontend:  http://localhost:5173 (or 8080 — check log)"
echo "  API:       http://localhost:8000"
echo "  API Docs:  http://localhost:8000/docs"
echo ""
echo "To stop:"
echo "  Frontend: kill \$(cat $FRONTEND_PID)"
echo "  Docker:   docker compose down"
echo ""
