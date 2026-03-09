#!/usr/bin/env bash
set -euo pipefail

echo "👷 Starting RQ Worker"
echo "====================="

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Activate venv
if [ -d "backend/venv" ]; then
    source backend/venv/bin/activate
elif [ -d "backend/.venv" ]; then
    source backend/.venv/bin/activate
elif [ -d ".venv" ]; then
    source .venv/bin/activate
elif [ -d "venv" ]; then
    source venv/bin/activate
else
    echo "❌ Virtual environment not found. Run start-backend.sh first."
    exit 1
fi

export PYTHONPATH="${PYTHONPATH:+$PYTHONPATH:}$PROJECT_ROOT"

# Check if Redis is running
if ! redis-cli ping &> /dev/null; then
    echo "❌ Redis is not running. Start it with: ./scripts/start-redis.sh"
    exit 1
fi

echo "✅ Starting RQ worker for queues: enrichment, ai_analysis, deep_research"
echo ""
rq worker enrichment ai_analysis deep_research --url "${REDIS_URL:-redis://localhost:6379/0}"

