#!/usr/bin/env bash
# End-to-end diagnostic for backend Postgres / Universe 500 errors.
# Run from project root. Requires: psql, curl.
#
# Usage: ./scripts/diagnose_backend_postgres.sh
#
# Run this in the same env as uvicorn (or source .env first).
# It will pinpoint: env mismatch, connectivity, missing view, or API errors.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

# Load .env if present (same as backend)
if [ -f .env ]; then
  set -a
  source .env 2>/dev/null || true
  set +a
fi

API_BASE="${VITE_API_BASE_URL:-http://127.0.0.1:8000}"
DB_URL="${DATABASE_URL:-postgresql://nivo:nivo@localhost:5433/nivo}"

# Mask password in output
DB_URL_SAFE="${DB_URL}"
if [[ "$DB_URL" == *"@"* ]]; then
  DB_URL_SAFE="postgresql://***:***@${DB_URL#*@}"
fi

echo "=============================================="
echo "  Nivo Backend + Postgres Diagnostic"
echo "=============================================="
echo ""

echo "=== 1) Environment (backend must use these) ==="
echo "  DATABASE_SOURCE=${DATABASE_SOURCE:-<not set - will default to local>}"
echo "  DATABASE_URL=${DB_URL_SAFE}"
echo "  POSTGRES_HOST=${POSTGRES_HOST:-<not set>}"
echo "  POSTGRES_PORT=${POSTGRES_PORT:-<not set>}"
echo ""
echo "  → Expected: DATABASE_SOURCE=postgres"
echo "  → Expected: DATABASE_URL=postgresql://nivo:nivo@localhost:5433/nivo (or POSTGRES_* vars)"
echo ""

echo "=== 2) Python env check (simulates backend process) ==="
ROOT="$ROOT" python3 -c '
import os
try:
    from pathlib import Path
    from dotenv import load_dotenv
    r = os.environ.get("ROOT", ".")
    load_dotenv(Path(r) / ".env")
except Exception:
    pass
print("  DATABASE_SOURCE=", repr(os.getenv("DATABASE_SOURCE")))
print("  DATABASE_URL=", repr(os.getenv("DATABASE_URL") or "(not set)"))
print("  POSTGRES_PORT=", repr(os.getenv("POSTGRES_PORT")))
' 2>/dev/null || echo "  (run from project root with .env loaded)"
echo ""

echo "=== 3) Postgres connectivity (from host) ==="
if psql "$DB_URL" -c "SELECT 1 AS ok;" 2>/dev/null; then
  echo "  ✓ psql connect OK"
else
  echo "  ✗ psql connect FAILED"
  echo "  → Start Postgres (e.g. docker compose up -d), check port (5433 vs 5432), credentials"
fi
echo ""

echo "=== 4) coverage_metrics view ==="
if psql "$DB_URL" -c "\dv+ coverage_metrics" 2>/dev/null | head -5; then
  echo ""
  echo "  Row count:"
  psql "$DB_URL" -c "SELECT count(*) AS total FROM public.coverage_metrics;" 2>/dev/null || echo "  ✗ SELECT failed"
else
  echo "  ✗ View not found or schema issue"
  echo "  → Run: ./scripts/run_postgres_migrations.sh"
fi
echo ""

echo "=== 5) API health (curl) ==="
echo "  GET $API_BASE/health"
curl -s -w "\n  HTTP %{http_code}\n" --max-time 5 "$API_BASE/health" 2>/dev/null || echo "  ✗ Connection failed (backend not running?)"
echo ""

echo "=== 6) API status (curl) ==="
echo "  GET $API_BASE/api/status"
OUT=$(curl -s -w "\nHTTP_CODE:%{http_code}" --max-time 5 "$API_BASE/api/status" 2>/dev/null) || OUT="HTTP_CODE:000"
HTTP=$(echo "$OUT" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$OUT" | sed '/HTTP_CODE:/d')
echo "$BODY" | head -30
echo "  HTTP $HTTP"
if [ "$HTTP" = "500" ]; then
  echo ""
  echo "  ✗ 500 = backend error. Check uvicorn logs for traceback."
fi
echo ""

echo "=== 7) Universe filters (curl) ==="
echo "  GET $API_BASE/api/universe/filters"
OUT=$(curl -s -w "\nHTTP_CODE:%{http_code}" --max-time 5 "$API_BASE/api/universe/filters" 2>/dev/null) || OUT="HTTP_CODE:000"
HTTP=$(echo "$OUT" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$OUT" | sed '/HTTP_CODE:/d')
echo "$BODY" | head -15
echo "  HTTP $HTTP"
echo ""

echo "=== 8) Universe query (curl) ==="
echo "  POST $API_BASE/api/universe/query"
OUT=$(curl -s -w "\nHTTP_CODE:%{http_code}" --max-time 15 -X POST "$API_BASE/api/universe/query" \
  -H "Content-Type: application/json" \
  -d '{"filters":[],"logic":"and","sort":{"by":"revenue_latest","dir":"desc"},"limit":5,"offset":0}' 2>/dev/null) || OUT="HTTP_CODE:000"
HTTP=$(echo "$OUT" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$OUT" | sed '/HTTP_CODE:/d')
echo "$BODY" | head -40
echo "  HTTP $HTTP"
if [ "$HTTP" = "500" ]; then
  echo ""
  echo "  ✗ 500 = check uvicorn traceback. Common causes:"
  echo "     - DATABASE_SOURCE not postgres"
  echo "     - coverage_metrics view missing/column mismatch"
  echo "     - Wrong Postgres port (5433 vs 5432)"
fi
echo ""

echo "=============================================="
echo "  Done. If any step failed, fix that first."
echo "=============================================="
echo ""
echo "Quick manual test (run with backend up):"
echo "  curl -i --max-time 5 $API_BASE/api/status"
echo ""
