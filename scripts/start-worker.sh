#!/usr/bin/env bash
set -euo pipefail

echo "👷 Starting RQ Worker"
echo "====================="

cd "$(dirname "$0")/../backend"

# Check if virtual environment exists
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d ".venv" ]; then
    source .venv/bin/activate
else
    echo "❌ Virtual environment not found. Run start-backend.sh first."
    exit 1
fi

# Check if Redis is running
if ! redis-cli ping &> /dev/null; then
    echo "❌ Redis is not running. Start it with: ./scripts/start-redis.sh"
    exit 1
fi

echo "✅ Starting RQ worker for queues: enrichment, ai_analysis"
echo ""
rq worker enrichment ai_analysis --url "${REDIS_URL:-redis://localhost:6379/0}"

