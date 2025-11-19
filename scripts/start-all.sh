#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Starting All Nivo Services"
echo "=============================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Check environment
echo "📋 Checking environment..."
"$SCRIPT_DIR/check-env.sh" || {
    echo ""
    echo "⚠️  Some environment variables are missing. Continuing anyway..."
    echo ""
}

# Start Redis (optional, in background)
echo "🔴 Starting Redis..."
if command -v redis-server &> /dev/null; then
    if ! redis-cli ping &> /dev/null; then
        redis-server --daemonize yes --port 6379 2>/dev/null || true
        sleep 1
        if redis-cli ping &> /dev/null; then
            echo "✅ Redis started"
        else
            echo "⚠️  Redis failed to start (optional)"
        fi
    else
        echo "✅ Redis already running"
    fi
else
    echo "⚠️  Redis not installed (optional for now)"
fi

echo ""
echo "🎯 Starting services..."
echo ""
echo "Terminal 1: Backend API (FastAPI)"
echo "Terminal 2: Frontend (already running)"
echo "Terminal 3: Worker (optional, for background jobs)"
echo ""
echo "To start backend:"
echo "  ./scripts/start-backend.sh"
echo ""
echo "To start worker (optional):"
echo "  ./scripts/start-worker.sh"
echo ""

# Try to start backend if not running
if ! curl -s http://localhost:8000/health &> /dev/null; then
    echo "Starting backend API..."
    cd "$PROJECT_ROOT/backend"
    if [ -d "venv" ] || [ -d ".venv" ]; then
        "$SCRIPT_DIR/start-backend.sh" &
        echo "✅ Backend starting in background"
        echo "   Check http://localhost:8000/health"
    else
        echo "⚠️  Backend venv not found. Run: ./scripts/start-backend.sh"
    fi
else
    echo "✅ Backend already running on port 8000"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Services:"
echo "  - Frontend: http://localhost:8080 (or check your Vite port)"
echo "  - Backend API: http://localhost:8000"
echo "  - API Docs: http://localhost:8000/docs"
echo "  - Redis: localhost:6379"

