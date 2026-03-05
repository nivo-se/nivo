#!/bin/bash
# Development environment setup script

set -e

echo "🚀 Setting up Nivo Intelligence Development Environment"
echo ""

# Check if Redis is running
echo "📦 Checking Redis..."
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        echo "✅ Redis is running"
    else
        echo "⚠️  Redis is not running. Starting Redis..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            brew services start redis
        else
            echo "Please start Redis manually: redis-server"
        fi
    fi
else
    echo "❌ Redis not found. Please install Redis:"
    echo "   macOS: brew install redis"
    echo "   Linux: apt-get install redis-server"
    echo "   Or use Docker: docker run -d -p 6379:6379 redis:7-alpine"
    exit 1
fi

# Check Python dependencies
echo ""
echo "🐍 Checking Python dependencies..."
cd backend
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate
pip install -r requirements.txt
echo "✅ Python dependencies installed"

# Check Node dependencies
echo ""
echo "📦 Checking Node dependencies..."
cd ../frontend
if [ ! -d "node_modules" ]; then
    echo "Installing Node dependencies..."
    npm install
fi
echo "✅ Node dependencies installed"

# Check environment variables
echo ""
echo "🔐 Checking environment variables..."
cd ..

if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ Created .env file. Please update with your API keys!"
    else
        echo "❌ .env.example not found. Please create .env manually."
    fi
else
    echo "✅ .env file exists"
fi

# Check database config
echo ""
echo "🗄️  Checking database config..."
if [ -f ".env" ]; then
    source .env
    if [ -n "${DATABASE_URL:-}" ] || [ -n "${POSTGRES_HOST:-}" ]; then
        echo "✅ Database URL or Postgres host set"
    else
        echo "⚠️  Set DATABASE_URL or POSTGRES_* in .env for Postgres"
    fi
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env with your API keys and Postgres connection"
echo "2. Run database migrations (see docs/LOCAL_POSTGRES_BOOTSTRAP.md)"
echo "3. Start services:"
echo "   - Terminal 1: redis-server (or already running)"
echo "   - Terminal 2: cd backend && source venv/bin/activate && uvicorn api.main:app --reload"
echo "   - Terminal 3: cd backend && source venv/bin/activate && rq worker enrichment ai_analysis"
echo "   - Terminal 4: cd frontend && npm run dev"

