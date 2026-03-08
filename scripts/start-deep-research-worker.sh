#!/usr/bin/env bash
# Start the Deep Research RQ worker. Listens on the deep_research queue.
set -e
cd "$(dirname "$0")/.."

if [ -d .venv ]; then
  source .venv/bin/activate
elif [ -d backend/venv ]; then
  source backend/venv/bin/activate
elif [ -d venv ]; then
  source venv/bin/activate
fi

export PYTHONPATH="${PYTHONPATH:+$PYTHONPATH:}$(pwd)"

echo "Starting Deep Research worker (queue: deep_research)"
exec rq worker deep_research --url "${REDIS_URL:-redis://localhost:6379/0}"
