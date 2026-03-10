#!/usr/bin/env bash
set -euo pipefail

echo "👷 Starting RQ Worker"
echo "====================="

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Activate venv (prefer .venv at project root; backend/venv may be stale if project moved)
if [ -d ".venv" ] && [ -x .venv/bin/python ]; then
    source .venv/bin/activate
elif [ -d "backend/venv" ] && [ -x backend/venv/bin/python ]; then
    source backend/venv/bin/activate
elif [ -d "backend/.venv" ]; then
    source backend/.venv/bin/activate
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
# macOS: avoid fork crash when RQ spawns work horse (objc NSCharacterSet init)
export OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES
rq worker enrichment ai_analysis deep_research --url "${REDIS_URL:-redis://localhost:6379/0}" --path "$PROJECT_ROOT"

