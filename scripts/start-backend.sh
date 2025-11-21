#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Starting Nivo Intelligence Backend API"
echo "=========================================="

# Get project root (parent of scripts directory)
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Check if virtual environment exists
if [ ! -d "backend/venv" ] && [ ! -d "backend/.venv" ]; then
    echo "📦 Creating Python virtual environment..."
    cd backend
    python3 -m venv venv
    cd ..
fi

# Activate virtual environment
if [ -d "backend/venv" ]; then
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
if [ -z "${SUPABASE_URL:-}" ]; then
    echo "⚠️  Warning: SUPABASE_URL not set"
fi
if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
    echo "⚠️  Warning: SUPABASE_SERVICE_ROLE_KEY not set"
fi
if [ -z "${OPENAI_API_KEY:-}" ]; then
    echo "⚠️  Warning: OPENAI_API_KEY not set (required for AI reports)"
fi

# Start FastAPI server from project root
echo "✅ Starting FastAPI server on http://localhost:8000"
echo "📚 API docs available at http://localhost:8000/docs"
echo ""
# Run from project root so imports work correctly
PYTHONPATH="$PROJECT_ROOT" uvicorn backend.api.main:app --reload --host 0.0.0.0 --port 8000

