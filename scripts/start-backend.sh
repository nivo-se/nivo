#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Starting Nivo Intelligence Backend API"
echo "=========================================="

cd "$(dirname "$0")/../backend"

# Check if virtual environment exists
if [ ! -d "venv" ] && [ ! -d ".venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d ".venv" ]; then
    source .venv/bin/activate
fi

# Install/update dependencies
echo "📥 Installing dependencies..."
pip install -q --upgrade pip
pip install -q -r requirements.txt

# Check for required environment variables
echo "🔍 Checking environment variables..."
if [ -z "${SUPABASE_URL:-}" ]; then
    echo "⚠️  Warning: SUPABASE_URL not set"
fi
if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
    echo "⚠️  Warning: SUPABASE_SERVICE_ROLE_KEY not set"
fi
if [ -z "${OPENAI_API_KEY:-}" ]; then
    echo "⚠️  Warning: OPENAI_API_KEY not set (required for AI reports)"
fi

# Start FastAPI server
echo "✅ Starting FastAPI server on http://localhost:8000"
echo "📚 API docs available at http://localhost:8000/docs"
echo ""
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000

