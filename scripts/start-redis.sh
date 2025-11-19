#!/usr/bin/env bash
set -euo pipefail

echo "🔴 Starting Redis Server"
echo "========================"

# Check if Redis is installed
if ! command -v redis-server &> /dev/null; then
    echo "❌ Redis is not installed"
    echo ""
    echo "Install Redis:"
    echo "  macOS: brew install redis"
    echo "  Linux: sudo apt-get install redis-server"
    echo "  Or use Docker: docker run -d -p 6379:6379 redis:7-alpine"
    exit 1
fi

# Check if Redis is already running
if redis-cli ping &> /dev/null; then
    echo "✅ Redis is already running"
    exit 0
fi

echo "🚀 Starting Redis server..."
redis-server --daemonize yes --port 6379

# Wait a moment and verify
sleep 1
if redis-cli ping &> /dev/null; then
    echo "✅ Redis started successfully on port 6379"
else
    echo "❌ Failed to start Redis"
    exit 1
fi

