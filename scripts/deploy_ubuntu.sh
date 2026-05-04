#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Missing .env in $(pwd)" >&2
  exit 1
fi

# --- Sync local git HEAD to the deployed ref ---
# The workflow rsync only writes the working tree (it excludes .git/), so
# without this step `git log` on this server keeps showing a stale HEAD
# even though the files on disk are already at the new ref.
git fetch origin --quiet
git reset --hard "${GITHUB_SHA:-origin/main}"

# --- Backend: API + worker (Docker) ---
docker compose up -d postgres redis
docker compose build api worker
docker compose up -d api worker

api_healthy=false
for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:8000/health >/dev/null; then
    api_healthy=true
    break
  fi
  sleep 2
done

if [[ "$api_healthy" != true ]]; then
  echo "nivo deploy failed health check" >&2
  docker compose ps >&2 || true
  docker logs --tail=120 nivo-api >&2 || true
  exit 1
fi

docker compose ps

# --- Frontend Node service (nivo-enhanced.service) ---
# Install workspace deps. The deploy rsync excludes node_modules/, so we
# keep the existing tree and let npm ci reconcile it against the lockfile.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

npm ci --no-audit --no-fund

# Restart the Node CRM/Gmail server so it picks up the new code.
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
systemctl --user restart nivo-enhanced.service

for _ in $(seq 1 30); do
  if ss -tlnp 2>/dev/null | grep -q ':3001 '; then
    echo "nivo-enhanced.service is listening on :3001"
    exit 0
  fi
  sleep 1
done

echo "nivo-enhanced.service did not bind :3001 within 30s" >&2
systemctl --user status nivo-enhanced.service --no-pager >&2 || true
journalctl --user -u nivo-enhanced.service -n 80 --no-pager >&2 || true
exit 1
