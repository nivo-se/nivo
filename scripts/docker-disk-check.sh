#!/usr/bin/env bash
# Report Docker disk use and whether a prune is worth considering (Mac mini / dev machine).
#
# Env (optional):
#   WARN_IMAGES_GB         default 8   — warn if Images reclaimable exceeds this
#   WARN_BUILD_CACHE_GB    default 5   — warn if Build Cache reclaimable exceeds this
#   WARN_HOST_CAPACITY_PCT default 90 — warn if host volume use (df) is at or above this %
#
# Usage: ./scripts/docker-disk-check.sh
set -euo pipefail

WARN_IMAGES_GB="${WARN_IMAGES_GB:-8}"
WARN_BUILD_CACHE_GB="${WARN_BUILD_CACHE_GB:-5}"
WARN_HOST_CAPACITY_PCT="${WARN_HOST_CAPACITY_PCT:-90}"

echo "=============================================="
echo "Docker disk check — $(date -u +%Y-%m-%dT%H:%MZ)"
echo "=============================================="
echo ""

if ! command -v docker &>/dev/null; then
  echo "docker not found in PATH."
  exit 1
fi

echo "--- docker system df ---"
docker system df

echo ""
echo "--- Per-type reclaimable / size ---"
docker system df --format '{{.Type}}: {{.Reclaimable}}' 2>/dev/null || true

echo ""
echo "--- Host disk (current directory mount) ---"
df -h . 2>/dev/null || df -h
host_pct=$(df -h . 2>/dev/null | tail -1 | awk '{ gsub(/%/,"",$5); print $5+0 }')
echo "  Host capacity used: ${host_pct}%  (warn if >= ${WARN_HOST_CAPACITY_PCT}%)"

echo ""
echo "--- Build cache detail (BuildKit) ---"
if docker builder du &>/dev/null; then
  docker builder du
else
  echo "(skipped: docker builder du not available)"
fi

echo ""
echo "--- Prune readiness ---"

# Extract first N.NN from a token ending in GB (portable awk; macOS awk has no match() groups).
gb_of() {
  echo "$1" | awk '{
    for (i = 1; i <= NF; i++) {
      if ($i ~ /GB/) {
        gsub(/GB.*/, "", $i)
        gsub(/[^0-9.]/, "", $i)
        print $i + 0
        exit
      }
    }
    print 0
  }'
}

images_line=$(docker system df --format '{{.Type}} {{.Reclaimable}}' 2>/dev/null | awk '$1=="Images"{$1=""; sub(/^ /,""); print}' || true)
cache_line=$(docker system df --format '{{.Type}} {{.Reclaimable}}' 2>/dev/null | grep '^Build Cache ' || true)
cache_line=${cache_line#Build Cache }

img_gb=$(gb_of "${images_line:-0}")
cache_gb=$(gb_of "${cache_line:-0}")

echo "  Images reclaimable (approx):     ${img_gb} GB  (warn if > ${WARN_IMAGES_GB})"
echo "  Build cache (reported size):     ${cache_gb} GB  (warn if > ${WARN_BUILD_CACHE_GB})"

warn=0
if awk -v a="${img_gb}" -v b="${WARN_IMAGES_GB}" 'BEGIN { exit !(a + 0 > b + 0) }'; then
  echo ""
  echo "  ⚠ Images reclaimable is high — consider: docker image prune  (or docker system prune)"
  warn=1
fi
if awk -v a="${cache_gb}" -v b="${WARN_BUILD_CACHE_GB}" 'BEGIN { exit !(a + 0 > b + 0) }'; then
  echo ""
  echo "  ⚠ Build cache is large — consider: docker builder prune -f"
  warn=1
fi

if awk -v a="${host_pct:-0}" -v b="${WARN_HOST_CAPACITY_PCT}" 'BEGIN { exit !(a + 0 >= b + 0) }'; then
  echo ""
  echo "  ⚠ Host disk is nearly full — prune Docker data and/or free space outside Docker."
  warn=1
fi

if [[ "${warn}" -eq 0 ]]; then
  echo ""
  echo "  ✓ Under default thresholds. Re-run after many builds or image pulls."
fi

echo ""
echo "Typical commands (read before running — volumes):"
echo "  docker builder prune --dry-run"
echo "  docker builder prune -f"
echo "  docker system prune -f"
echo "  docker system prune -a -f          # also removes unused images (next build may be slower)"
echo "  # Never use --volumes on prod mini unless you intend to wipe DB volumes."
