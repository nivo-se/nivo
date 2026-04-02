#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Starting Nivo backend API"
echo "=========================================="

# Get project root (parent of scripts directory)
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Check if virtual environment exists
if [ ! -d ".venv" ] && [ ! -d "backend/venv" ] && [ ! -d "backend/.venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv .venv
fi

# Activate virtual environment (prefer .venv; backend/venv may be stale if project moved)
if [ -d ".venv" ] && [ -x .venv/bin/python ]; then
    source .venv/bin/activate
elif [ -d "backend/venv" ] && [ -x backend/venv/bin/python ]; then
    source backend/venv/bin/activate
elif [ -d "backend/.venv" ]; then
    source backend/.venv/bin/activate
fi

# Install/update dependencies
echo "📥 Installing dependencies..."
cd backend
pip install -q --upgrade pip
pip install -q -r requirements.txt
cd ..

# Check for required environment variables
echo "🔍 Checking environment variables..."
if [ -z "${OPENAI_API_KEY:-}" ]; then
    echo "⚠️  Warning: OPENAI_API_KEY not set (required for AI reports)"
fi

# Start RQ worker in background if Redis is up and worker not already running
if redis-cli ping &> /dev/null 2>/dev/null && ! pgrep -f "rq worker" &> /dev/null; then
    echo "👷 Starting RQ worker in background..."
    PYTHONPATH="$PROJECT_ROOT" "$PROJECT_ROOT/scripts/start-worker.sh" &>/tmp/nivo-worker.log &
    sleep 1
    echo "   Worker logs: /tmp/nivo-worker.log"
fi

# Start FastAPI server from project root
echo "✅ Starting FastAPI server on http://localhost:8000"
echo "📚 API docs available at http://localhost:8000/docs"
echo ""
# Run from project root so imports work correctly
PYTHONPATH="$PROJECT_ROOT" uvicorn backend.api.main:app --reload --host 0.0.0.0 --port 8000

