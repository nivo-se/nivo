#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Missing .env in $(pwd)" >&2
  exit 1
fi

docker compose up -d postgres redis
docker compose build api worker
docker compose up -d api worker

for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:8000/health >/dev/null; then
    docker compose ps
    exit 0
  fi
  sleep 2
done

echo "nivo deploy failed health check" >&2
docker compose ps >&2 || true
docker logs --tail=120 nivo-api >&2 || true
exit 1
